import * as vscode from "vscode";
import { VSProjectTreeItem } from "../explorer/project-files-provider";
import { pathExists } from "../explorer/fileFunctions";
import { getPath, VSCuplPaths } from "./svc.path";
import path = require("path");
import { Project } from "../project";
export async function registerCleanTempFolderCommand(registerCleanTempFolderCommandName: string, context: vscode.ExtensionContext){
       const cmdCleanTempFolder = async (projectTreeItem: VSProjectTreeItem) => {

            const project = await Project.openProject(projectTreeItem.file);
            var delResp = await vscode.window.showInformationMessage(
                `Are you sure you want to delete temp files for ${project.projectName}?`,
                {
                    modal: true,
                },
                { title: "Yes", isCloseAffordance: true } as vscode.MessageItem,
                { title: "No", isCloseAffordance: false } as vscode.MessageItem
            );
            // var deleteResponse = await vscode.window.showQuickPick(
            // 	['Yes', 'No'],{canPickMany: false, title:' Delete ' + fileName.label
            // });
            

            if (delResp?.title !== "Yes") {  
                return;
            }
            var projectTempPath = path.join(getPath(VSCuplPaths.winTempFolder),project.projectName);
            if (!pathExists(projectTempPath)) {
                return;
            }
            await vscode.workspace.fs.delete(vscode.Uri.parse(projectTempPath),{recursive: true, useTrash: true});
            
        };
    
        await context.subscriptions.push(
            vscode.commands.registerCommand(
                registerCleanTempFolderCommandName,
                cmdCleanTempFolder
            )
        );
}