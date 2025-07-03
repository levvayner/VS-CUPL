import { checkForAtmisp, checkForCupl, checkForMinipro, checkForOpenOcd, checkForPof2Jed, checkForWine, checkForWSL, checkForWslUsbIpd } from "../extension/dev-environment";
import { commands, Uri, window, workspace, ExtensionContext } from "vscode";
import { atfOutputChannel, Command, ShellResponse, ShellType } from "../os/command";
import { isWindows } from "../os/platform";
import { extensionState } from "../states/state.global";
import * as cmd from "../vs.commands";
import path = require("path");
import { extensionUri } from "../extension";

interface CommandExecutionRequest{
    cmd: string,
    dir: string,
    shell: ShellType;
}

class StepExecutionCommands{
    commandList: CommandExecutionRequest[] = [];
    addCommand(cmd: string, dir: string | undefined = undefined, shell: ShellType | undefined = undefined){
        if(shell === undefined){
            shell = isWindows() ? ShellType.cmd : ShellType.bash;
        }
        if(dir === undefined){
            dir = extensionState.pathSystemRoot;
        }
        this.commandList.push(
            {cmd, dir , shell }
        );
    }
}

export async function registerWalkthroughTools(context: ExtensionContext){
    var registerCommand = function(cmd: string, handler: any) {
        context.subscriptions.push(commands.registerCommand(cmd,handler));
    };
    registerCommand(cmd.checkCuplDependencyCommand,     installCuplDependency);
    registerCommand(cmd.checkOpenOcdDependencyCommand,  installOpenOcdDependency);
    registerCommand(cmd.checkMiniproDependencyCommand,  installMiniproDependency);
    registerCommand(cmd.checkWineDependencyCommand,     installWineDependency);
    registerCommand(cmd.checkWslDependencyCommand,      installWslDependency);
    registerCommand(cmd.checkUsbipdDependencyCommand,   installWslUsbDependency);
    registerCommand(cmd.checkAtmispDependencyCommand,   installAtmIspDependency);   
    registerCommand(cmd.checkPof2JedDependencyCommand, installPof2JedDependency);
}
/* Tools */
export async function installCuplDependency(){
    var cuplResult = await checkForCupl();
    if(cuplResult.responseCode !== 0) {// 0 is windows standard for normal exit
        window.showErrorMessage('CUPL not found!', 'Install').then(async (selection) => {
            if(selection === 'Install'){
                //needs to be installed
                await commands.executeCommand('vscode.open', Uri.parse('https://www.microchip.com/en-us/products/fpgas-and-plds/spld-cplds/pld-design-resources'));
            }});
    }else {
        await commands.executeCommand('setContext', 'VerifyCuplInstalled', true);            
    }
}

export async function installOpenOcdDependency(){
    var openOcdResult = await checkForOpenOcd();
    var cmdExecution = new Command();
    if(openOcdResult.responseCode !== 0) {// 0 is windows standard for normal exit
        window.showErrorMessage('Open OCD not found!', 'Install').then(async (selection) => {
            if(selection === 'Install'){
                //needs to be installed;
                const openOcdPath = isWindows() ?  'C:\\openocd' : '$(eval echo ~$USER)/openocd';
                var stepCommands = new StepExecutionCommands();
                stepCommands.addCommand('apt-get install libtool libjim-dev', isWindows() ? extensionState.pathWinDrive : extensionState.pathWineBase);
                stepCommands.addCommand('git clone -j8 https://github.com/openocd-org/openocd.git', isWindows() ? extensionState.pathWinDrive : '$(eval echo ~$USER)');
                stepCommands.addCommand('./bootstrap',openOcdPath);
                stepCommands.addCommand('./configure',openOcdPath);
                stepCommands.addCommand(isWindows() ? 'make -j8' : 'make -j$(cat /proc/cpuinfo | grep processor | wc -l)',openOcdPath);
                stepCommands.addCommand(isWindows() ? 'make install -j8' : 'make install -j$(cat /proc/cpuinfo | grep processor | wc -l)',openOcdPath);
                
                if(isWindows()){
                    stepCommands.addCommand(
                        'wsl -u root cp /usr/local/share/openocd/contrib/60-openocd.rules /etc/udev/rules.d/',
                        extensionState.pathWinDrive
                    );
                }
                executeStep('Open Ocd', stepCommands);
                showCheckAgainMessage('Open Ocd', cmd.checkOpenOcdDependencyCommand);      
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
}

export async function installMiniproDependency(){
    var miniproResult = await checkForMinipro();
    if(miniproResult.responseCode !== 0) {// 0 is windows standard for normal exit
        window.showErrorMessage('Minipro not found!', 'Install').then(async (selection) => {
            if(selection === 'Install'){
                const pathMinipro = path.join(extensionState.pathWinDrive ?? '',`minipro`);
                var stepCommands = new StepExecutionCommands();
                stepCommands.addCommand('apt-get upgrade -y', extensionState.pathWinDrive);
                stepCommands.addCommand('apt-get install -y build-essential pkg-config git usbutils zlib1g-dev libusb-1.0-0-dev fakeroot debhelper dpkg-dev', extensionState.pathWinDrive);
                stepCommands.addCommand('git clone https://gitlab.com/DavidGriffith/minipro.git', extensionState.pathWinDrive);
                stepCommands.addCommand('fakeroot dpkg-buildpackage -b -us -uc', pathMinipro);
                stepCommands.addCommand('ln -s $(pwd)/minipro /usr/bin/minipro', pathMinipro);
                stepCommands.addCommand('mkdir /usr/share/minipro -p', pathMinipro);
                stepCommands.addCommand('cp *.xml /usr/share/minipro/', pathMinipro);
                stepCommands.addCommand('cp ./udev/* /etc/udev/rules.d/', pathMinipro); // sets up rules for usb device to allow debuging without root access
                
                executeStep('Minipro', stepCommands);
                showCheckAgainMessage('Minipro', cmd.checkMiniproDependencyCommand);               
                             
            }
        });
                    
    }else {
        await commands.executeCommand('setContext', 'VerifyMiniproInstalled', true);
    }
}

export async function installAtmIspDependency(){
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
        await workspace.fs.copy(sourceFile, destFile, {overwrite: true});
}

export async function installPof2JedDependency(){
    var pof2jedResult = await checkForPof2Jed();
        if(pof2jedResult.responseCode !== 0) {// 0 is windows standard for normal exit
            window.showWarningMessage('Pof2Jed not found!', 'Install').then(async (selection) => {
                if(selection === 'Install'){;

                var atmIspInstallWslCommands = [
                    {
                        cmd: 'apt install unzip wget -y',
                        dir: extensionState.pathWinDrive,
                        useWsl: true
                    },{
                        cmd: 'mkdir -p /tmp/pof2jed',
                        dir: extensionState.pathWinDrive,
                        useWsl: true
                    },
                    {
                        cmd: 'chmod 777 /tmp/pof2jed',
                        dir: extensionState.pathWinDrive,
                        useWsl: true
                    },
                    {
                        cmd: 'wget https://ww1.microchip.com/downloads/archive/pof2jed.zip',
                        dir: isWindows() ? 'c:\\temp' : '/tmp/pof2jed',
                        useWsl: true
                        
                    },{
                        cmd: 'unzip -o pof2jed.zip ',
                        dir: isWindows() ? 'c:\\temp' : '/tmp/pof2jed',
                        useWsl: true
                    },{
                        cmd: 'rm pof2jed.zip ',
                        dir: isWindows() ? 'c:\\temp' : '/tmp/pof2jed',
                        useWsl: true
                    },{
                        cmd: 'chmod +x POF2JED_setup.exe',
                        dir: isWindows() ? 'c:\\temp' : '/tmp/pof2jed',
                        useWsl: true
                    },
                    {
                        cmd: 'POF2JED_setup.exe',
                        dir: isWindows() ? 'c:\\temp' : '/tmp/pof2jed',
                        useWsl: false
                    } 
                ];
                var cmdExecution = new Command();
                var result = new ShellResponse(-1, '', '');
                for(let command of atmIspInstallWslCommands){
                    result = await cmdExecution.runCommand(
                        'POF2JED install',
                        isWindows() ? command.dir : extensionState.pathWinDrive,
                        isWindows() && command.useWsl ? `wsl.exe -u root --cd ${command.dir} ${command.cmd}` : `${command.cmd}`
                    );
                    if(result.responseCode !== 0){
                        window.showErrorMessage('POF2JED installation step failed: ' + result.responseError.message);    
                        atfOutputChannel.appendLine(`[POF2JED Deployment] **ERROR** ${result.responseError.message}`);                             
                    }
                    else{                       
                        atfOutputChannel.appendLine(`[POF2JED Deployment] ${result.responseText}`);
                    }
                }  
            }});   

            
        }else {
            if(pof2jedResult.responseText.indexOf('File Not Found') > 0){
                //needs to be installed
            }
            else{
                await commands.executeCommand('setContext', 'VerifyPof2JedInstalled', true);
            }
            
        }
}

/* Environments */
export async function installWineDependency(){
    var wineResult = await checkForWine();
    if(wineResult.responseCode !== 0) {// 0 is windows standard for normal exit
        window.showErrorMessage('Wine not found!', 'Install').then(async(selection)=>{
            if(selection === 'Install'){
                //installing wine

            }
        });
    }else {
        await commands.executeCommand('setContext', 'VerifyWineInstalled', true);
        // const extConf = workspace.getConfiguration("vs-cupl");
        // var isMiniprolVerified =  extConf.get("VerifyMiniproInstalled") ?? false;
        // extConf.update("VerifyMiniproInstalled", true).then(() =>{
        //     window.showWarningMessage("Verified!");
        // });
    }

}
export async function installWslDependency(){
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
}

export async function installWslUsbDependency(){
    var wslResult = await checkForWslUsbIpd();
    if(wslResult.responseCode !== 0) {// 0 is windows standard for normal exit
        window.showWarningMessage('WSL USBIPD not found!', 'Install').then(async (selection) => {
            if(selection === 'Install'){    
                //needs to be installed
                commands.executeCommand('vscode.open', Uri.parse('https://github.com/dorssel/usbipd-win/releases'));
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
}

async function executeStep(step: string,stepCommands: StepExecutionCommands) {
    var cmdExecution = new Command();
    var result = new ShellResponse(-1, '', '');
    for(let command of stepCommands.commandList){
        result = await cmdExecution.runCommand(
            `${step} install`,
            isWindows() ? command.dir : extensionState.pathWinDrive,
            isWindows() ? `wsl.exe -u root --cd ${command.dir} ${command.cmd}` : `${command.cmd}`
        );
        if(result.responseCode !== 0){
            window.showErrorMessage(`${step} installation step failed: ${result.responseError.message}`);                                 
        }
        else{
            atfOutputChannel.appendLine(`[${step} Deployment] ${result.responseText}`);
        }
    }    
}
                
async function showCheckAgainMessage(name: string, command: string){    
    window.showInformationMessage(`${name} installed! Press Check to validate.`, 'Check')
    .then(async (selection) => {
        if(selection === 'Check'){
            await commands.executeCommand(command);
    }}); 
}