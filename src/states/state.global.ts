import * as vscode from "vscode";
import { Project } from "../project";

import { providerActiveProject } from "../editor/active-project-view";
import { homedir } from "os";
import path = require("path/posix");
import { isWindows } from "../os/platform";
import { stateManager } from "./stateManager";
import { PLDProjectEditorProvider } from "../modules/project-configurator/projectEditor";
import { ProjectFilesProvider } from "../explorer/project-files-provider";


export class StateGlobal {

    private _activeProject: Project | undefined;
    private _pathWinDrive: string | undefined;
    private _pathWinTemp: string | undefined;
    private _pathCupl: string | undefined;
    private _pathCuplDl: string | undefined;
    private _pathCuplFitters: string | undefined;
    private _pathATMISP: string | undefined;
    private _pathPof2Jed: string | undefined;
    private _pathMiniro : string | undefined;
    private _pathMiniroShare : string | undefined;    
    private _pathOpenOcd: string | undefined;
    private _pathOpenOcdDl: string | undefined;

    private _winePrefix: string| undefined;
    private _wineArch: string | undefined;

    private _pathWineBase: string | undefined;

    private _useIntegratedTerminal: boolean = false;
    private _isConfigured: boolean = false;
    private _enableDebugMessages = false;

    private _cuplDefinitions: string = "Atmel.dl";

    public constructor(){
    }

    public async activate(context: vscode.ExtensionContext){
        this._isConfigured = (vscode.workspace.getConfiguration("vs-cupl").get("CompletedWalkthrough") as boolean) ?? false;// context.globalState.get("vs-cupl.extension-configured") as boolean ?? false;
        if(!this._isConfigured){
            //start welcome guide to install
            vscode.commands.executeCommand('workbench.action.openWalkthrough', 'VaynerSystems.vs-cupl#cupl-dev-install', false);
        }
        this.loadPaths();
        //check if state has pending 'proejct open'
        const state = stateManager(context);
        const pendingProjectOpen = state.read('pending-project-open');
        if(pendingProjectOpen !== undefined && pendingProjectOpen.length > 0){
            const project = await Project.openProject(vscode.Uri.parse(pendingProjectOpen));
            const projectFileProvider = await ProjectFilesProvider.instance();
            await projectFileProvider.setWorkspace(project.projectPath.fsPath);
            vscode.commands.executeCommand('vscode.openWith', project.prjFilePath, PLDProjectEditorProvider.viewType);
            state.write('pending-project-open', '');
        }
    }

    public get activeProject() {
        return this._activeProject;
    }
    public setActiveProject(project: Project | undefined) {
        if(this._activeProject?.pldFilePath.fsPath !== project?.pldFilePath.fsPath){
            this._activeProject = project;
        }
        providerActiveProject.openProjectActiveProject(project);
    }

    public get debugEnabled(){
        return this._enableDebugMessages;
    }

    public loadPaths(){
        const extConf = vscode.workspace.getConfiguration("vs-cupl");
        this._pathATMISP = extConf.get('PathATMISP') as string;
        this._pathCupl = extConf.get('PathCupl') as string;
        this._pathCuplDl = extConf.get('PathCuplDl') as string;
        this._pathCuplFitters = extConf.get('PathCuplFitters') as string;
        this._pathMiniro =  extConf.get('PathMinipro') as string;
        this._pathMiniroShare = extConf.get('PathMiniproShare') as string;
        this._pathOpenOcd =  extConf.get('PathOpenOcd') as string;
        this._pathOpenOcdDl = extConf.get('PathOpenOcdDl') as string;
        this._pathPof2Jed = extConf.get('PathPof2Jed') as string;
        this._pathWinDrive = extConf.get('PathWinDrive') as string;
        this._pathWinTemp = extConf.get('PathWinTemp') as string;    
        
        this._winePrefix = extConf.get('WinePrefix') as string;
        this._wineArch = extConf.get('WineArch') as string;
        
        this._pathWineBase = path.join( homedir(), this._winePrefix);

        this._cuplDefinitions = (extConf.get("CuplDefinitions") ?? "Atmel") + ".dl";
        this._enableDebugMessages = extConf.get("DebugLevel") ?? false;
    }

    public get useIntegratedTerminal(){
        return this._useIntegratedTerminal;
    }
    public get cuplDefinitions(){
        return this._cuplDefinitions;
    }

    public get winePrefix(){
        return this._winePrefix;
    }
    public get wineArch(){
        return this._wineArch;
    }

    public get pathWineBase(){
        return this._pathWineBase;
    }
    ///C:\ for windows, drive_c for linux
    public get pathWinDrive(){
        return isWindows() || this._pathWineBase === undefined ?  
            (this._pathWinDrive  === 'drive_c' ? 'C:\\' : this._pathWinDrive) : 
            //path.join(this._pathWineBase, this._pathWinDrive ?? '');
            this._pathWinDrive ?? 'drive_c';
    }
    public get pathSystemRoot(){
        return (isWindows() ? extensionState.pathWinDrive : extensionState.pathWineBase )??
        isWindows() ? 'C:\\' : homedir();
    }
    public get pathWinTemp(){
        if(this.pathWinDrive === undefined) {
            return '';
        }
        return isWindows() ? path.join(this.pathWinDrive, this._pathWinTemp ?? 'temp'):
            path.join(this.pathWineBase ?? '', this.pathWinDrive, this._pathWinTemp ?? 'temp');
    }
    public get pathCupl(){
        return this._pathCupl ?? isWindows()
            ? "C:\\Wincupl\\Shared\\cupl.exe"
            : `${this._pathWineBase}/drive_c/Wincupl/Shared/cupl.exe`;
    }
    public get pathCuplDl(){
        return this._pathCuplDl ?? isWindows()
            ? "C:\\Wincupl\\shared"
            : `${this._pathWineBase}/drive_c/Wincupl/shared/`;
    }
    public get pathCuplFitters(){
        return this._pathCuplFitters ?? isWindows()
            ? "C:\\Wincupl\\WinCupl\\Fitters"
            : `${this._pathWineBase}/drive_c/Wincupl/WinCupl/Fitters/`;        
    }
    public get pathATMISP(){
        return this._pathATMISP;
    }
    public get pathPOF2JED(){
        return this._pathPof2Jed;
    }
    public get pathMinipro(){        
        return this._pathMiniro ?? ("/usr/bin/minipro");
    }
    public get pathMiniproShare(){        
        return this._pathMiniroShare ?? ("/usr/share/minipro");
    }
    public get pathOpenOcd(){
        return this._pathOpenOcd;
    }
    public get pathOpenOcdDl(){
        return this._pathOpenOcdDl;
    }

}
export let extensionState = new StateGlobal();