import * as vscode from "vscode";
import { TextEncoder } from "util";
import { VSProjectTreeItem } from "../explorer/project-files-provider";
import { runMiniPro } from "./svc.minipro";
import { runISP } from "./svc.atmisp";
import { Project } from "../project";
import { projectFromTreeItem } from "./svc.project";
import { atfOutputChannel } from "../os/command";
import { DeviceDeploymentType } from "../devices/devices";
import { extensionState } from "../states/state.global";
import { stateProjects } from "../states/state.projects";

export async function registerDeployJedCommand(
    cmdDeployJed: string,
    context: vscode.ExtensionContext
) {
    //if project type is minipro, deploy using minipro, otherwise run aspisp
    const cmdRegisterDeployJdecHandler = async (
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
            project = extensionState.activeProject;
        }


        if (!project) {
            atfOutputChannel.appendLine(
                `Failed to deploy JEDEC file. Unable to read project information`
            );
            return;
        }
        if ((await project.deviceProgrammer) === DeviceDeploymentType.minipro) {
            runMiniPro(project);
        } else {
            runISP(project);
        }
    };
    context.subscriptions.push(
        vscode.commands.registerCommand(
            cmdDeployJed,
            cmdRegisterDeployJdecHandler
        )
    );
}
