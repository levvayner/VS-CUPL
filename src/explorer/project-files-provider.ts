import * as vscode from "vscode";
import * as path from "path";
import { homedir } from "os";
import { Project } from "../project";
import { isWindows } from "../os/platform";
import { atfOutputChannel } from "../os/command";
import { projectTasksProvider } from "./project-tasks-provider";
import { stateProjects } from "../states/state.projects";
import { providerChipView } from "../editor/chip-view";
import { pathExists } from "./fileFunctions";
import { extensionState } from "../states/state.global";

export class ProjectFilesProvider
    implements vscode.TreeDataProvider<ProjectTreeViewEntry>
{    
    //public readonly workingLinuxFolder: string;
    //public readonly workingWindowsFolder: string;

    private workspaceRoot: string = "";
    private static _projectFileProvider: ProjectFilesProvider;

    static async instance(): Promise<ProjectFilesProvider> {
        if (!ProjectFilesProvider._projectFileProvider) {
            ProjectFilesProvider._projectFileProvider =
                new ProjectFilesProvider();
        }
        return ProjectFilesProvider._projectFileProvider;
    }
    constructor() {
        vscode.commands.registerCommand(
            "vs-cupl-project-files.on_item_clicked",
            (item) => this.openFile(item)
        );
        vscode.commands.registerCommand(
            "vs-cupl-project-files.refreshEntry",
            () => this.refresh()
        );
        //this.workingLinuxFolder = path.join(extensionState.pathWineBase ?? '',extensionState.pathWinDrive ?? 'drive_c');//  this.wineBaseFolder + "/" + this.winTempPath;
        //this.workingWindowsFolder = (extensionState.pathWinTemp ?? 'temp'
            //path.join((extensionState.pathWinDrive ?? 'C:\\') ,extensionState.pathWinTemp ?? 'temp')
        //);//.replace(/\//gi, "\\");

        this._onDidChangeTreeData = new vscode.EventEmitter<
            VSProjectTreeItem | undefined | null | void
        >();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    async openFile(item: VSProjectTreeItem): Promise<any> {
        if (item.file === undefined) {
            return;
        }
        let filePath = item.file;
        if (item.file.fsPath.endsWith(".prj")) {
            filePath = vscode.Uri.file(item.file.path.replace(".prj", ".pld"));
        }
        const p = stateProjects.getOpenProject(
            vscode.Uri.parse(path.dirname(filePath.fsPath))
        );
        await providerChipView.openProjectChipView(p);
        const result = await vscode.workspace.openTextDocument(filePath);

        if (result) {
            await vscode.window.showTextDocument(result, { preview: false });
        }
    }

    async setWorkspace(workspace: string) {
        this.workspaceRoot = workspace;
    }

    //   async setActiveTreeItem(item: VSProjectTreeItem) {

    //   }

    getTreeItem(element: VSProjectTreeItem): vscode.TreeItem {
        let title = element.label;
        let result = new vscode.TreeItem(title, element.collapsibleState);

        if (element.contextValue) {
            result.contextValue = title;
            switch (title.substring(title.lastIndexOf(".") + 1).toLowerCase()) {
                case "pld":
                    result.iconPath = new vscode.ThemeIcon("notebook");
                    break;
                case "svf":
                    result.iconPath = new vscode.ThemeIcon("cloud-upload");
                    break;

                case "chn":
                    result.iconPath = new vscode.ThemeIcon("console");
                    break;
                case "jed":
                    result.iconPath = new vscode.ThemeIcon("clone");
                    break;
                case "sh":
                    result.iconPath = new vscode.ThemeIcon(
                        "loaded-scripts-view-icon"
                    );
                    break;

                default:
                    result.iconPath = new vscode.ThemeIcon("circle-filled");
                    break;
            }
        } else {
            result.contextValue = "folder";
            result.iconPath = new vscode.ThemeIcon("notebook-kernel-select");
        }
        result.command = {
            command: "vs-cupl-project-files.on_item_clicked",
            title,
            arguments: [element],
        };
        return result;
    }

    getChildren(element?: VSProjectTreeItem): Thenable<VSProjectTreeItem[]> {
        if (!this.workspaceRoot) {
            //vscode.window.showInformationMessage("No dependency in empty workspace");
            return Promise.resolve([]);
        }
        try {
            if (!element) {
                return Promise.resolve(this.getValidProjects());
            } else if (element.file.fsPath.toLowerCase().endsWith(".prj")) {
                return Promise.resolve(this.getProjectFiles(element));
            } else {
                return Promise.resolve([]);
                //
            }
        } catch (err: any) {
            atfOutputChannel.appendLine(
                "Error getting project children: " + err.message
            );
            throw err;
        }
    }

    private _onDidChangeTreeData: vscode.EventEmitter<
        VSProjectTreeItem | undefined | null | void
    >;
    readonly onDidChangeTreeData: vscode.Event<
        VSProjectTreeItem | undefined | null | void
    >;

    public async refresh(): Promise<void> {
        //await this.setWorkspace(this.workspaceRoot);
        await stateProjects.refreshOpenProjects();
        this._onDidChangeTreeData.fire();
    }

    //one project per PLD
    public async getValidProjects(): Promise<VSProjectTreeItem[]> {
        //reset filtering arrays
        // if(!stateProjects || !stateProjects.openProjects){
        //   await stateProjects.refreshOpenProjects();
        // }
        return stateProjects.openProjects.map((op) => this.toTreeItem(op));
    }
    private toTreeItem(
        op: Project,
        filePath: string | undefined = undefined
    ): VSProjectTreeItem {
        const isPrj = !filePath || filePath?.includes(".prj");
        const label =
            (isPrj
                ? op.projectPath.fsPath.substring(
                      op.projectPath.fsPath.lastIndexOf(path.sep) + 1
                  )
                : filePath
                      ?.replace(op.projectPath.fsPath, "")
                      .substring(1)) /*.split('/').join('')*/ ?? op.projectName;
        return new VSProjectTreeItem(
            label,
            filePath ? vscode.Uri.file(filePath) : op.prjFilePath,
            op,
            isPrj
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.None
        );
    }
    private async getProjectFiles(
        treeProject: VSProjectTreeItem
    ): Promise<VSProjectTreeItem[]> {
        if (pathExists(treeProject.project.prjFilePath.fsPath)) {
            const toProjectFile = (filePath: string): VSProjectTreeItem => {
                const projFile = this.toTreeItem(treeProject.project, filePath);
                projFile.contextValue = "file";
                projFile.files.push(projFile);

                return projFile;
            };

            const project = stateProjects.openProjects.find(
                (p) => p.prjFilePath === treeProject.project.prjFilePath
            );
            const entries: VSProjectTreeItem[] = [];

            if (!project) {
                return entries;
            }

            if (
                stateProjects.projectsCanCompile().includes(project.projectName)
            ) {
                entries.push(toProjectFile(project.pldFilePath.fsPath));
            }

            if (
                stateProjects
                    .projectsCanDeployToMinipro()
                    .includes(project.projectName) ||
                stateProjects
                    .projectsCanExportToAtmIsp()
                    .includes(project.projectName)
            ) {
                entries.push(toProjectFile(project.jedFilePath.fsPath));
            }

            if (
                stateProjects
                    .projectsCanExportToAtmIsp()
                    .includes(project.projectName)
            ) {
                if (pathExists(project.chnFilePath.fsPath)) {
                    entries.push(toProjectFile(project.chnFilePath.fsPath));
                }
                if (pathExists(project.buildFilePath.fsPath)) {
                    entries.push(toProjectFile(project.buildFilePath.fsPath));
                }
            }

            if (
                stateProjects
                    .projectsCanDeployToOpenOcd()
                    .includes(project.projectName)
            ) {
                entries.push(toProjectFile(project.svfFilePath.fsPath));
            }

            await projectTasksProvider.refresh();
            return entries;
        } else {
            return [];
        }
    }
}

export class ProjectTreeViewEntry {
    readonly label: string;
    readonly file: vscode.Uri;
    constructor(label: string, file: vscode.Uri) {
        this.label = label;
        this.file = file;
    }
}

export class VSProjectTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly file: vscode.Uri,
        public readonly project: Project,
        //private version: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}`;
        //this.description = this.version;
    }
    public files: VSProjectTreeItem[] = [];

    iconPath = {
        light: vscode.Uri.parse(path.join(
            __filename,
            "..",
            "..",
            "assets",
            "images",
            "light",
            "edit.svg"
        )),
        dark: vscode.Uri.parse(path.join(
            __filename,
            "..",
            "..",
            "assets",
            "images",
            "dark",
            "edit.svg"
        )),
    };
}
