import * as vscode from "vscode";
import { uiEnterProjectName } from "../ui.interactions";
import { TextEncoder } from "util";
import { stateManager } from "../states/stateManager";
import { Command, atfOutputChannel } from "../os/command";
import { Project } from "../project";
import path = require("path");
import {
    backupFile,
    cloneProject,
    createProject,
    createPLD,
    defineProjectFile,
    updatePLD,
} from "../explorer/project-file-functions";
import {
    ProjectFilesProvider,
    VSProjectTreeItem,
} from "../explorer/project-files-provider";
import { stateProjects } from "../states/state.projects";
import { providerChipView } from "../editor/chip-view";
import { pathExists } from "../explorer/fileFunctions";
import { extensionState } from "../states/state.global";
import { isWindows } from "../os/platform";

let command = new Command();
let lastKnownPath = '';
export async function registerCreateProjectCommand(createProjectCommandName: string, context: vscode.ExtensionContext) {
	
	const state = stateManager(context);
	const projectFileProvider = await ProjectFilesProvider.instance();
	lastKnownPath = state.read('last-known-VS-project-path');
	if(lastKnownPath === '' || lastKnownPath === undefined){
		lastKnownPath = path.join(extensionState.pathWineBase ?? '', extensionState.pathWinDrive ?? (isWindows() ? 'C:\\' : 'drive_c'));
	}
	const cmdCreateProjectHandler = async () => {

        var projectRoot = await vscode.window.showOpenDialog({canSelectMany: false, 
            canSelectFiles: false, canSelectFolders: true, 
            openLabel: "Create project here", 
            title: "Specify where you'd like to create a new project",
			defaultUri: vscode.Uri.file(lastKnownPath)
        });

        var paths = projectRoot?.map((pr) => pr.fsPath);
        if (paths === undefined || paths.length === 0) {
            vscode.window.setStatusBarMessage("No path specified", 5000);
            return;
        }
        //set up project type
        var projectName = await uiEnterProjectName();
        var path = paths[0] + "/" + projectName + "/" + projectName + ".prj";

        var project = await createProject(vscode.Uri.file(path));

        if (!project) {
            atfOutputChannel.appendLine("Failed to create project!");
            return;
        }

        //create default PLD
        await createPLD(project);

        state.write("last-known-VS-project-path", paths[0]);

        await vscode.workspace.updateWorkspaceFolders(0, 0, {
            uri: project?.projectPath,
            name: project.projectName,
        });
        await projectFileProvider.setWorkspace(project.projectPath.fsPath);
        await projectFileProvider.refresh();
        //await vscode.commands.executeCommand("vscode.openFolder", project?.projectPath);

        await providerChipView.openProjectChipView(project);
    };
    await context.subscriptions.push(
        vscode.commands.registerCommand(
            createProjectCommandName,
            cmdCreateProjectHandler
        )
    );
}

export async function registerCloneProjectCommand(cloneProjectCommandName: string, context: vscode.ExtensionContext) {
	
	const state = stateManager(context);
	const projectFileProvider = await ProjectFilesProvider.instance();
	lastKnownPath = state.read('last-known-VS-project-path');
	if(lastKnownPath === '' || lastKnownPath === undefined){
		lastKnownPath = path.join(extensionState.pathWineBase ?? '', extensionState.pathWinDrive ?? (isWindows() ? 'C:\\' : 'drive_c'));
	}
	const cmdCloneProjectHandler = async (treeItem: VSProjectTreeItem | vscode.Uri | undefined) => {

		let project = await projectFromTreeItem(treeItem);
		if(treeItem === undefined && vscode.window.activeTextEditor){
			//try get from active window
			const p = vscode.window.activeTextEditor.document.uri.fsPath;
			project = stateProjects.getOpenProject(vscode.Uri.parse(p.substring(0, p.lastIndexOf('/'))));
		}
		
		if(!project){
			atfOutputChannel.appendLine(`Failed to clone project. Unable to read project information`);
			return;
		}
       
		const newProject = await cloneProject(project.projectPath);
		if(!newProject){
			atfOutputChannel.appendLine(`Failed to clone project. Unable to instantiate project information`);
			return;
		}
		
	
		
		await state.write('last-known-VS-project-path', newProject.projectPath.fsPath);
       
		
		await vscode.workspace.updateWorkspaceFolders(0, 0,{  uri: newProject?.projectPath, name: newProject.projectName});
		await projectFileProvider.setWorkspace(newProject.projectPath.fsPath);
		await projectFileProvider.refresh();

        await providerChipView.openProjectChipView(project);
    };
    await context.subscriptions.push(
        vscode.commands.registerCommand(
            cloneProjectCommandName,
            cmdCloneProjectHandler
        )
    );
}

export async function registerConfigureProjectCommand(
    configureProjectCommandName: string,
    context: vscode.ExtensionContext
) {
    const cmdConfigureProjectHandler = async (
        treeItem: VSProjectTreeItem | vscode.Uri
    ) => {
        const project = await projectFromTreeItem(treeItem);
        if (!project) {
            atfOutputChannel.appendLine(`Unable to read project information`);

            return;
        }

        var updatedProject = await defineProjectFile(project.prjFilePath);

        if (!updatedProject) {
            atfOutputChannel.appendLine(
                ` Cannot create new project definition`
            );
            return;
        }
        //update PLD
        await updatePLD(updatedProject);
        const prjData = JSON.stringify(updatedProject.device, null, 4);
        await vscode.workspace.fs.createDirectory(updatedProject.projectPath);
        await vscode.workspace.fs.writeFile(
            updatedProject.prjFilePath,
            new TextEncoder().encode(prjData)
        );

        //update open projects
        stateProjects.updateProject(updatedProject);

        //show pins
        await providerChipView.openProjectChipView(updatedProject);
    };
    await context.subscriptions.push(
        vscode.commands.registerCommand(
            configureProjectCommandName,
            cmdConfigureProjectHandler
        )
    );
}

export async function registerOpenProjectCommand(openProjectCommandName: string, context: vscode.ExtensionContext){
	const projectFileProvider = await ProjectFilesProvider.instance();
	const state = stateManager(context);
	lastKnownPath = state.read('last-known-VS-project-path');
	if(lastKnownPath === '' || lastKnownPath === undefined){
		lastKnownPath = path.join(extensionState.pathWineBase ?? '', extensionState.pathWinDrive ?? (isWindows() ? 'C:\\' : 'drive_c'));
	}
	const cmdOpenProjectHandler = async () => {
		var projectRoot = await vscode.window.showOpenDialog({canSelectMany: false, 
			canSelectFiles: true, canSelectFolders: false,
			openLabel: "Open project", 
			title: "Chose PLD file to open project",
			defaultUri: vscode.Uri.file(lastKnownPath),
			filters: {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'Cupl Project File': ['prj']
			}			
		});

		var paths = projectRoot?.map(pr => pr.fsPath);
		if(paths === undefined || paths.length === 0)
		{
			vscode.window.setStatusBarMessage('No path specified', 5000);
			return;
		}
		
		const folderUri = vscode.Uri.file(paths[0].substring(0,paths[0].lastIndexOf(path.sep)));// vscode.Uri.file(paths[0].substring(0,paths[0].lastIndexOf('/')));
		const folderName = folderUri.fsPath.split('/').reverse()[0];

        vscode.workspace.updateWorkspaceFolders(0, 0, {
            uri: folderUri,
            name: folderName,
        });
        
		await projectFileProvider.setWorkspace(folderUri.fsPath);
        await stateProjects.refreshOpenProjects();
        const project = stateProjects.getOpenProject(folderUri);
        if (project) {
            stateProjects.updateProject(project);
        }
        var openedProject = await Project.openProject(folderUri);
        providerChipView.openProjectChipView(
            openedProject
        );
        
        await projectFileProvider.refresh();
    };

    await context.subscriptions.push(
        vscode.commands.registerCommand(
            openProjectCommandName,
            cmdOpenProjectHandler
        )
    );
}

export async function registerImportProjectCommand(openProjectCommandName: string, context: vscode.ExtensionContext){
	const projectFileProvider = await ProjectFilesProvider.instance();
	const state = stateManager(context);
	lastKnownPath = state.read('last-known-VS-project-path');
	
	const cmdOpenProjectHandler = async () => {
		if(lastKnownPath === '' || lastKnownPath === undefined){
			lastKnownPath = path.join(extensionState.pathWineBase ?? '', extensionState.pathWinDrive ?? (isWindows() ? 'C:\\' : 'drive_c'));
		}
		var importRoot = await vscode.window.showOpenDialog({canSelectMany: false, 
			canSelectFiles: true, canSelectFolders: false,
			openLabel: "Import PLD", 
			title: "Chose PLD file to import",
			defaultUri: vscode.Uri.file(lastKnownPath),
			filters: {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'Cupl Code File': ['pld','PLD'],
			}			
		});
		
		var paths = importRoot?.map(pr => pr.fsPath);
		
		if(paths === undefined || paths.length === 0)
		{
			vscode.window.setStatusBarMessage('No path specified', 5000);
			return;
		}
		const pldSourcePath = paths[0];
		const pldNameCapitalized = pldSourcePath.indexOf('.PLD') > 0;
		
		const folderPath = vscode.Uri.file(pldSourcePath.substring(0, pldSourcePath.lastIndexOf(path.sep)));
		const folderName = folderPath.fsPath.substring(folderPath.fsPath.lastIndexOf(path.sep) + 1);
		const projFilePath = pldSourcePath.substring(0,pldSourcePath.lastIndexOf('.')) + '.prj';
		
		if(pathExists(projFilePath)){
			vscode.workspace.updateWorkspaceFolders(0,0, {uri: folderPath, name: folderName});           
			await projectFileProvider.refresh();
			//vscode creates a temporary path for an opened file, so we cannot reference it here.
			// const respOpen = await vscode.window.showWarningMessage('This pld seems to belong to a project. Use the Open Project menu item instead.', 'Open project','Ok');
			// if(respOpen === 'Open project'){
			// 	vscode.commands.executeCommand(openProjectCommand);
			// 	return;
			// }
			return;
		}

        //otherwise create new folder under workspace root, import pld and create prj there

        var project = await createProject(vscode.Uri.parse(projFilePath));

        if (!project) {
            atfOutputChannel.appendLine("Failed to import project!");
            return;
        }

        state.write("last-known-VS-project-path", projFilePath);

        //await vscode.workspace.updateWorkspaceFolders(0, 0,{  uri: project?.projectPath, name: project.projectName});

        //projectFileProvider.setWorkspace(project?.projectPath.path);
        if (pldNameCapitalized) {
            vscode.workspace.fs.copy(
                vscode.Uri.file(pldSourcePath),
                vscode.Uri.file(pldSourcePath.replace(".PLD", ".pld"))
            );
        }
        vscode.workspace.updateWorkspaceFolders(0, 0, {
            uri: project.projectPath,
            name: folderName,
        });
        await projectFileProvider.refresh();
        await stateProjects.refreshOpenProjects();
        stateProjects.updateProject(project);

        await providerChipView.openProjectChipView(project);
        // await vscode.commands.executeCommand("vscode.openFolder", folderUri);
    };

    await context.subscriptions.push(
        vscode.commands.registerCommand(
            openProjectCommandName,
            cmdOpenProjectHandler
        )
    );
}

export async function registerCloseProjectCommand(
    cmdCloseProjectCommand: string,
    context: vscode.ExtensionContext
) {
    const projectFileProvider = await ProjectFilesProvider.instance();
    const cmdCloseProjectHandler = async (
        projectTreeItem: VSProjectTreeItem
    ) => {
        await vscode.workspace.saveAll();
        const folderIndex = vscode.workspace.workspaceFolders?.findIndex(
            (wsp) =>
                wsp.name === projectTreeItem.label ||
                wsp.name === projectTreeItem.project.projectPath.fsPath
        );
        if (folderIndex === undefined || folderIndex < 0) {
            atfOutputChannel.appendLine(
                "Failed to remove workspace folder. Not found in workspace folders!"
            );
            return;
        }
        vscode.workspace.updateWorkspaceFolders(folderIndex, 1);
        await projectFileProvider.refresh();
        await providerChipView.openProjectChipView(undefined);
        if (projectTreeItem) {
            stateProjects.removeProject(projectTreeItem.project);
        }
    };

    await context.subscriptions.push(
        vscode.commands.registerCommand(
            cmdCloseProjectCommand,
            cmdCloseProjectHandler
        )
    );
}

export async function registerDeleteFileCommand(
    deleteFileCommandName: string,
    context: vscode.ExtensionContext
) {
    const projectFileProvider = await ProjectFilesProvider.instance();
    const cmdDeleteFileHandler = async (fileName: VSProjectTreeItem) => {
        var delResp = await vscode.window.showInformationMessage(
            `Are you sure you want to delete ${fileName.file}?`,
            {
                modal: true,
            },
            { title: "Yes", isCloseAffordance: true } as vscode.MessageItem,
            { title: "No", isCloseAffordance: false } as vscode.MessageItem
        );
        // var deleteResponse = await vscode.window.showQuickPick(
        // 	['Yes', 'No'],{canPickMany: false, title:' Delete ' + fileName.label
        // });
        if (!pathExists(fileName.file.fsPath)) {
            await projectFileProvider.refresh();
            return;
        }
        if (delResp !== undefined && delResp.title === "Yes") {
            if (fileName.label.toUpperCase().endsWith(".PLD.")) {
                await backupFile(fileName);
            }
            await vscode.workspace.fs.delete(fileName.file);
        }

        await projectFileProvider.refresh();
    };

    await context.subscriptions.push(
        vscode.commands.registerCommand(
            deleteFileCommandName,
            cmdDeleteFileHandler
        )
    );
}

export async function projectFromTreeItem(
    treeItem: VSProjectTreeItem | vscode.Uri | undefined
) {
    let project: Project | undefined;
    if (!treeItem) {
        return;
    }
    if (treeItem instanceof VSProjectTreeItem) {
        //project = treeItem.project;
        project = stateProjects.getOpenProject(
            vscode.Uri.file(treeItem.project.projectPath.fsPath)
        );
    } else {
        const isFolder =
            (await vscode.workspace.fs.stat(treeItem)).type ===
            vscode.FileType.Directory;
        const isPrjFile = treeItem.fsPath.endsWith(".prj");
        let openPath = isFolder
            ? treeItem.fsPath
            : treeItem.fsPath.substring(0, treeItem.fsPath.lastIndexOf("/"));
        if (
            !isFolder &&
            !isPrjFile &&
            (openPath.endsWith("atmisp") || openPath.endsWith("build"))
        ) {
            openPath = openPath.substring(0, openPath.lastIndexOf("/"));
        }
        project = stateProjects.getOpenProject(vscode.Uri.file(openPath));
    }
    return project;
}
