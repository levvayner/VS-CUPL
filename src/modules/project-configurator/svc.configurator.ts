import * as vscode from 'vscode';
import { pinConfigurations } from '../../devices/pin-configurations';
import { deviceList } from '../../devices/devices';
import { extensionState } from '../../states/state.global';
import { TextEncoder } from 'util';
import { Project } from '../../project';
import { stateProjects } from '../../states/state.projects';
import { updatePLD } from '../../explorer/project-file-functions';

// enum ProjectViewType{
//     projectConfiguration = 1
// }

const pageTemplates = {
    'projectConfiguration': 'assets/html/projectConfiguration.html'    
};

export function activateConfigurator(context: vscode.ExtensionContext){

	if (vscode.window.registerWebviewPanelSerializer) {
		// Make sure we register a serializer in activation event
		vscode.window.registerWebviewPanelSerializer(ProjectCreatePanel.viewType, {
			async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: unknown) {
				console.log(`Got state: ${state}`);
				// Reset the webview options so we use latest uri for `localResourceRoots`.
				webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
				ProjectCreatePanel.revive(webviewPanel, context.extensionUri);
			}
		});
	}
}

function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
	return {
		// Enable javascript in the webview
		enableScripts: true,

		// And restrict the webview to only loading content from our extension's `assets` directory.
		localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'assets')]
	};
}

/* Manages Project Creaton Panel. Can have one active. */
export class ProjectCreatePanel{

    public static newProjectPanel : ProjectCreatePanel | undefined;
    public static openProjectPanels : ProjectCreatePanel[]  = [];

    public static readonly viewType = 'createCuplProject';

    private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, project: Project) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

        let activePanel : vscode.WebviewPanel;
        //if new project, create panel
        if(project === undefined){
            // Otherwise, create a new panel.
            activePanel = vscode.window.createWebviewPanel(
                ProjectCreatePanel.viewType,
                'New Project',
                column || vscode.ViewColumn.One,
                getWebviewOptions(extensionUri),
            );
            ProjectCreatePanel.newProjectPanel = new ProjectCreatePanel(activePanel, extensionUri);
            activePanel.webview.postMessage({ type: "initialize", data: {pinConfigurations:pinConfigurations, deviceList: deviceList}});        
        }else{
            //check if we already have the window, if so show it
            const existingPanel = this.openProjectPanels.find(pa => pa._panel.title === project.projectName);
            if(existingPanel !== undefined){
                existingPanel._panel.reveal(column);
            }
            else{
                activePanel = vscode.window.createWebviewPanel(
                    ProjectCreatePanel.viewType,
                    project.projectName,
                    column || vscode.ViewColumn.One,
                    getWebviewOptions(extensionUri),
                );
                const newPanel = new ProjectCreatePanel(activePanel, extensionUri);
                this.openProjectPanels.push(newPanel);
                activePanel.webview.postMessage({ type: "initialize", data: {pinConfigurations:pinConfigurations, deviceList: deviceList, project: project}});        
                activePanel.onDidDispose(() =>{
                    activePanel.onDidDispose(() =>{
                    const idx = ProjectCreatePanel.openProjectPanels.indexOf(newPanel);
                    ProjectCreatePanel.openProjectPanels.splice(idx,1);
                });
                });
            }
            
        }
    }

	    

	public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		ProjectCreatePanel.newProjectPanel = new ProjectCreatePanel(panel, extensionUri);
	}

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			() => {
				if (this._panel.visible) {
					this._update();
				}
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(async(message)			=> {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
                    case 'refresh':
                        this._update();
                        const project = stateProjects.openProjects.find(p => p.projectName === message.data);
                        panel.webview.postMessage({ type: "initialize", data: {pinConfigurations:pinConfigurations, deviceList: deviceList, project: project}});
                        return;
                    case 'save':
                        const projectConfig = JSON.stringify( message.data, null, 4);
                        const encodedConfig = new TextEncoder().encode(projectConfig);
                        const workingProject = stateProjects.openProjects.find(p => p.projectName === message.data.projectName);
                        if(workingProject !== undefined){
                            await vscode.workspace.fs.writeFile(
                                workingProject.prjFilePath,
                                encodedConfig
                            );
                            updatePLD(message.data);
                        }
                        
                        
				}
			},
			null,
			this._disposables
		);
	}


    public postMessage(message: string, control: string) {
		// Send a message to the webview webview.
		// You can send any JSON serializable data.
		this._panel.webview.postMessage({ command: control, message });
	}

	public dispose() {
		ProjectCreatePanel.newProjectPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update() {
		const webview = this._panel.webview;
        this._updatePanel(webview);
    }

	private _updatePanel(webview: vscode.Webview) {
		
		this._panel.webview.html = this._getHtmlForWebview(webview, 'projectConfiguration');
	}

	private _getHtmlForWebview(webview: vscode.Webview, htmlTemplatePath: string) {
		// Local path to main script run in the webview
		const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, "assets", "js", "projectConfigurator.js");

		// And the uri we use to load this script in the webview
		const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

		// Local path to css styles
		const styleResetPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css');
		const stylesPathMainPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css');

		// Uri to load styles into webview
		const stylesResetUri = webview.asWebviewUri(styleResetPath);
		const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);

        const styleVSCodeUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                "assets",
                "css",
                "vscode.css"
            )
        );

		// Use a nonce to only allow specific scripts to be run
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Project Configuration</title>
				<link href="${stylesResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${stylesMainUri}" rel="stylesheet">				
			</head>
			<body>
                
                <div class="wide">
                    <div class="header-row">
                        <div id="projectName">
                        </div>
                    </div>
                    <div class="data-row">
                        <div class="data-title">
                            <b>Manufacturer</b>
                        </div>
                        <div class="data-entry">
                            <select id="deviceManufacturer" onChange="webViewHandleClickEvent" >
                            </select>
                        </div>
                    </div>
                    <div class="data-row">
                        <div class="data-title">
                            <b>Socket</b>
                        </div>
                        <div class="data-entry">
                            <select id="deviceSocket" onChange="webViewHandleClickEvent" >
                            </select>
                        </div>
                    </div>       
                    <div class="data-row">
                        <div class="data-title">
                            <b>Pins</b>
                        </div>
                        <div class="data-entry">
                            <select id="devicePinCount" onChange="webViewHandleClickEvent" >
                            </select>
                        </div>
                    </div>
                    <div class="data-row">
                        <div class="data-title">
                            <b>Model</b>
                        </div>
                        <div class="data-entry">
                            <select id="deviceModel" onChange="webViewHandleClickEvent" >
                            </select>
                        </div>
                    </div>
                    <div class="data-row">
                        <div class="data-title">
                            <b>Configuration</b>
                        </div>
                        <div class="data-entry">
                            <select id="deviceConfiguration" onChange="webViewHandleClickEvent" >
                            </select>
                        </div>
                    </div>
                    
                    <br/>

                    <div class="data-row">
                        <div class="data-title">
                            <b>Device Name</b>
                        </div>
                        <div class="data-entry">
                            <input readonly id="deviceName" />
                        </div>
                    </div>
                    <div class="data-row">
                        <div class="data-title">
                            <b>Device Code</b>
                        </div>
                        <div class="data-entry">
                            <input readonly id="deviceCode" />
                        </div>
                    </div>
                    <div class="data-row">
                        <div class="data-title">
                            <b>Pin Offset</b>
                        </div>
                        <div class="data-entry">
                            <input readonly id="pinOffset" />
                        </div>
                    </div>

                    <div class="action-row">
                        <div class="button">
                            <input type="button" id="clear" value="Clear" />
                        </div>
                         <div class="button">
                            <input type="button" id="refresh" value="Reset" />
                        </div>
                        <div class="button">
                            <input type="button" id="save" value="Save" />
                        </div>
                    </div>
                </div>
                <div id="errorPanel"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
