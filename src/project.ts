import * as vscode from "vscode";
import {
    DeviceConfiguration,
    DeviceManufacturer,
    DevicePackageType,
} from "./devices/devices";
import { ProjectFilesProvider } from "./explorer/project-files-provider";
import path = require("path");
import { PinConfiguration, getDevicePins } from "./devices/pin-configurations";
import { pathExists } from "./explorer/fileFunctions";
import { homedir } from "os";
export const buildDirectory = "build";
export const atmIspDirectory = "atmisp";
export class Project {
    public readonly prjFilePath: vscode.Uri;
    public readonly pldFilePath: vscode.Uri;
    public readonly jedFilePath: vscode.Uri;
    public readonly chnFilePath: vscode.Uri;
    public readonly svfFilePath: vscode.Uri;
    public readonly projectPath: vscode.Uri;
    public readonly projectName: string;
    public readonly buildFilePath: vscode.Uri;

    public readonly cuplOptimizationLevel: number = 1;
    
    private _windowsPldFilePath: string = "";
    private _windowsJedFilePath: string = "";
    private _windowsChnFilePath: string = "";
    private _devicePins: PinConfiguration | undefined;

    private isInitialized = false;
    private deviceConfiguration: DeviceConfiguration | undefined;

    public static async newProject(projectPath: vscode.Uri) {
        const p = new Project(projectPath);
        await p.init();
        return p;
    }
    public static async openProject(projectPath: vscode.Uri) {
        const p = new Project(projectPath);

        await p.init();
        // await p.initDevice();
        return p;
    }
    /** projectPath: 		/home/user/CUPLProjects/project1/ on Linux, C:\Users\User1\CUPLProjects\project1\
     ** projectFileName: 	Projectvs-cupl.prj or Projectvs-cupl
     **/
    private constructor(private readonly projectPathIn: vscode.Uri) {
        // console.log('Newing up a project class for ' + projectPathIn);
        //can be passed in with project file, or with project directory
        if (projectPathIn.fsPath.toLowerCase().endsWith(".prj")) {
            this.projectName = projectPathIn.fsPath
                .substring(projectPathIn.fsPath.lastIndexOf(path.sep) + 1)
                .replace(".prj", "");
            this.projectPath = vscode.Uri.file(
                projectPathIn.fsPath.substring(
                    0,
                    projectPathIn.fsPath.lastIndexOf(path.sep)
                )
            );
        }
        //can be passed in with project file, or with project directory
        else if (projectPathIn.fsPath.toLowerCase().endsWith(".pld")) {
            this.projectName = projectPathIn.fsPath
                .substring(projectPathIn.fsPath.lastIndexOf(path.sep) + 1)
                .replace(".pld", "");
            this.projectPath = vscode.Uri.file(
                projectPathIn.fsPath.substring(
                    0,
                    projectPathIn.fsPath.lastIndexOf(path.sep)
                )
            );
        }
        //can be passed in with project file, or with project directory
        else if (projectPathIn.fsPath.toLowerCase().endsWith(".jed")) {
            this.projectName = projectPathIn.fsPath
                .substring(projectPathIn.fsPath.lastIndexOf(path.sep) + 1)
                .replace(".jed", "");
            this.projectPath = vscode.Uri.file(
                projectPathIn.fsPath.substring(
                    0,
                    projectPathIn.fsPath.lastIndexOf(path.sep)
                )
            );
        } else {
            if (
                projectPathIn.fsPath.toLowerCase().endsWith(".svf") ||
                projectPathIn.fsPath.toLowerCase().endsWith(".chn") ||
                projectPathIn.fsPath.toLowerCase().endsWith(".sh")
            ) {
                projectPathIn = vscode.Uri.file(
                    projectPathIn.fsPath.substring(
                        0,
                        projectPathIn.fsPath.lastIndexOf(path.sep)
                    )
                );
                projectPathIn = vscode.Uri.file(
                    projectPathIn.fsPath.substring(
                        0,
                        projectPathIn.fsPath.lastIndexOf(path.sep)
                    )
                );
            }
            this.projectName = projectPathIn.fsPath
                .split(path.sep)
                .filter((parts) => parts.length > 0)
                .reverse()[0];
            this.projectPath = projectPathIn;
        }

        this.prjFilePath = vscode.Uri.file(
            path.join(this.projectPath.fsPath, this.projectName + ".prj")
        );

        this.pldFilePath = vscode.Uri.file(
            path.join(this.projectPath.fsPath, this.projectName + ".pld")
        );

        this.jedFilePath = vscode.Uri.file(
            path.join(
                this.projectPath.fsPath,
                this.projectName /*.substring(0,9)*/ + ".jed"
            )
        );

        //for chips requiring ATMISP to convert jed to svf
        this.chnFilePath = vscode.Uri.file(
            path.join(
                this.projectPath.fsPath +
                    path.sep +
                    atmIspDirectory +
                    path.sep +
                    this.projectName +
                    ".chn"
            )
        );

        this.svfFilePath = vscode.Uri.file(
            path.join(
                this.projectPath.fsPath,
                atmIspDirectory,
                this.projectName + ".svf"
            )
        );

        this.buildFilePath = vscode.Uri.file(
            path.join(
                this.projectPath.fsPath,
                buildDirectory,
                this.projectName + ".sh"
            )
        );
    }
    private set windowsPldFilePath(pldPath: string) {
        this._windowsPldFilePath = pldPath;
    }
    private set windowsJedFilePath(jedPath: string) {
        this._windowsJedFilePath = jedPath;
    }
    private set windowsChnFilePath(chnPath: string) {
        this._windowsChnFilePath = chnPath;
    }
    public get windowsPldFilePath() {
        return this._windowsPldFilePath;
    }
    public get windowsJedFilePath() {
        return this._windowsJedFilePath;
    }
    public get windowsChnFilePath() {
        return this._windowsChnFilePath;
    }
    private async init() {
        //parse project file to set memebers
        if (this.isInitialized) {
            return;
        }
        const extConfig = vscode.workspace.getConfiguration("vs-cupl");
        //const workingWindowsFolder = path.join( (extConfig.get('PathWinDrive') as string).replace('~',homedir()), (extConfig.get('WinTempPath') as string));
        const workingWindowsFolder = path.join(
            "c:\\",
            extConfig.get("PathWinTemp") as string
        );
        console.log(`Initializing project ${this.projectName}`);
        //(this.winBaseFolder + this.winTempPath).replace(/\//gi,'\\');
        this.windowsPldFilePath =
            workingWindowsFolder.replace(/\\\\/gi, "\\") +
            "\\" +
            this.projectName +
            ".pld";
        this.windowsJedFilePath =
            workingWindowsFolder.replace(/\\\\/gi, "\\") +
            "\\" +
            this.projectName +
            ".jed";
        this.windowsChnFilePath =
            workingWindowsFolder + "\\" + this.projectName + ".chn";
        if (!pathExists(this.projectPath.fsPath)) {
            await vscode.workspace.fs.createDirectory(this.projectPath);
        }

        const existingFiles = await vscode.workspace.fs.readDirectory(
            this.projectPath
        );
        if (!existingFiles.find((dir) => dir[0] === buildDirectory)) {
            await vscode.workspace.fs.createDirectory(
                vscode.Uri.file(
                    path.join(this.projectPath.fsPath, buildDirectory)
                )
            );
        }
        if (!existingFiles.find((dir) => dir[0] === atmIspDirectory)) {
            await vscode.workspace.fs.createDirectory(
                vscode.Uri.file(
                    path.join(this.projectPath.fsPath, atmIspDirectory)
                )
            );
        }

        await this.initDevice();
        this.isInitialized = true;
    }

    private async initDevice() {
        if (!pathExists(this.prjFilePath.fsPath)) {
            return;
        }
        const deviceConfigRaw = await (
            await vscode.workspace.openTextDocument(this.prjFilePath.path)
        ).getText();
        this.deviceConfiguration = JSON.parse(
            deviceConfigRaw
        ) as DeviceConfiguration;
        if (this.device && this.device.pinConfiguration) {
            this._devicePins = getDevicePins(
                this.device?.pinConfiguration ?? "",
                this.device?.pinCount ?? 0,
                (this.device?.packageType.toLowerCase() as DevicePackageType) ??
                    DevicePackageType.any
            );
            // console.log(`Project: ${this.projectName}. Found device: ${this.device?.pinConfiguration}: of type ${devicePins?.deviceType} with ${devicePins?.pinCount}pins.\n`);
            // devicePins?.pins.forEach(p => {
            // 	console.log(`\t${p.pin}: ${p.pinType}`);
            // });
        }
    }

    public set device(device: DeviceConfiguration | undefined) {
        this.deviceConfiguration = device;
        this._devicePins = getDevicePins(
            device?.pinConfiguration ?? "",
            device?.pinCount ?? 0,
            (device?.packageType.toLowerCase() as DevicePackageType) ??
                DevicePackageType.any
        );
    }

    public get device() {
        return this.deviceConfiguration;
    }

    public get deviceManufacturer() {
        return this.deviceConfiguration?.manufacturer;
    }

    public get devicePackageType() {
        return this.deviceConfiguration?.packageType;
    }

    public get devicePinCount() {
        return this.deviceConfiguration?.pinCount;
    }

    

    public get deviceProgrammer() {
        return this.deviceConfiguration?.programmer;
    }

    public get deviceCode() {
        return this.deviceConfiguration?.deviceCode;
    }
    
    public get deviceName() {
        return this.deviceConfiguration?.deviceUniqueName;
    }
    public get devicePins() {
        return this._devicePins;
    }
}
