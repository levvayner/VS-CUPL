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
        path.dirname(extensionState.pathOpenOcd ?? extensionState.pathWinDrive ?? ""),
        "openocd --version"
    );
}

export async function checkForMinipro(){
    const command = new Command();
    return await command.runCommand(
        "vs-cupl Prerequisites",
        path.dirname( extensionState.pathMinipro ?? extensionState.pathWinDrive ?? "" ),
        "minipro --version"
    );
}

export async function checkForMsys2(){
    if(!isWindows()){
        return {responseCode: -1, responseError: "MSYS2 only required on windows." } as ShellResponse;
    }
    const command = new Command();
    return await command.runCommand(
        "vs-cupl Prerequisites",
        path.dirname( extensionState.pathWinDrive ?? "" ),
        //`wmic product get name | find "MSYS2"`
        "dir msys64 /D"
    );
}


export async function checkForAtmisp(){   
    const command = new Command();
    return await command.runCommand(
        "vs-cupl Prerequisites",
        path.join(extensionState.pathWinDrive ?? "" , path.dirname( extensionState.pathATMISP ?? "" )),
        //`wmic product get name | find "MSYS2"`
        isWindows() ? "dir ATMISP* " : "ls ATMISP*"
    );
}

