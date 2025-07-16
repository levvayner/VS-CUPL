import * as vscode from "vscode";
import { Project } from "../project";
import { atfOutputChannel } from "../os/command";
import {
    ProjectTreeViewEntry,
    VSProjectTreeItem,
    ProjectFilesProvider,
} from "./project-files-provider";

export let treeItemProjects: VSProjectTreeItem[] = [];
export let projectTasksProvider: ProjectTasksProvider;

export class ProjectTasksProvider
    implements vscode.TreeDataProvider<ProjectTreeViewEntry>
{
    public openProjects: Project[] = [];
    private workspaceRoot: string = "";
    static async init() {
        const projectFileProvider = await ProjectFilesProvider.instance();
        projectTasksProvider = new ProjectTasksProvider();
        treeItemProjects = await projectFileProvider.getValidProjects();
    }
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter<
            VSProjectTreeItem | undefined | null | void
        >();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    getTreeItem(element: VSProjectTreeItem): vscode.TreeItem {
        let title = element.label;
        let result = new vscode.TreeItem(
            title,
            vscode.TreeItemCollapsibleState.None
        );
        if (element.contextValue) {
            result.contextValue = title;
        } else {
            result.contextValue = element.project.projectName;
        }
        result.command = {
            command: "vs-cupl-project-files.on_item_clicked",
            title,
            arguments: [element],
        };
        return result;
    }

    getChildren(element?: VSProjectTreeItem): Thenable<VSProjectTreeItem[]> {
        try {
            if (!element) {
                return Promise.resolve(treeItemProjects);
            }
            else {
                return Promise.resolve([]);
                //return Promise.resolve([new VSProjectTreeItem("Build",element.project.pldFilePath, element.project, vscode.TreeItemCollapsibleState.None)]);
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
        this._onDidChangeTreeData.fire();
    }

    //one project per PLD
}
