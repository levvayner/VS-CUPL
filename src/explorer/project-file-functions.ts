import * as vscode from "vscode";
import { TextDecoder, TextEncoder } from "util";
import {
    AtmIspDeviceAction,
    AtmIspDeviceActionType,
    AtmIspDeploymentCableType,
} from "../devices/devices";
import { atfOutputChannel } from "../os/command";
import { isWindows } from "../os/platform";
import { Project } from "../project";
import {
    VSProjectTreeItem,
    ProjectFilesProvider,
} from "./project-files-provider";
import { uiEnterProjectName } from "../ui.interactions";
import path = require("path");
import { stateProjects } from "../states/state.projects";
import { pathExists } from "./fileFunctions";
import { PLDProjectEditorProvider } from "../modules/project-configurator/projectEditor";

export async function defineProjectFile(projectPath: vscode.Uri) {    
    const newProject = await Project.newProject(projectPath);
    vscode.commands.executeCommand('vscode.openWith', newProject.prjFilePath, PLDProjectEditorProvider.viewType);
    
    return newProject;
}

export async function createPLD(project: Project) {
    const createTime = new Date();

    var projectText = `Name     ${project.projectName} ;
PartNo   ${project.deviceName} ;
Date     ${createTime.toLocaleString()} ;
Revision 01 ;
Designer ${vscode.env.machineId} ;
Company   ;
Assembly None ;
Location  ;
Device   ${project.deviceCode} ;

/* Custom Cupl code below */`;

    await vscode.workspace.fs.writeFile(
        project.pldFilePath,
        new TextEncoder().encode(projectText)
    );
    await vscode.commands.executeCommand("vscode.open", project.pldFilePath);
    return;
}

export async function updatePLD(project: Project) {
    const projectFileProvider = await ProjectFilesProvider.instance();
    if (!pathExists(project.pldFilePath.fsPath)) {
        await createPLD(project);
        await projectFileProvider.refresh();
        return;
    }
    //read pld file. project configuration section should have fields updated: partno, device, ?date?
    const pldText = await vscode.workspace.fs.readFile(project.pldFilePath);
    const pldtextLines = new TextDecoder().decode(pldText).split("\n");

    const partNo = project.deviceName;
    const device = project.deviceCode;
    // let partNoFound = false, deviceFound = false;
    pldtextLines.forEach((l, index) => {
        if (l.startsWith("PartNo")) {
            pldtextLines[index] = `PartNo   ${partNo};`;
        }
        if (l.startsWith("Device")) {
            pldtextLines[index] = `Device   ${device};`;
        } //typescript forEach does not allow a break. consider while or for loops
    });

    await vscode.workspace.fs.writeFile(
        project.pldFilePath,
        new TextEncoder().encode(pldtextLines.join("\n"))
    );
}

export async function updateChn(project: Project) {
    //TODO: use project (prj) config for properties
    const deviceName = project?.deviceName;
    if (!deviceName) {
        atfOutputChannel.appendLine(
            "Error creating chn file: DeviceName missing from project file"
        );
        return;
    }
    const action = new AtmIspDeviceAction(
        deviceName,
        AtmIspDeviceActionType.programAndVerify,
        AtmIspDeploymentCableType.ATDH1150USB,
        isWindows() ? project.jedFilePath.fsPath : project.windowsJedFilePath
    );

    await vscode.workspace.fs.writeFile(
        project?.chnFilePath,
        new TextEncoder().encode(action.toString())
    );
}

export async function cloneProject(
    projectPath: vscode.Uri | undefined = undefined
) {
    const projectFileProvider = await ProjectFilesProvider.instance();
    if (!projectPath) {
        atfOutputChannel.appendLine(
            "Create Project Failed! No project Path specified"
        );
        return;
    }
    const oldProject = stateProjects.getOpenProject(projectPath);

    if (!oldProject) {
        atfOutputChannel.appendLine(
            "Could not find the existing project in the project catalog."
        );
        return;
    }
    const projectName = await uiEnterProjectName();
    const projectDir = path.join(
        projectPath.fsPath.substring(0, projectPath.fsPath.lastIndexOf("/")),
        projectName
    );
    var newProjectPath = projectDir + "/" + projectName + ".prj";

    await vscode.workspace.fs.createDirectory(vscode.Uri.file(projectDir));
    await vscode.workspace.fs.copy(
        oldProject.prjFilePath,
        vscode.Uri.file(newProjectPath)
    );

    var newProject = await Project.newProject(vscode.Uri.parse(projectDir));

    await vscode.workspace.fs.copy(
        oldProject.pldFilePath,
        newProject.pldFilePath
    );

    // await projectFileProvider.setActiveTreeItem(newProject.projectName);
    return newProject;
}

export async function createProject(
    projectPath: vscode.Uri | undefined = undefined
) {
    if (!projectPath) {
        atfOutputChannel.appendLine(
            "Create Project Failed! No project Path specified"
        );
        return;
    }

    var newProject = await defineProjectFile(projectPath);
    if (!newProject) {
        atfOutputChannel.appendLine("Error generating new project file.");
        return;
    }

    const prjData = JSON.stringify(newProject.device, null, 4);
    await vscode.workspace.fs.createDirectory(newProject.projectPath);
    await vscode.workspace.fs.writeFile(
        newProject.prjFilePath,
        new TextEncoder().encode(prjData)
    );

    return newProject;
}

export async function backupFile(fileName: VSProjectTreeItem) {
    const fileUri = vscode.Uri.file(fileName.file.fsPath);
    const wsF = await vscode.workspace.getWorkspaceFolder(fileUri);
    if (wsF === undefined) {
        vscode.window.showErrorMessage(
            "Failed to backup file" + fileName.label
        );
        return;
    }
    const existingFiles = vscode.workspace.fs.readDirectory(wsF.uri);
    if (!(await existingFiles).find((dir) => dir[0] === "backps")) {
        const backupUri = vscode.Uri.file(wsF + "/backups");
        vscode.workspace.fs.createDirectory(backupUri);
        vscode.workspace.fs.copy(fileUri, backupUri);
    }
}

export async function getNameFromPldFile(pldFilePath: vscode.Uri) {
    const doc = await vscode.workspace.openTextDocument(pldFilePath);
    const nameLine = doc
        .getText()
        .split("\n")
        .find((l) => l.trim().startsWith("Name"));
    return (
        nameLine
            ?.split(" ")
            .filter((t) => t.length > 0)[1]
            .replace(";", "")
            .trim() + ".jed"
    );
}
