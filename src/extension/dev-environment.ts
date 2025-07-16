import path = require("path");
import { Command, ShellResponse } from "../os/command";
import { isWindows } from "../os/platform";
import { getWinePath } from "../services/svc.path";
import { extensionState } from "../states/state.global";


export async function checkForCupl(){
    const command = new Command();
    return await command.runCommand(
        "vs-cupl Prerequisites",
        path.dirname(extensionState.pathCupl),
        isWindows() ? extensionState.pathCupl : getWinePath(`${extensionState.pathCupl}`)
    );
}

export async function checkForWine() {
    const command = new Command();
    if(extensionState.pathWineBase === undefined){
        return {responseCode: -1, responseError: "Missing Wine Base Path configuration" } as ShellResponse;
    }
    return isWindows()
        ? ({
                responseCode: 0,
                responseText: "Bypass. Running on Windows",
            } as ShellResponse)
        : await command.runCommand(
            "vs-cupl Prerequisites",
            path.dirname(extensionState.pathWineBase),
            "wine --version"
        );
    
}


export async function checkForOpenOcd(){
    const command = new Command();
    return await command.runCommand(
        "vs-cupl Prerequisites",
        path.dirname(extensionState.pathWinDrive ?? ""),
         isWindows() ? `wsl.exe openocd --version` : "openocd --version"
    );
}

export async function checkForMinipro(){
    const command = new Command();
    return await command.runCommand(
        "vs-cupl Prerequisites",
        isWindows() ? undefined : path.dirname( extensionState.pathMinipro ?? extensionState.pathWinDrive ?? "" ),
        isWindows() ? `wsl.exe ${extensionState.pathMinipro} --version` : "minipro --version"
    );
}

export async function checkForWSL(){
    if(!isWindows()){
        return {responseCode: -1, responseError: "WSL only required on windows." } as ShellResponse;
    }
    const command = new Command();
    return await command.runCommand(
        "vs-cupl Prerequisites",
        path.dirname( extensionState.pathWinDrive ?? "C:\\" ),
        //`wmic product get name | find "MSYS2"`
        "Wsl --list --verbose"
    );
}

export async function checkForWslUsbIpd(){
    if(!isWindows()){
        return {responseCode: -1, responseError: "USBIPD only required on windows." } as ShellResponse;
    }
    const command = new Command();
    return await command.runCommand(
        "vs-cupl Prerequisites",
        `C:\\Program Files\\usbipd-win\\`,
        "usbipd --version"
    );
}

export async function checkForAtmisp(){   
    const command = new Command();
    return await command.runCommand(
        "vs-cupl Prerequisites",
        path.join(extensionState.pathWineBase ?? "", extensionState.pathWinDrive ?? "" , path.dirname( extensionState.pathATMISP ?? "" )),
        //`wmic product get name | find "MSYS2"`
        isWindows() ? "dir ATMISP* " : "ls ATMISP*"
    );
}

export async function checkForPof2Jed(){   
    const command = new Command();
    return await command.runCommand(
        "vs-cupl Prerequisites",
        path.join(extensionState.pathWineBase ?? "", extensionState.pathWinDrive ?? "" , path.dirname( extensionState.pathPOF2JED ?? "" )),
        //`wmic product get name | find "MSYS2"`
        isWindows() ? "dir POF2JED* " : "ls POF2JED*"
    );
}
