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

export async function registerDeployJedCommand(
    cmdDeployJed: string,
    context: vscode.ExtensionContext
) {
    //if project type is minipro, deploy using minipro, otherwise run aspisp
    const cmdRegisterDeployJdecHandler = async (
        treeItem: VSProjectTreeItem | vscode.Uri
    ) => {
        const project = extensionState.activeProject ;//await projectFromTreeItem(treeItem);
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
