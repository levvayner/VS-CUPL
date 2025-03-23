import * as vscode from "vscode";
import { registerDeployJedCommand } from "./services/svc.deploy-jed";
import {
    registerCloneProjectCommand,
    registerCloseProjectCommand,
    registerConfigureProjectCommand,
    registerCreateProjectCommand,
    registerDeleteFileCommand,
    registerImportProjectCommand,
    registerOpenProjectCommand,
} from "./services/svc.project";
import { registerCompileProjectCommand } from "./services/svc.build";
import { registerISPCommand } from "./services/svc.atmisp";
import {
    ProjectFilesProvider,
    VSProjectTreeItem,
} from "./explorer/project-files-provider";
import { registerCheckPrerequisite } from "./explorer/system-files-validation";
import {
    registerMiniProCommand,
    registerMiniProDumpCommand,
    registerMiniProEraseCommand,
} from "./services/svc.minipro";
import {
    ProjectTasksProvider,
    projectTasksProvider,
} from "./explorer/project-tasks-provider";
import * as cmd from "./vs.commands";
import { registerOpenInExplorerCommand } from "./explorer/fileFunctions";
import { registerVariableExtensionProvider } from "./editor/variableProvider";
import {
    registerDeploySvfCommand,
    registerEraseSvfCommand,
} from "./services/svc.deploy-svf";
import { StateProjects } from "./states/state.projects";
import {
    registerOpenSettingsCommand,
    registerEditFileCommand,
} from "./extension/file-provider";
import { registerSemanticTokenProvider } from "./inspect/sematic-token-provider";
import { registerChipViewPanelProvider } from "./editor/chip-view";
import { registerPinViewPanelProvider } from "./editor/pin-view";
import { registerActiveProjectPanelProvider } from "./editor/active-project-view";
import { extensionState } from "./states/state.global";
import { checkForAtmisp, checkForCupl, checkForMinipro, checkForMsys2 } from "./extension/dev-environment";
import { workspace, ConfigurationTarget, window, commands, Uri } from "vscode";
import { Command } from "./os/command";

export async function activate(context: vscode.ExtensionContext) {
    console.log("Activating VS VS Programmer extension");

    extensionUri = context.extensionUri;
    await setupEnvironment(context);

    await registerProjectViewProviders(context);
    await registerCommands(context);
    await registerCheckPrerequisite(cmd.checkPrerequisiteCommand, context);
    await registerCodeProvider(context);
}
export function deactivate() {}
export let extensionUri: Uri;

async function setupEnvironment(context: vscode.ExtensionContext){
    context.subscriptions.push(commands.registerCommand(cmd.checkCuplDependencyCommand, async() => {
        var cuplResult = await checkForCupl();
        if(cuplResult.responseCode !== 0) {// 0 is windows standard for normal exit
            window.showErrorMessage('CUPL not found!');
        }else {
            commands.executeCommand('setContext', 'VerifyCuplInstalled', true);
            // const extConf = workspace.getConfiguration("vs-cupl");
            // var isCuplVerified =  extConf.get("VerifyCuplInstalled") ?? false;
            // extConf.update("vs-cupl.VerifyCuplInstalled", true).then(() =>{
            //     window.showWarningMessage("Verified!");
            // });
        }
    }));
    context.subscriptions.push(commands.registerCommand(cmd.checkMiniproDependencyCommand, async() => {
        var miniproResult = await checkForMinipro();
        if(miniproResult.responseCode !== 0) {// 0 is windows standard for normal exit
            window.showErrorMessage('Minipro not found!');            
        }else {
            commands.executeCommand('setContext', 'VerifyMiniproInstalled', true);
            // const extConf = workspace.getConfiguration("vs-cupl");
            // var isMiniprolVerified =  extConf.get("VerifyMiniproInstalled") ?? false;
            // extConf.update("VerifyMiniproInstalled", true).then(() =>{
            //     window.showWarningMessage("Verified!");
            // });
        }
    }));
    context.subscriptions.push(commands.registerCommand(cmd.checkWineDependencyCommand, async() => {
        var wineResult = await checkForMinipro();
        if(wineResult.responseCode !== 0) {// 0 is windows standard for normal exit
            window.showErrorMessage('Minipro not found!');
        }else {
            commands.executeCommand('setContext', 'VerifyWineInstalled', true);
            // const extConf = workspace.getConfiguration("vs-cupl");
            // var isMiniprolVerified =  extConf.get("VerifyMiniproInstalled") ?? false;
            // extConf.update("VerifyMiniproInstalled", true).then(() =>{
            //     window.showWarningMessage("Verified!");
            // });
        }
    }));
    context.subscriptions.push(commands.registerCommand(cmd.checkMsys2DependencyCommand, async() => {
        var msys2Result = await checkForMsys2();
        if(msys2Result.responseCode !== 0) {// 0 is windows standard for normal exit
            window.showErrorMessage('MSYS2 not found!');
        }else {
            if(msys2Result.responseText.indexOf('File Not Found') > 0){
                //needs to be installed
            }
            else{
                commands.executeCommand('setContext', 'VerifyMsys2Installed', true);
            }
            
        }
    }));
    context.subscriptions.push(commands.registerCommand(cmd.checkAtmispDependencyCommand, async() => {
        var atmispResult = await checkForAtmisp();
        if(atmispResult.responseCode !== 0) {// 0 is windows standard for normal exit
            window.showErrorMessage('ATMISP not found!');
        }else {
            if(atmispResult.responseText.indexOf('File Not Found') > 0){
                //needs to be installed
            }
            else{
                commands.executeCommand('setContext', 'VerifyAtmispInstalled', true);
            }
            
        }
    }));
    
    

    extensionState.activate(context);
}

async function registerCommands(context: vscode.ExtensionContext) {
    await registerOpenInExplorerCommand(cmd.openInExplorerCommand, context);
    await registerOpenSettingsCommand(cmd.openSettingsCommand, context);
    await registerEditFileCommand(cmd.editEntryCommand, context);
    await registerEraseSvfCommand(cmd.eraseSvfCommand, context);
    await registerDeploySvfCommand(cmd.deploySvfCommand, context);
    await registerCreateProjectCommand(cmd.createProjectCommand, context);
    await registerCloneProjectCommand(cmd.cloneProjectCommand, context);
    await registerConfigureProjectCommand(cmd.configureProjectCommand, context);
    await registerOpenProjectCommand(cmd.openProjectCommand, context);
    await registerImportProjectCommand(cmd.importProjectCommand, context);
    await registerCloseProjectCommand(cmd.closeProjectCommand, context);
    await registerCompileProjectCommand(cmd.compileProjectCommand, context);
    await registerDeleteFileCommand(cmd.deleteEntryCommand, context);
    await registerDeployJedCommand(cmd.deployJedCommand, context);
    await registerISPCommand(cmd.runISPCommand, context);
    await registerMiniProCommand(cmd.runMiniProCommand, context);
    await registerMiniProDumpCommand(cmd.runMiniProDumpCommand, context);
    await registerMiniProEraseCommand(cmd.runMiniProEraseChipCommand, context);
}

async function registerProjectViewProviders(context: vscode.ExtensionContext) {
    await StateProjects.init();
    await ProjectTasksProvider.init();
    const projectFileProvider = await ProjectFilesProvider.instance();

    const rootPath =
        vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0
            ? vscode.workspace.workspaceFolders[0].uri.fsPath
            : undefined;
    if (rootPath !== undefined) {
        projectFileProvider.setWorkspace(rootPath[0]);
        vscode.window.setStatusBarMessage("No open folder found!", 2000);
    }
    vscode.window.registerTreeDataProvider(
        "vs-cupl-project-files",
        projectFileProvider
    );
    vscode.window.registerTreeDataProvider(
        "vs-cupl-project-tasks",
        projectTasksProvider
    );

    await registerActiveProjectPanelProvider(context);
    await registerChipViewPanelProvider(context);
    await registerPinViewPanelProvider(context);
}

async function registerCodeProvider(context: vscode.ExtensionContext) {
    await registerVariableExtensionProvider(context);
    await registerSemanticTokenProvider(context);
}
