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
import { checkForAtmisp, checkForCupl, checkForMinipro, checkForOpenOcd, checkForWine, checkForWSL, checkForWslUsbIpd } from "./extension/dev-environment";
import { workspace, ConfigurationTarget, window, commands, Uri } from "vscode";
import { atfOutputChannel, Command, ShellResponse, ShellType } from "./os/command";
import { isWindows } from "./os/platform";
import path = require("path/posix");

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
            window.showErrorMessage('CUPL not found!', 'Install').then(async (selection) => {
                if(selection === 'Install'){
                    //needs to be installed
                    await commands.executeCommand('vscode.open', vscode.Uri.parse('https://www.microchip.com/en-us/products/fpgas-and-plds/spld-cplds/pld-design-resources'));
                }});
        }else {
            await commands.executeCommand('setContext', 'VerifyCuplInstalled', true);            
        }
    }));

    context.subscriptions.push(commands.registerCommand(cmd.checkOpenOcdDependencyCommand, async() => {
        var openOcdResult = await checkForOpenOcd();
        var cmdExecution = new Command();
        if(openOcdResult.responseCode !== 0) {// 0 is windows standard for normal exit
            window.showErrorMessage('Open OCD not found!', 'Install').then(async (selection) => {
                if(selection === 'Install'){
                    //needs to be installed;
                    var miniproInstallWslCommands = [
                        {
                            cmd: 'apt-get install libtool libjim-dev',
                            dir: isWindows() ? extensionState.pathWinDrive : extensionState.pathWineBase,
                        },
                       
                        // {
                        //     cmd: 'mkdir  $(eval echo ~$USER)/openocd -p',
                        //     dir:  extensionState.pathWineBase,
                        // },
                        
                        {
                            //cmd: 'wget https://github.com/openocd-org/openocd/archive/refs/tags/latest.tar.gz -O $(eval echo ~$USER)/openocd/openocd.tar.gz',
                            cmd: 'git clone -j8 https://github.com/openocd-org/openocd.git',
                            dir:  isWindows() ? extensionState.pathWinDrive : '$(eval echo ~$USER)',
                        },
                        /*{
                            cmd: 'tar -xvf $(eval echo ~$USER)/openocd/openocd.tar.gz -C $(eval echo ~$USER)/openocd --strip-components=1',
                            dir:  '$(eval echo ~$USER)/openocd',
                        }, 
                        {
                            cmd: 'rm $(eval echo ~$USER)/openocd/openocd.tar.gz',
                            dir:  '$(eval echo ~$USER)/openocd',
                        },*/
                        {
                            cmd: './bootstrap',
                            dir:  isWindows() ?  'C:\\openocd' : '$(eval echo ~$USER)/openocd',
                        } ,
                        {
                            cmd: './configure',
                            dir:  isWindows() ? 'C:\\openocd' : '$(eval echo ~$USER)/openocd',
                        } ,
                        {
                            cmd:  isWindows() ? 'make -j8' : 'make -j$(cat /proc/cpuinfo | grep processor | wc -l)',
                            dir:  isWindows() ? 'C:\\openocd' : '$(eval echo ~$USER)/openocd',
                        },
                        {
                            cmd:  isWindows() ? 'make install -j8' : 'make install -j$(cat /proc/cpuinfo | grep processor | wc -l)',
                            dir:  isWindows() ? 'C:\\openocd' : '$(eval echo ~$USER)/openocd',
                        }                 
                    ];
                       
                    
                    var result = new ShellResponse(-1, '', '');
                    for(let command of miniproInstallWslCommands){
                        result = await cmdExecution.runCommand(
                            'Open OCD install',
                            command.dir,
                            isWindows() ? `wsl.exe -u root --cd ${command.dir} ${command.cmd}` : `${command.cmd}`
                        );
                        if(result.responseCode !== 0){
                            window.showErrorMessage('Open OCD installation step failed: ' + result.responseError.message);   
                            return;                              
                        }
                        else{
                            atfOutputChannel.appendLine(`[Open OCD Deployment] ${result.responseText}`);
                        }
                    }     

                    if(isWindows()){
                        //cp /usr/local/share/openocd/contrib/60-openocd.rules /etc/udev/rules.d/
                        result = await cmdExecution.runCommand(
                            'Open OCD install',
                            extensionState.pathWinDrive,
                            'wsl -u root cp /usr/local/share/openocd/contrib/60-openocd.rules /etc/udev/rules.d/'
                        );
                    }
                    window.showInformationMessage('Open OCD installed! Press Check to validate.', 'Check')
                    .then(async (selection) => {
                        if(selection === 'Check'){
                            await commands.executeCommand(cmd.checkOpenOcdDependencyCommand);
                        }});              
                }
            });
                      
        }else {
            await commands.executeCommand('setContext', 'VerifyOpenOcdInstalled', true);
            //update config, set openocd path
            var openocdPath = await cmdExecution.runCommand(
                'Get OpenOCD Path',
                isWindows() ? extensionState.pathWinDrive : '/',
                `which openocd`
            );
            if(openocdPath.responseCode !== 0){
                //error, could not verify open ocd path
            }else{
                const ocdBinPath = openocdPath.responseText.trim();
                const ocdDlPath = openocdPath.responseText.trim().replace('/bin/','/share/');
                var config = workspace.getConfiguration("vs-cupl");
                config.update("PathOpenOcd", ocdBinPath).then(() =>{
                    atfOutputChannel.appendLine(`Verified OCD Bin Path ${ocdBinPath}`);
                });
                config.update("PathOpenOcdDl", ocdDlPath).then(() =>{
                    atfOutputChannel.appendLine(`Verified OCD DL Path ${ocdDlPath}`);
                });
            }
            
        }
    }));

    context.subscriptions.push(commands.registerCommand(cmd.checkMiniproDependencyCommand, async() => {
        var miniproResult = await checkForMinipro();
        if(miniproResult.responseCode !== 0) {// 0 is windows standard for normal exit
            window.showErrorMessage('Minipro not found!', 'Install').then(async (selection) => {
                if(selection === 'Install'){
                    //needs to be installed;
                    var miniproInstallWslCommands = [{
                        cmd: 'apt-get upgrade -y',
                        dir: extensionState.pathWinDrive,
                    },{
                        cmd: 'apt-get install -y build-essential pkg-config git usbutils zlib1g-dev libusb-1.0-0-dev fakeroot debhelper dpkg-dev',
                        dir: extensionState.pathWinDrive,
                    },{
                        cmd: 'git clone https://gitlab.com/DavidGriffith/minipro.git',
                        dir: extensionState.pathWinDrive,
                    },{
                        cmd: 'fakeroot dpkg-buildpackage -b -us -uc',
                        dir: path.join(extensionState.pathWinDrive ?? '',`minipro`),
                    },{
                        cmd: 'ln -s $(pwd)/minipro /usr/bin/minipro',
                        dir:  path.join(extensionState.pathWinDrive ?? '',`minipro`),
                    },
                    {
                        cmd: 'mkdir /usr/share/minipro -p',
                        dir:  path.join(extensionState.pathWinDrive ?? '',`minipro`),
                    },
                    
                    {
                        cmd: 'cp *.xml /usr/share/minipro/',
                        dir:  path.join(extensionState.pathWinDrive ?? '',`minipro`),
                    },
                    {
                        cmd: 'cp ./udev/* /etc/udev/rules.d/',
                        dir:  path.join(extensionState.pathWinDrive ?? '',`minipro`),
                    }                
                    ];
                       
                    var cmdExecution = new Command();
                    var result = new ShellResponse(-1, '', '');
                    for(let command of miniproInstallWslCommands){
                        result = await cmdExecution.runCommand(
                            'Minipro install',
                            isWindows() ? command.dir : extensionState.pathWinDrive,
                            isWindows() ? `wsl.exe -u root --cd ${command.dir} ${command.cmd}` : `${command.cmd}`
                        );
                        if(result.responseCode !== 0){
                            window.showErrorMessage('Minipro installation step failed: ' + result.responseError.message);                                 
                        }
                        else{
                            atfOutputChannel.appendLine(`[Minipro Deployment] ${result.responseText}`);
                        }
                    }     
                    window.showInformationMessage('Minipro installed! Press Check to validate.', 'Check')
                    .then(async (selection) => {
                        if(selection === 'Check'){
                            await commands.executeCommand(cmd.checkMiniproDependencyCommand);
                        }});              
                }
            });
                      
        }else {
            await commands.executeCommand('setContext', 'VerifyMiniproInstalled', true);
            // const extConf = workspace.getConfiguration("vs-cupl");
            // var isMiniprolVerified =  extConf.get("VerifyMiniproInstalled") ?? false;
            // extConf.update("VerifyMiniproInstalled", true).then(() =>{
            //     window.showWarningMessage("Verified!");
            // });
        }
    }));
    context.subscriptions.push(commands.registerCommand(cmd.checkWineDependencyCommand, async() => {
        var wineResult = await checkForWine();
        if(wineResult.responseCode !== 0) {// 0 is windows standard for normal exit
            window.showErrorMessage('Wine not found!');
        }else {
            await commands.executeCommand('setContext', 'VerifyWineInstalled', true);
            // const extConf = workspace.getConfiguration("vs-cupl");
            // var isMiniprolVerified =  extConf.get("VerifyMiniproInstalled") ?? false;
            // extConf.update("VerifyMiniproInstalled", true).then(() =>{
            //     window.showWarningMessage("Verified!");
            // });
        }
    }));
    context.subscriptions.push(commands.registerCommand(cmd.checkWslDependencyCommand, async() => {
        var wslResult = await checkForWSL();
        if(wslResult.responseCode !== 0) {// 0 is windows standard for normal exit
            window.showWarningMessage('WSL not found!', 'Install').then(async (selection) => {
                if(selection === 'Install'){    
                    //needs to be installed
                    var cmd = new Command();
                    var result = await cmd.runCommand('WSL install', extensionState.pathWinDrive, 'wsl.exe --install');
                    if(result.responseCode !== 0){
                        window.showErrorMessage('WSL installation failed!');    
                    }else{
                        window.showWarningMessage('WSL Installed! Your system needs to be restarted!', 'Restart').then(async (selection) => {
                            if(selection === 'Restart'){   
                                cmd.runCommand('Windows Restart', extensionState.pathWinDrive, 'shutdown /r /t 0');
                            }}); 
                        //commands.executeCommand('setContext', 'VerifyWslInstalled', true);
                    }
                }});            
        }else {   
            if(wslResult.responseText.indexOf('No installed distributions found') > 0){
                window.showWarningMessage('WSL not found!', 'Install Distribution').then(async (selection) => {  
                 if(selection === 'Install Distribution'){    
                    var cmd = new Command();
                    var result = await cmd.runCommand('WSL install distro', extensionState.pathWinDrive, 'wsl.exe --install Ubuntu');
                    if(result.responseCode !== 0){
                        window.showErrorMessage('WSL distro installation failed!');
                    }
                }});                
            }else {
                await commands.executeCommand('setContext', 'VerifyWslInstalled', true);
            }
        }
    }));

    context.subscriptions.push(commands.registerCommand(cmd.checkUsbipdDependencyCommand, async() => {
        var wslResult = await checkForWslUsbIpd();
        if(wslResult.responseCode !== 0) {// 0 is windows standard for normal exit
            window.showWarningMessage('WSL USBIPD not found!', 'Install').then(async (selection) => {
                if(selection === 'Install'){    
                    //needs to be installed
                    vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://github.com/dorssel/usbipd-win/releases'));
                    /*
                    var cmd = new Command();
                    var result = await cmd.runCommand('WSL USBPID install', extensionState.pathWinDrive, 'winget install --interactive --exact dorssel.usbipd-win');
                    if(result.responseCode !== 0){
                        window.showErrorMessage('WSL USBPID installation failed!');    
                    }else{
                        window.showWarningMessage('WSL USBPID Installed!\nDevce needs to be attached to WSL', 'Attach').then(async (selection) => {
                            if(selection === 'Attach'){   
                                cmd.runCommand('Attach USB Device', extensionState.pathWinDrive, 'usbipd bind --busid 1-1.1');
                            }}); 
                        //commands.executeCommand('setContext', 'VerifyWslInstalled', true);
                    }
                        */
                }});            
        }else {   
            if(wslResult.responseText.indexOf('No installed distributions found') > 0){
                window.showWarningMessage('WSL not found!', 'Install Distribution').then(async (selection) => {  
                 if(selection === 'Install Distribution'){    
                    var cmd = new Command();
                    var result = await cmd.runCommand('WSL install distro', extensionState.pathWinDrive, 'wsl.exe --install Ubuntu');
                    if(result.responseCode !== 0){
                        window.showErrorMessage('WSL distro installation failed!');
                    }
                }});                
            }else {
                await commands.executeCommand('setContext', 'VerifyWSLUsbIpdInstalled', true);
            }
        }
    }));


    context.subscriptions.push(commands.registerCommand(cmd.checkAtmispDependencyCommand, async() => {
        var atmispResult = await checkForAtmisp();
        if(atmispResult.responseCode !== 0) {// 0 is windows standard for normal exit
            window.showWarningMessage('ATMISP not found!', 'Install').then(async (selection) => {
                if(selection === 'Install'){;

                var atmIspInstallWslCommands = [
                    {
                        cmd: 'apt install unzip wget -y',
                        dir: extensionState.pathWinDrive,
                        useWsl: true
                    },{
                        cmd: 'mkdir -p /tmp/atmisp',
                        dir: extensionState.pathWinDrive,
                        useWsl: true
                    },
                    {
                        cmd: 'chmod 777 /tmp/atmisp',
                        dir: extensionState.pathWinDrive,
                        useWsl: true
                    },
                    {
                        cmd: 'wget http://ww1.microchip.com/downloads/en/DeviceDoc/ATMISP7.zip',
                        dir: isWindows() ? 'c:\\temp' : '/tmp/atmisp',
                        useWsl: true
                        
                    },{
                        cmd: 'unzip -o ATMISP7.zip ',
                        dir: isWindows() ? 'c:\\temp' : '/tmp/atmisp',
                        useWsl: true
                    },{
                        cmd: 'rm ATMISP7.zip ',
                        dir: isWindows() ? 'c:\\temp' : '/tmp/atmisp',
                        useWsl: true
                    },{
                        cmd: 'chmod +x ATMISP7_setup.exe',
                        dir: isWindows() ? 'c:\\temp' : '/tmp/atmisp',
                        useWsl: true
                    },
                    {
                        cmd: 'ATMISP7_setup.exe',
                        dir: isWindows() ? 'c:\\temp' : '/tmp/atmisp',
                        useWsl: false
                    } 
                ];
                var cmdExecution = new Command();
                var result = new ShellResponse(-1, '', '');
                for(let command of atmIspInstallWslCommands){
                    result = await cmdExecution.runCommand(
                        'ATMISP install',
                        isWindows() ? command.dir : extensionState.pathWinDrive,
                        isWindows() && command.useWsl ? `wsl.exe -u root --cd ${command.dir} ${command.cmd}` : `${command.cmd}`
                    );
                    if(result.responseCode !== 0){
                        window.showErrorMessage('ATMISP installation step failed: ' + result.responseError.message);    
                        atfOutputChannel.appendLine(`[ATMISP Deployment] **ERROR** ${result.responseError.message}`);                             
                    }
                    else{                       
                        atfOutputChannel.appendLine(`[ATMISP Deployment] ${result.responseText}`);
                    }
                }  
            }});   

            
        }else {
            if(atmispResult.responseText.indexOf('File Not Found') > 0){
                //needs to be installed
            }
            else{
                await commands.executeCommand('setContext', 'VerifyAtmispInstalled', true);
            }
            
        }

        //copy files from assets/bin to atm install folder
        const sourceFile = Uri.joinPath(extensionUri, 'assets/bin/ftd2xx.dll');
        const destFile =  Uri.file( path.join( path.dirname( path.join(extensionState.pathWinDrive ?? '', extensionState.pathATMISP??'') ?? ''),  'ftd2xx.dll'));
        await vscode.workspace.fs.copy(sourceFile, destFile, {overwrite: true});
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
