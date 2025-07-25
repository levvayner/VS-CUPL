import * as vscode from "vscode";
import {
    ProjectFilesProvider,
    VSProjectTreeItem,
} from "../explorer/project-files-provider";
import { Command, ShellType, atfOutputChannel } from "../os/command";
import { Project } from "../project";
import { uiIntentSelectTextFromArray } from "../ui.interactions";
import { isWindows } from "../os/platform";
import { stateProjects } from "../states/state.projects";
import path = require("path");
import { projectFromTreeItem } from "./svc.project";
import { extensionState } from "../states/state.global";

let lastKnownPath = "";

export async function registerMiniProCommand(
    runMiniProCommandName: string,
    context: vscode.ExtensionContext
) {
    const cmdRegisterMiniProHandler = async () => {
        const jed = await vscode.workspace.findFiles("**build/**.jed");
        //const chnFiles = await vscode.workspace.findFiles("**.chn");

        if (jed === undefined) {
            vscode.window.showErrorMessage(
                "No JEDEC Files found to convert. Build Project"
            );
            return;
        }

        //get jed file opened
        if (jed.length > 1) {
            var selectProjectWindowResponse = await vscode.window.showQuickPick(
                jed.map((ru) => ru.fsPath),
                {
                    canPickMany: false,
                    title: "Select jed File to compile",
                }
            );
            if (selectProjectWindowResponse === undefined) {
                vscode.window.setStatusBarMessage(
                    "Did not select a jed file",
                    5000
                );
                return;
            }
            //jedPath = selectProjectWindowResponse;
        } else {
            //jedPath = jed[0].fsPath;
        }

        const project = stateProjects.openProjects.find(
            (p) => p.jedFilePath.fsPath === selectProjectWindowResponse
        );
        if (!project) {
            atfOutputChannel.appendLine(
                `Failed to find requiested file ${selectProjectWindowResponse} in open projects`
            );
            return;
        }
        await runMiniPro(project);

        const projectFileProvider = await ProjectFilesProvider.instance();
        await projectFileProvider.refresh();
    };
    context.subscriptions.push(
        vscode.commands.registerCommand(
            runMiniProCommandName,
            cmdRegisterMiniProHandler
        )
    );
}
export async function registerMiniProDumpCommand(
    runMiniProDumpCommandName: string,
    context: vscode.ExtensionContext
) {
    const cmdRegisterMiniProDumpHandler = async (
        treeItem: VSProjectTreeItem | vscode.Uri | undefined
    ) => {
        let project = await projectFromTreeItem(treeItem);
        if (treeItem === undefined && vscode.window.activeTextEditor) {
            //try get from active window
            const p = vscode.window.activeTextEditor.document.uri.fsPath;
            project = stateProjects.getOpenProject(
                vscode.Uri.parse(p.substring(0, p.lastIndexOf("/")))
            );
        }

        if (!project) {
            atfOutputChannel.appendLine(
                `Failed to deploy JEDEC file. Unable to read project information`
            );
            return;
        }
        if (!project) {
            return;
        }
        await runMiniProDump(project);

        const projectFileProvider = await ProjectFilesProvider.instance();
        await projectFileProvider.refresh();
    };
    await context.subscriptions.push(
        vscode.commands.registerCommand(
            runMiniProDumpCommandName,
            cmdRegisterMiniProDumpHandler
        )
    );
}

export async function registerMiniProEraseCommand(
    runMiniProEraseCommandName: string,
    context: vscode.ExtensionContext
) {
    const cmdRegisterMiniProEraseHandler = async (
        treeItem: VSProjectTreeItem | vscode.Uri | undefined
    ) => {
        let project = await projectFromTreeItem(treeItem);
        if (treeItem === undefined && vscode.window.activeTextEditor) {
            //try get from active window
            const p = vscode.window.activeTextEditor.document.uri.fsPath;
            project = stateProjects.getOpenProject(
                vscode.Uri.parse(p.substring(0, p.lastIndexOf("/")))
            );
        }

        if (!project) {
            atfOutputChannel.appendLine(
                `Failed to erase device. Unable to read project information`
            );
            return;
        }
        if (!project) {
            return;
        }
        await runMiniProErase(project);

        const projectFileProvider = await ProjectFilesProvider.instance();
        await projectFileProvider.refresh();
    };
    await context.subscriptions.push(
        vscode.commands.registerCommand(
            runMiniProEraseCommandName,
            cmdRegisterMiniProEraseHandler
        )
    );
}

export async function runMiniPro(project: Project) {
    try {
        const command = new Command();
        const extConfig = vscode.workspace.getConfiguration("vs-cupl");
        const miniproPath = extensionState.pathMinipro;//  extConfig.get<string>("PathMinipro") ?? "/usr/bin/minipro";
        let usbipdPort = '';
        let wslJedPath = project.jedFilePath.fsPath;
        //TODO: verify deviec name from minipro list before deploying
        // start with full name, take away letters until at least one shows up
        let srchString = project.deviceName;
        if (!srchString) {
            atfOutputChannel.appendLine(
                "Failed to deploy using mini pro. Failed to read device name"
            );
            return;
        }
        if(isWindows()){
            //perform wsl usbipd binding and passthrough
            const execPolicy = await command.runCommand(
                "vs-cupl Build",
                `C:\\Program Files\\usbipd-win`,
                `Set-ExecutionPolicy -ExecutionPolicy  Unrestricted -Scope LocalMachine`,
                ShellType.powershell
            );
            if(execPolicy.responseCode !== 0){
                atfOutputChannel.appendLine(
                    `Failed to set execution policy for usbipd-win. Restart VS Code as adminsitrator and try again`
                );
                return;
            }

            const usbipd = await command.runCommand(
                "vs-cupl Build",
                `C:\\Program Files\\usbipd-win`,
                ` (./usbipd list | Select-String -List XGecu -SimpleMatch) -split " " | Select-Object -First 1`,
                ShellType.powershell
            );
            if(usbipd.responseCode !== 0){
                atfOutputChannel.appendLine(
                    "Failed to find usbipd-win. Ensure your device is connected and usbipd is running"
                );
                return;
            }
            usbipdPort = usbipd.responseText.trim();

            //bind usb device
            const usbipdBind = await command.runCommand(
                "vs-cupl Build",
                `C:\\Program Files\\usbipd-win`,
                `usbipd bind -b ${usbipdPort}`,
                ShellType.powershell
            );
            if(usbipdBind.responseCode !== 0){
                atfOutputChannel.appendLine(
                    `Failed to bind usbipd-win: ${usbipdBind.responseError.message}`
                );
                return;
            }

            //attach usb device
            const usbipdAttach = await command.runCommand(
                "vs-cupl Build",
                `C:\\Program Files\\usbipd-win`,
                `usbipd attach -b ${usbipdPort} --wsl`,
                ShellType.powershell
            );
            if(usbipdAttach.responseCode !== 0){
                atfOutputChannel.appendLine(
                    `Failed to attach usbipd-win: ${usbipdAttach.responseError.message}`
                );
                if(usbipdAttach.responseError.message.indexOf("is already attached") <= 0){
                    return;
                }
            }
            await new Promise(resolve => setTimeout(resolve, 1000)); //wait for usbipd to attach
            
            //get wsl path
            const wslPath = await command.runCommand(
                "vs-cupl Build",
                `C:\\Program Files\\usbipd-win`,
                `wsl -e wslpath "${wslJedPath}"`,
                ShellType.powershell
            );
            if(wslPath.responseCode !== 0){
                atfOutputChannel.appendLine(
                    `Failed to get WSL path for file: ${wslPath.responseError.message}`
                );
                return;
            }
            wslJedPath = wslPath.responseText.trim();
        }

        let cmdString = '';
        if(extConfig.get('MiniproPerformHardwareCheck') as boolean === true ){
            let cmdString = isWindows() ? `wsl -e ${miniproPath} -t` : `${miniproPath} -t `;
            const miniProFound = await command.runCommand(
                "vs-cupl Build",
                project.projectPath.fsPath,
                cmdString,
                ShellType.powershell
            );
            if (miniProFound.responseCode !== 0) {
                if (
                    miniProFound.responseError.message.indexOf(
                        "No programmer found"
                    ) >= 0
                ) {
                    atfOutputChannel.appendLine(
                        "No Minipro device found. Check your connection to your TL866+ programmer"
                    );
                    if(isWindows()){
                        usbipdDetach(usbipdPort);
                    }
                    
                    return;
                }
                //if error other than no programmer found, continue
            }
        }

        let found = false;
        cmdString = "";
        var selectedDeviceName: string | undefined = undefined;
        while (srchString.length > 0 && !found) {
            cmdString = isWindows()
                ? `wsl -e ${miniproPath} --logicic ${
                      extensionState.pathMiniproShare
                  }/logicic.xml --infoic ${
                   extensionState.pathMiniproShare
                  }/infoic.xml -L ${srchString}`
                : `${miniproPath} -L ${srchString}`;
            const devices = await command.runCommand(
                "vs-cupl Build",
                project.projectPath.fsPath,
                cmdString
            );
            if (devices.responseText.length === 0) {
                srchString = srchString.substring(0, srchString.length - 1);
                continue;
            }
            selectedDeviceName = await uiIntentSelectTextFromArray(
                devices.responseText.split("\n")
            );
            selectedDeviceName = selectedDeviceName.replace("(custom)", ""); // ATF750 is listed with (custom) but expected without
            found = true;
        }
        if (!selectedDeviceName) {
            atfOutputChannel.appendLine(
                "Failed to deploy using mini pro. Failed to find device by this name: " +
                    project.deviceName
            );
            if(isWindows()){
                usbipdDetach(usbipdPort);
            }
            return;
        }

        //execute
        atfOutputChannel.appendLine(
            "Uploading using MiniPro " + project.projectName
        );

        var miniproOptions = '';
        if(extConfig.get('MiniproOptionVpp') as number !== undefined && extConfig.get('MiniproOptionVpp') as number > 0){
            miniproOptions += `-o vpp=${extConfig.get('MiniproOptionVpp') as number} `;
        }
        if(extConfig.get('MiniproOptionVdd') as number !== undefined && extConfig.get('MiniproOptionVdd') as number > 0){
            miniproOptions += `-o vdd=${extConfig.get('MiniproOptionVdd') as number} `;
        }
        if(extConfig.get('MiniproOptionVcc') as number !== undefined && extConfig.get('MiniproOptionVcc') as number > 0){
            miniproOptions += `-o vcc=${extConfig.get('MiniproOptionVcc') as number} `;
        }

        if(extConfig.get('MiniproOptionPulse') as number !== undefined && extConfig.get('MiniproOptionPulse') as number > 0){
            miniproOptions += `-o pulse=${extConfig.get('MiniproOptionPulse') as number} `;
        }
        
        if(extConfig.get('MiniproFileSizeMismatch') as string !== undefined && extConfig.get('MiniproFileSizeMismatch') as string === 'Warning'){
            miniproOptions += `-s `;
        } 
        else if(extConfig.get('MiniproFileSizeMismatch') as string !== undefined && extConfig.get('MiniproFileSizeMismatch') as string === 'Ignore'){
            miniproOptions += `-S `;
        }
        if(extConfig.get('MiniproSkipVerify') as boolean !== undefined && extConfig.get('MiniproSkipVerify') as boolean === true){
            miniproOptions += `-v `;
        } 
        if(extConfig.get('MiniproSkipErase') as boolean !== undefined && extConfig.get('MiniproSkipErase') as boolean === true){
            miniproOptions += `-e `;
        } 
        

        if(extConfig.get('MiniproPerformUnprotect') as boolean !== undefined && extConfig.get('MiniproPerformUnprotect') as boolean === true){
            miniproOptions += `-u `;
        }

        if(extConfig.get('MiniproPerformProtect') as boolean !== undefined && extConfig.get('MiniproPerformProtect') as boolean === true){
            miniproOptions += `-P `;
        } 

        if(extConfig.get('MiniproErrorOnIdMismatch') as boolean !== undefined && extConfig.get('MiniproErrorOnIdMismatch') as boolean !== true){
            miniproOptions += `-y `;
        } 
        if(extConfig.get('MiniproCustomArgs') as string !== undefined && extConfig.get('MiniproCustomArgs') as string !== ""){
            miniproOptions += extConfig.get('MiniproCustomArgs') as string + ' ';
        } 
        

        cmdString = 
            (isWindows() ? `wsl -e ${miniproPath} ${miniproOptions}` + " --logicic " +
            extensionState.pathMiniproShare +
             "/logicic.xml --infoic " +
             extensionState.pathMiniproShare +
             "/infoic.xml "
           : `${miniproPath} `) +
          `-p "${selectedDeviceName}" -w "${wslJedPath}"  2>&1${ isWindows() ? "" : "| tee"}`;
        const resp = await command.runCommand(
            "vs-cupl Build",
            project.projectPath.fsPath,
            cmdString
        );
        if (resp.responseCode !== 0) {
            atfOutputChannel.appendLine(
                "Error occured calling minipro:" +
                    resp.responseError +
                    " : " +
                    resp.responseText
            );
            vscode.window.setStatusBarMessage(
                "Failed to upload " + project.projectName,
                5000
            );
            if(isWindows()){
                usbipdDetach(usbipdPort);
            }
            return;
        }
        if (resp.responseText.includes("Warning!")) {
            atfOutputChannel.appendLine(
                "Done Uploading using minipro [WITH WARNINGS]:" +
                    resp.responseText
                        .split("\n")
                        .filter((l) => l.includes("Warning!"))
                        .join("\n")
            );
        } else {
            atfOutputChannel.appendLine(
                "Done Uploading using minipro:" + resp.responseText
            );
        }

        if(isWindows()){
            usbipdDetach(usbipdPort);
        }

        vscode.window.setStatusBarMessage(
            "Done Uploading " + project.projectName,
            5000
        );
        return resp;
    } catch (err: any) {
        atfOutputChannel.appendLine(
            "Critical Error running MiniPro:" + err.message
        );
    }

}

async function usbipdDetach(usbipdPort: string){
    const command = new Command();
    //attach usb device
    const usbipdAttach = await command.runCommand(
        "vs-cupl Build",
        `C:\\Program Files\\usbipd-win`,
        `./usbipd detach -b ${usbipdPort}`,
        ShellType.powershell
    );
    if(usbipdAttach.responseCode !== 0){
        atfOutputChannel.appendLine(
            `Failed to detach usbipd-win: ${usbipdAttach.responseError.message}`
        );
        return;
    }
}

export async function runMiniProDump(project: Project) {
    try {
        const command = new Command();
        const extConfig = vscode.workspace.getConfiguration("vs-cupl");
        const miniproPath = extConfig.get<string>("PathMinipro") ?? "/usr/bin/minipro";

        const fileName = "dump_" + new Date().getUTCSeconds().toFixed(0);
        const dumpFile = path.join(
            path.dirname(project?.buildFilePath.fsPath) ?? "",
            fileName
        );

        //TODO: verify deviec name from minipro list before deploying
        // start with full name, take away letters until at least one shows up
        let srchString = project.deviceName;
        if (!srchString) {
            atfOutputChannel.appendLine(
                "Failed to deploy using mini pro. Failed to read device name"
            );
            return;
        }
        let cmdString = `${miniproPath} -t `;
        const miniProFound = await command.runCommand(
            "vs-cupl Build",
            project.projectPath.fsPath,
            cmdString
        );
        if (miniProFound.responseCode !== 0) {
            if (
                miniProFound.responseError.message.indexOf(
                    "No programmer found"
                ) >= 0
            ) {
                atfOutputChannel.appendLine(
                    "No Minipro device found. Check your connection to your TL866+ programmer"
                );
                return;
            }
            
        }

        let found = false;
        cmdString = "";
        var selectedDeviceName: string | undefined = undefined;
        while (srchString.length > 0 && !found) {
            cmdString = isWindows()
                ? `${miniproPath} --logicic ${
                    extensionState.pathMiniproShare
                  }/logicic.xml --infoic ${
                    extensionState.pathMiniproShare
                  }/infoic.xml -L ${srchString}`
                : `${miniproPath} -L ${srchString}`;
            const devices = await command.runCommand(
                "vs-cupl Build",
                project.projectPath.fsPath,
                cmdString
            );
            if (devices.responseText.length === 0) {
                srchString = srchString.substring(0, srchString.length - 1);
                continue;
            }
            selectedDeviceName = await uiIntentSelectTextFromArray(
                devices.responseText.split("\n")
            );
            selectedDeviceName = selectedDeviceName.replace("(custom)", ""); // ATF750 is listed with (custom) but expected without
            found = true;
        }
        if (!selectedDeviceName) {
            atfOutputChannel.appendLine(
                "Failed to deploy using mini pro. Failed to find device by this name: " +
                    project.deviceName
            );
            return;
        }

        //execute
        atfOutputChannel.appendLine(
            "Downloading using MiniPro " + project.projectName
        );
        cmdString = `${miniproPath} ${
            isWindows()
                ? "--logicic " +
                extensionState.pathMiniproShare +
                  "/logicic.xml --infoic " +
                  extensionState.pathMiniproShare +
                  "/infoic.xml"
                : ""
        } -p "${
            selectedDeviceName /* project.deviceName */
        }" -r "${dumpFile}"  2>&1 ${ isWindows() ? "" : "| tee"}`;
        const resp = await command.runCommand(
            "vs-cupl Build",
            project.projectPath.fsPath,
            cmdString
        );
        if (resp.responseCode !== 0) {
            atfOutputChannel.appendLine(
                "Error occured calling minipro:" +
                    resp.responseError +
                    " : " +
                    resp.responseText
            );
            vscode.window.setStatusBarMessage(
                "Failed to download " + project.projectName,
                5000
            );
            return;
        }
        if (resp.responseText.includes("Warning!")) {
            atfOutputChannel.appendLine(
                "Done download using minipro [WITH WARNINGS]:" +
                    resp.responseText
                        .split("\n")
                        .filter((l) => l.includes("Warning!"))
                        .join("\n")
            );
        } else {
            atfOutputChannel.appendLine(
                "Done download using minipro:" + resp.responseText
            );
            const doc = await vscode.workspace.openTextDocument(dumpFile);
            await vscode.window.showTextDocument(doc);
        }

        vscode.window.setStatusBarMessage(
            "Done download " + project.projectName,
            5000
        );
        return resp;
    } catch (err: any) {
        atfOutputChannel.appendLine(
            "Critical Error running MiniPro:" + err.message
        );
    }
}
export async function runMiniProErase(project: Project) {
    try {
        const command = new Command();
        const extConfig = vscode.workspace.getConfiguration("vs-cupl");
        const miniproPath = extConfig.get<string>("PathMinipro") ?? "/usr/bin/minipro";

        // start with full name, take away letters until at least one shows up
        let srchString = project.deviceName;
        if (!srchString) {
            atfOutputChannel.appendLine(
                "Failed to erase using mini pro. Failed to read device name"
            );
            return;
        }
        let cmdString = `${miniproPath} -t `;
        const miniProFound = await command.runCommand(
            "vs-cupl Build",
            project.projectPath.fsPath,
            cmdString
        );
        if (miniProFound.responseCode !== 0) {
            if (
                miniProFound.responseError.message.indexOf(
                    "No programmer found"
                ) >= 0
            ) {
                atfOutputChannel.appendLine(
                    "No Minipro device found. Check your connection to your TL866+ programmer"
                );
                return;
            }
            
        }

        let found = false;
        cmdString = "";
        var selectedDeviceName: string | undefined = undefined;
        while (srchString.length > 0 && !found) {
            cmdString = isWindows()
                ? `${miniproPath} --logicic ${
                    extensionState.pathMiniproShare
                  }/logicic.xml --infoic ${
                    extensionState.pathMiniproShare
                  }/infoic.xml -L ${srchString}`
                : `${miniproPath} -L ${srchString}`;
            const devices = await command.runCommand(
                "vs-cupl Build",
                project.projectPath.fsPath,
                cmdString
            );
            if (devices.responseText.length === 0) {
                srchString = srchString.substring(0, srchString.length - 1);
                continue;
            }
            selectedDeviceName = await uiIntentSelectTextFromArray(
                devices.responseText.split("\n")
            );
            selectedDeviceName = selectedDeviceName.replace("(custom)", ""); // ATF750 is listed with (custom) but expected without
            found = true;
        }
        if (!selectedDeviceName) {
            atfOutputChannel.appendLine(
                "Failed to erase using mini pro. Failed to find device by this name: " +
                    project.deviceName
            );
            return;
        }

        //execute
        atfOutputChannel.appendLine(
            "Erasing using MiniPro " + project.projectName
        );
        cmdString = `${miniproPath} ${
            isWindows()
                ? "--logicic " +
                extensionState.pathMiniproShare +
                  "/logicic.xml --infoic " +
                  extensionState.pathMiniproShare +
                  "/infoic.xml"
                : ""
        } -p "${selectedDeviceName /* project.deviceName */}" -E  2>&1 ${ isWindows() ? "" : "| tee"}`;
        const resp = await command.runCommand(
            "vs-cupl Build",
            project.projectPath.fsPath,
            cmdString
        );
        if (resp.responseCode !== 0) {
            atfOutputChannel.appendLine(
                "Error occured calling minipro:" +
                    resp.responseError +
                    " : " +
                    resp.responseText
            );
            vscode.window.setStatusBarMessage(
                "Failed to erase " + project.projectName,
                5000
            );
            return;
        }
        if (resp.responseText.includes("Warning!")) {
            atfOutputChannel.appendLine(
                "Done erase using minipro [WITH WARNINGS]:" +
                    resp.responseText
                        .split("\n")
                        .filter((l) => l.includes("Warning!"))
                        .join("\n")
            );
        } else {
            atfOutputChannel.appendLine(
                "Done erase using minipro:" + resp.responseText
            );
        }

        vscode.window.setStatusBarMessage(
            "Done erase " + project.projectName,
            5000
        );
        return resp;
    } catch (err: any) {
        atfOutputChannel.appendLine(
            "Critical Error running MiniPro:" + err.message
        );
    }
}
