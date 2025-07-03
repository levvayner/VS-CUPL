import { debug } from "console";
import { DeviceDeploymentType } from "../devices/devices";
import { Project } from "../project";
import * as vscode from "vscode";
import { extensionState } from "./state.global";

export let stateProjects: StateProjects;
export class StateProjects {
    private _supportsDeployToMiniproCommands: string[] = [];
    private _supportsExportToAtmIspCommands: string[] = [];
    private _supportsCompileCommands: string[] = [];
    private _supportsOpenOCDCCommands: string[] = [];
    private _openProjects: Project[] = [];
    

    

    public projectsCanCompile() {
        return this._supportsCompileCommands;
    }
    public projectsCanDeployToMinipro() {
        return this._supportsDeployToMiniproCommands;
    }
    public projectsCanExportToAtmIsp() {
        return this._supportsExportToAtmIspCommands;
    }
    public projectsCanDeployToOpenOcd() {
        return this._supportsOpenOCDCCommands;
    }

    
    public get openProjects() {
        return this._openProjects;
    }

    public updateProject(updatedProject: Project) {
        this._openProjects = this._openProjects.filter(
            (p) => p.projectPath.path !== updatedProject.projectPath.path
        );
        this._openProjects.push(updatedProject);
        extensionState.setActiveProject( updatedProject);
        
    }

    public getOpenProject(projectPath: vscode.Uri) {
        return this._openProjects.find(
            (p) =>
                p.projectPath.fsPath === projectPath.fsPath ||
                p.prjFilePath.fsPath === projectPath.fsPath ||
                p.pldFilePath.fsPath === projectPath.fsPath || 
                p.jedFilePath.fsPath === projectPath.fsPath ||
                p.svfFilePath.fsPath === projectPath.fsPath ||
                p.chnFilePath.fsPath === projectPath.fsPath
        );
    }
    public static async init() {
        stateProjects = new StateProjects();
        await stateProjects.refreshOpenProjects();
        if(extensionState.activeProject === undefined){
            extensionState.setActiveProject(stateProjects.openProjects[0]);
        }
    }

    public removeProject(project: Project) {
        this._openProjects = this._openProjects.filter(
            (p) => p.projectPath.path !== project.projectPath.path
        );
    }

    public async refreshOpenProjects(): Promise<Project[]> {
        //reset filtering arrays
        this._supportsDeployToMiniproCommands = [];
        this._supportsExportToAtmIspCommands = [];
        this._supportsCompileCommands = [];
        this._supportsOpenOCDCCommands = [];

        this._openProjects = [];
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }
        const files = await vscode.workspace.findFiles("**/*.*");
        const projectFiles = files.filter((f) => f.fsPath.endsWith(".prj"));
        for (let i = 0; i < projectFiles.length; i++) {
            const project = await Project.openProject(projectFiles[i]);
            await this.loadProjectFilesAndArrays(project, files);
            
        }
        debug("Refreshing open projects");
        
        return this._openProjects;
    }

    private async loadProjectFilesAndArrays(
        project: Project,
        files: vscode.Uri[]
    ) {
        const projectFiles = files.filter((p) =>
            p.path
                .toLowerCase()
                .includes(project.projectPath.path.toLowerCase())
        );
        const deps = projectFiles.filter((p) =>
            p.path.toLowerCase().endsWith(".pld")
        );
        deps.push(
            ...projectFiles.filter((p) => p.path.toLowerCase().endsWith(".chn"))
        );
        deps.push(
            ...projectFiles.filter((p) => p.path.toLowerCase().endsWith(".svf"))
        );
        deps.push(
            ...projectFiles.filter((p) => p.path.toLowerCase().endsWith(".sh"))
        );
        deps.push(
            ...projectFiles.filter((p) => p.path.toLowerCase().endsWith(".jed"))
        );
        deps.push(
            ...projectFiles.filter((p) => p.path.toLowerCase().endsWith(".prj"))
        );

        //add to filters
        if (
            deps.find((e) => e.fsPath.toLowerCase().includes(".pld")) !==
            undefined
        ) {
            this._supportsCompileCommands.push(project.projectName);
            this._supportsCompileCommands.push(project.projectPath.fsPath);
        }

        if (
            deps.find((e) => e.fsPath.toLowerCase().includes(".jed")) !==
            undefined
        ) {
            const programmer = project.deviceProgrammer;
            if (programmer === DeviceDeploymentType.minipro) {
                this._supportsDeployToMiniproCommands.push(project.projectName);
                this._supportsDeployToMiniproCommands.push(project.projectPath.fsPath);
            } else if (programmer === DeviceDeploymentType.atmisp) {
                this._supportsExportToAtmIspCommands.push(project.projectName);
                this._supportsExportToAtmIspCommands.push(project.projectPath.fsPath);
            }
        }

        if (
            deps.find((e) => e.fsPath.toLowerCase().includes(".svf")) !==
            undefined
        ) {
            if (project.deviceProgrammer === DeviceDeploymentType.atmisp) {
                this._supportsOpenOCDCCommands.push(project.projectName);
                this._supportsOpenOCDCCommands.push(project.projectPath.fsPath);
            }
        }

        vscode.commands.executeCommand(
            "setContext",
            "vscupl.projectCanBuildPld",
            this.projectsCanCompile()
        );
        vscode.commands.executeCommand(
            "setContext",
            "vscupl.projectCanDeployToMinipro",
            this.projectsCanDeployToMinipro()
        );
        vscode.commands.executeCommand(
            "setContext",
            "vscupl.projectCanExportToAtmIsp",
            this.projectsCanExportToAtmIsp()
        );
        vscode.commands.executeCommand(
            "setContext",
            "vscupl.projectCanDeployToOpenOcd",
            this.projectsCanDeployToOpenOcd()
        );

        this._openProjects.push(project);
    }
}
