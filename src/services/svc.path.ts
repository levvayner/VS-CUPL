import { isWindows } from "../os/platform";
import { extensionState } from "../states/state.global";
import { stateManager } from "../states/stateManager";
import { homedir } from "os";
import path = require("path/posix");

export enum VSCuplPaths{
    "wineRoot"      = 0,      //for linux /home/{user}/{WINEPREFIX}/{WinDrive}, for windows blank
    "winRoot"       = 1,      // either /home/{user}/{WINEPREFIX}/{WinDrive} or C:\
    "winDrive"      = 2,      // C:\ for windows or drive_c for linux
    "winTempFolder" = 3,      // `temp` given other defaults will be C:\temp on windows or \home\{user}\{WINEPRIFIX}\{WinDrive}
    "cupl"          = 4,         // relative to winRoot
    "cuplDl"        = 5,
    "cuplFitters"   = 6,  // relative to winRoot
    "atmisp"        = 7,       // relative to winRoot
    "minipro"       = 8,  
    "openocd"       = 9,
    "openOcdDl"     = 10   
};

export function getPath(pathType : VSCuplPaths ) : string{

    
    switch (pathType){
        case VSCuplPaths.winRoot:
            return extensionState.pathWinDrive ?? '';
        case VSCuplPaths.winTempFolder:
            return extensionState.pathWinTemp;
        case VSCuplPaths.wineRoot:
            return extensionState.pathWineBase ?? '';
        case VSCuplPaths.cupl:
            return extensionState.pathCupl;
        case VSCuplPaths.cuplDl:
            return extensionState.pathCuplDl;
        case VSCuplPaths.cuplFitters:
            return extensionState.pathCuplFitters;
        case VSCuplPaths.atmisp:
            return extensionState.pathATMISP ?? '';
        case VSCuplPaths.minipro:
            return extensionState.pathMinipro ?? '';
        case VSCuplPaths.openocd:
            return extensionState.pathOpenOcd ?? '';
        case VSCuplPaths.openOcdDl:
            return extensionState.pathOpenOcdDl ?? '';
            break;
            
    }
    return '';
}

export function getWindowsPath(linuxPath: string) : string{
    if(extensionState.pathWinDrive === undefined || extensionState.pathWineBase === undefined)
    {
        return linuxPath;
    }
    return (linuxPath.startsWith('~') ? linuxPath.replace("~", homedir()) : linuxPath) //if relative, get full
        .replace(
            extensionState.pathWineBase,
            extensionState.pathWinDrive
        )
        .replace(/\//gi, "\\");
}
export function getLinuxPath(windowsPath: string){
    if(extensionState.pathWinDrive === undefined || extensionState.pathWineBase === undefined)
    {
        return windowsPath;
    }
    return windowsPath
        .replace(
            extensionState.pathWinDrive,
            extensionState.pathWineBase
        )
        .replace(/\\/gi, "/");
}

export function getWinePath(executable: string, args?: string[] | undefined ,winePath?: string | undefined ){
    var cmdString = `WINEPREFIX=${extensionState.pathWineBase} WINEARCH=${extensionState.wineArch} `;
    if(winePath){
        cmdString +=`WINEPATH="${winePath}" `;
    }
    if(extensionState.debugEnabled){
        cmdString += `WINEDEBUG=-all `;
    }

    cmdString += `wine "${executable}" `;
    if(args !== undefined){
        cmdString += " " + args.join(" ");
    }
    return cmdString;
}
