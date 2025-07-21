import * as vscode from "vscode";
import { Project } from "../project";
import { stateProjects } from "../states/state.projects";
import { atfOutputChannel } from "../os/command";
import { configureProjectCommand } from "../vs.commands";
import { extensionState } from "../states/state.global";
import { providerChipView } from "./chip-view";
/*
Active project panel
*/
export let providerActiveProject: ActiveProjectProvider;

export function registerActiveProjectPanelProvider(
    context: vscode.ExtensionContext
) {
    providerActiveProject = new ActiveProjectProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ActiveProjectProvider.viewType,
            providerActiveProject
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("vs-cupl.showActiveProject", () => {
            providerActiveProject.show();
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(
            providerActiveProject.checkActiveProjectForDocument
        ),
        vscode.workspace.onDidChangeWorkspaceFolders(
            providerActiveProject.checkActiveProjectForWorkspaceFolder
        ),
        vscode.window.onDidChangeActiveTextEditor(
            providerActiveProject.checkActiveProjectForTextEditor
        ),
        vscode.window.onDidChangeWindowState(
            providerActiveProject.checkActiveProjectForWindowState
        ),
        // vscode.workspace.onDidChangeConfiguration(
        //     (e: vscode.ConfigurationChangeEvent) => {
               
        //     }
        // )
    );
}

export class ActiveProjectProvider implements vscode.WebviewViewProvider {
    show() {
        this._view?.show();
    }

    public static readonly viewType = "vs-cupl.active-project-view";

    private _view?: vscode.WebviewView;
    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,

            localResourceRoots: [this._extensionUri],
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((message) => {
            if (message.type === "configureProject") {
                console.log(`[Configure Project] `);
                vscode.commands.executeCommand(
                    configureProjectCommand,
                    extensionState.activeProject?.projectPath
                );
                return;
            }
        });
    }

    private setProject(project: Project | undefined) {
        if (this._view) {
            this._view.show?.(true);
            if (project === undefined) {
                this._view.webview.postMessage({ type: "clearProject" });
            } else {
                this._view.webview.postMessage({ type: "setProject", project });
            }
        }
    }

    public openProjectActiveProject(project: Project | undefined) {
        if (project === undefined) {
            //extensionState.setActiveProject(undefined);
            this.setProject(undefined);
            return;
        }
        if (project.devicePins) {
            const pins = project.devicePins;
            if (pins) {
                //extensionState.setActiveProject(project);
                this.setProject(project);
                providerChipView.openProjectChipView(project);
            } else {
                atfOutputChannel.appendLine(
                    `Noproject found for device ${project.device?.pinConfiguration} with ${project.device?.pinCount} pins in a ${project.device?.packageType} package.`
                );
            }
        }
    }

    checkActiveProjectForDocument(e: vscode.TextDocument) {
        // if(!(e.fileName.endsWith('prj') || e.fileName.endsWith('.pld'))){
        //     return;
        // }
        const project = stateProjects.getOpenProject(
            vscode.Uri.file(e.fileName)
        );
        if (project === undefined || !project.deviceName) {
            return;
        }
        if (project.devicePins === undefined) {
            return;
        }
        extensionState.setActiveProject(project);
    }

    checkActiveProjectForWorkspaceFolder(
        workspaceFolderEvent: vscode.WorkspaceFoldersChangeEvent
    ) {
        if (
            workspaceFolderEvent.added &&
            workspaceFolderEvent.added.length > 0
        ) {
            const project = stateProjects.openProjects.find(
                (p) => p.projectPath === workspaceFolderEvent.added[0].uri
            );
            if (project === undefined) {
                return;
            }
            extensionState.setActiveProject(project);
        } else if (
            workspaceFolderEvent.removed &&
            workspaceFolderEvent.removed.length > 0
        ) {
            const project = stateProjects.openProjects.find(
                (p) => p.projectPath === workspaceFolderEvent.removed[0].uri
            );
            if (project === undefined) {
                return;
            }
            //TODO: check if selected Active Project View is of this project
            extensionState.setActiveProject(project);
        }
    }

    checkActiveProjectForTextEditor(editor: vscode.TextEditor | undefined) {
        if (editor === undefined) {
            //extensionState.setActiveProject(undefined);
            return;
        }
        //if(editor.document.fileName.endsWith('.prj') ||editor.document.fileName.endsWith('.pld') ){
        //const project = stateProjects.openProjects.find(p => p.projectPath.fsPath === editor.document.fileName.substring(editor.document.fileName.lastIndexOf(path.sep)));
        const project = stateProjects.getOpenProject(
            vscode.Uri.file(editor.document.fileName)
        );
        if(project !== undefined){
            extensionState.setActiveProject(project);
        }
        //}
    }

    checkActiveProjectForWindowState(windowState: vscode.WindowState) {
        if (windowState.focused) {
            const e = vscode.window.activeTextEditor?.document;
            if (!e) {
                return;
            }
            // if(!(e.fileName.endsWith('prj') || e.fileName.endsWith('.pld'))){
            // 	return;
            // }
            const project = stateProjects.getOpenProject(
                vscode.Uri.file(e.fileName)
            );
            if (project === undefined || !project.deviceName) {
                return;
            }
            if (project.devicePins === undefined) {
                return;
            }
            extensionState.setActiveProject(project);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                "assets",
                "js",
                "active-project.js"
            )
        );

        // Do the same for the stylesheet.
        const styleResetUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                "assets",
                "css",
                "reset.css"
            )
        );
        const styleVSCodeUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                "assets",
                "css",
                "vscode.css"
            )
        );
        const styleMainUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                "assets",
                "css",
                "style.css"
            )
        );

        // Use a nonce to only allow a specific script to be run.
        const nonce = getNonce();

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading styles from our extension directory,
					and only allow scripts that have a specific nonce.
					(See the 'webview-sample' extension sample for img-src content security policy examples)
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">

				<title>Active Project View</title>
			</head>
			<body id='active-project-panel'>
				<div class='row'>
                    <div class='title'>Project</div>
                    <div class='project-name'></div>
                </div>
                <div class='row'>
                    <div class='title'>Socket</div>
                    <div class='project-socket'></div>
                </div>
                <div class='row'>
                    <div class='title'>Manufacturer</div>
                    <div class='project-manufacturer'></div>
                </div>
                <div class='row'>
                    <div class='title'>Device Name</div>
                    <div class='project-device-name'></div>
                </div>
                <div class='row'>
                    <div class='title'>Device Code</div>
                    <div class='project-device-code'></div>
                </div>
                <div class='row'>
                    <div class='title'>Device Pin Offset</div>
                    <div class='project-pin-offset'></div>
                </div>
                
				<div><button id='configure-project-button'>Configure</button>
				<script nonce="${nonce}" src="${scriptUri}"></script>				
			</body>
			</html>`;
    }
}

function getNonce() {
    let text = "";
    const possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
