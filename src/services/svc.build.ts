import * as vscode from "vscode";
import {
    VSProjectTreeItem,
    ProjectFilesProvider,
} from "../explorer/project-files-provider";
import { copyToLinux, copyToWindows } from "../explorer/fileFunctions";
import { Command, atfOutputChannel } from "../os/command";
import { Project } from "../project";
import { isWindows } from "../os/platform";
import { projectFromTreeItem } from "./svc.project";
import { stateProjects } from "../states/state.projects";
import { getNameFromPldFile } from "../explorer/project-file-functions";
import { homedir } from "os";
import path = require("path");
import { getPath, getWindowsPath, getWinePath, VSCuplPaths } from "./svc.path";
import { extensionState } from "../states/state.global";

export async function registerCompileProjectCommand(
    compileProjectCommandName: string,
    context: vscode.ExtensionContext
) {
    const projectFileProvider = await ProjectFilesProvider.instance();
    const cmdCompileProjectHandler = async (
        treeItem: VSProjectTreeItem | vscode.Uri
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

        const pldFiles = await vscode.workspace.findFiles(
            `**${project.pldFilePath.path.replace(
                project.projectPath.path,
                ""
            )}`
        );

        if (pldFiles === undefined) {
            vscode.window.showErrorMessage("No PLD Files found to build");
            return;
        }
        await vscode.workspace.saveAll();
        await buildProject(project);
        await projectFileProvider.refresh();
    };
    await context.subscriptions.push(
        vscode.commands.registerCommand(
            compileProjectCommandName,
            cmdCompileProjectHandler
        )
    );
}

export async function buildProject(project: Project) {
    let cmdString = "";
    const cmd = new Command();
    const projectFileProvider = await ProjectFilesProvider.instance();

    const cuplBinPath = getPath(VSCuplPaths.cupl);   
    const cuplDLPath =  getPath(VSCuplPaths.cuplDl);            
    const cuplFittersPath =  getPath(VSCuplPaths.cuplFitters);
    const extConfig = vscode.workspace.getConfiguration("vs-cupl");
    const cuplOptimization =  (extConfig.get("CuplOptimization") as number) ?? 1;

            
    
    const cuplWindowsBinPath = getWindowsPath(cuplBinPath);   
    const cuplWindowsDLPath = getWindowsPath(cuplDLPath);
    const cuplWindowsFittersPath = getWindowsPath(cuplFittersPath);

    const libPath = path.join(
        isWindows() ? cuplWindowsDLPath : cuplDLPath,
        extensionState.cuplDefinitions
    );

    //copy to working folder
    if (!isWindows()) {
        const cpToWinResponse = await copyToWindows(project.pldFilePath.path);
        if (cpToWinResponse.responseCode !== 0) {
            return;
        }

        //run cupl
        vscode.window.setStatusBarMessage(
            "Updating project " + project.projectName,
            5000
        );
        cmdString = getWinePath(cuplWindowsBinPath, [`-m${cuplOptimization}lxfjnabe -u "${libPath}" "${project.windowsPldFilePath}"`], cuplWindowsFittersPath);
        //cmdString = `WINEPATH="${cuplWindowsFittersPath}" wine "${cuplWindowsBinPath}" -m${cuplOptimization}lxfjnabe -u "${libPath}" "${project.windowsPldFilePath}"`;
    } else {
        cmdString = `${cuplWindowsBinPath} -m1lxnfjnabe -u "${libPath}" "${project.pldFilePath.fsPath}"`;
    }

    //execute build command
    const result = await cmd
        .runCommand("vs-cupl Build", `${project.projectPath.fsPath}`, cmdString)
        .then(async (result) => {
            if (result.responseCode !== 0) {
                atfOutputChannel.appendLine(
                    "** Failed to build: ** " +
                        project.projectName +
                        ". " +
                        result.responseError
                );
            } else {
                atfOutputChannel.appendLine(
                    `** Built module ** ${project.projectName} successfully`
                );
                 if (!isWindows()) {
                    //copy results back
                    let fileName = project.device?.usesPldNameFieldForJedFile
                        ? await getNameFromPldFile(project.pldFilePath)
                        : project.jedFilePath.fsPath.substring(
                            project.jedFilePath.fsPath.lastIndexOf("/")
                        );

                    await copyToLinux(`${fileName}`, `${project.projectPath.fsPath}`);
                }
                await projectFileProvider.refresh();
                vscode.window.setStatusBarMessage("Compiled " + project.projectName, 2000);
            }
        })
        .catch((err) => {
            atfOutputChannel.appendLine(
                "** Critical Error! Failed to build: ** " +
                    project.projectName +
                    ". " +
                    err.message
            );
        });

   
}
