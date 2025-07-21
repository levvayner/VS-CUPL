import * as vscode from 'vscode';
import { disposeAll } from '../../dispose';
import { TextDecoder, TextEncoder } from 'util';
import { stateProjects } from '../../states/state.projects';
import { updatePLD } from '../../explorer/project-file-functions';
import { Project } from '../../project';
import { pinConfigurations } from '../../devices/pin-configurations';
import { deviceList } from '../../devices/devices';
import { getNonce } from '../../states/stateManager';
import { providerChipView } from '../../editor/chip-view';
import { PLDProjectDocument } from './projectDocument';
import { WebviewCollection } from '../shared/webview.utils';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Provider for PLD Project editors.
 * PLD Project editors are used for `.prj` files.
 */
export class PLDProjectEditorProvider implements vscode.CustomEditorProvider<PLDProjectDocument> {

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		return vscode.window.registerCustomEditorProvider(
			PLDProjectEditorProvider.viewType,
			new PLDProjectEditorProvider(context),
			{
				webviewOptions: {
					retainContextWhenHidden: true,
                    
				},
				supportsMultipleEditorsPerDocument: false,
			});
	}

	public static readonly viewType = 'vs-cupl.projectEditor';

	/**
	 * Tracks all known webviews
	 */
	private readonly webviews = new WebviewCollection();

	constructor(
		private readonly _context: vscode.ExtensionContext
	) { }

	async openCustomDocument(
		uri: vscode.Uri,
		openContext: { backupId?: string },
		_token: vscode.CancellationToken
	): Promise<PLDProjectDocument> {
		const document: PLDProjectDocument = await PLDProjectDocument.create(uri, openContext.backupId, {
			getFileData: async () => {
                return  new TextEncoder().encode(JSON.stringify(document.workingCopy, null, 4));
			}
		});

		const listeners: vscode.Disposable[] = [];

		listeners.push(document.onDidChange(e => {
			// Tell VS Code that the document has been edited by the use.
			this._onDidChangeCustomDocument.fire({
				document,
				...e,
			});
		}));

		listeners.push(document.onDidChangeContent(e => {
			// Update all webviews when the document changes
			for (const webviewPanel of this.webviews.get(document.uri)) {
                console.log('Updating document ' + document.uri);
				this.postMessage(webviewPanel, 'update', {
					edits: e.edits,
					content: e.content,
				});
			}
		}));

        document.onDidDispose(async () => {
             disposeAll(listeners);
        });

		return document;
	}

	async resolveCustomEditor(
		document: PLDProjectDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		// Add the webview to our internal set of active webviews
		this.webviews.add(document.uri, webviewPanel);

		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
            localResourceRoots: [
                this._context.extensionUri,
                vscode.Uri.joinPath(this._context.extensionUri, 'assets','css'), 
                vscode.Uri.joinPath(this._context.extensionUri, 'src','modules','projct-configurator'),
            ],
		};
       
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        webviewPanel.onDidChangeViewState(editor => {
            if(editor.webviewPanel.active){
                const project = stateProjects.getOpenProject(document.uri);
                if(project === undefined){
                    return;
                }
                project.device = document.workingCopy;
                providerChipView.openProjectChipView(project);
            }            
        });

		webviewPanel.webview.onDidReceiveMessage(e => this.onMessage(document, e));

		// Wait for the webview to be properly ready before we init
		webviewPanel.webview.onDidReceiveMessage(async(message) => {
			if (message.type === 'ready') {
				this.initializeDocument(webviewPanel, document);
			}else if(message.type === 'update'){                
                const editable = vscode.workspace.fs.isWritableFileSystem(document.uri.scheme);
                document.update(message.data.id, message.data.value);
            }            
            else if (message.type === 'save'){
                const customCancellationToken = new vscode.CancellationTokenSource();
                const token = customCancellationToken.token;
                document.save(token);
                this.initializeDocument(webviewPanel, document);
            }
		});
	}

    public async initializeDocument(webviewPanel: vscode.WebviewPanel, document: PLDProjectDocument){
        if (document.uri.scheme === 'untitled') {
            this.postMessage(webviewPanel, 'error', {text: `File System is not writable at ${document.uri.fsPath}. Cannot create project here.`});
        } else {
            const editable = vscode.workspace.fs.isWritableFileSystem(document.uri.scheme);
            const project = await Project.openProject(document.uri);
            providerChipView.openProjectChipView(project);
            this.postMessage(webviewPanel, 'initialize', { pinConfigurations:pinConfigurations, deviceList: deviceList, project: project});                    
        }
    }

	private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<PLDProjectDocument>>();
	public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

	public saveCustomDocument(document: PLDProjectDocument, cancellation: vscode.CancellationToken): Thenable<void> {
		return document.save(cancellation);
	}
    public saveCustomDocumentAs(document: PLDProjectDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
		return document.saveAs(destination, cancellation);
	}
    public revertCustomDocument(document: PLDProjectDocument, cancellation: vscode.CancellationToken): Thenable<void> {
		return document.revert(cancellation);
	}

	public backupCustomDocument(document: PLDProjectDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
		return document.backup(context.destination, cancellation);
	}


	//#endregion

	/**
	 * Get the static HTML used for in our editor's webviews.
	 */
	private getHtmlForWebview(webview: vscode.Webview): string {
		// Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(this._context.extensionUri, "assets", "js", "projectConfigurator.js");

        // And the uri we use to load this script in the webview
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

        // Local path to css styles
        const styleResetPath = vscode.Uri.joinPath(this._context.extensionUri, 'media', 'reset.css');
        const stylesPathMainPath = vscode.Uri.joinPath(this._context.extensionUri, 'media', 'vscode.css');

        // Uri to load styles into webview
        const stylesResetUri = webview.asWebviewUri(styleResetPath);
        const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);

        const styleVSCodeUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._context.extensionUri,
                "assets",
                "css",
                "vscode.css"
            )
        );
		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();
        const htmlPath = this._context.asAbsolutePath(path.join( 'assets', 'html', 'project-configurator',  'project.html')); // Adjust path
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');
        

        htmlContent = htmlContent.replaceAll("${webview.cspSource}",webview.cspSource);
        htmlContent = htmlContent.replaceAll("${stylesResetUri}",stylesResetUri.toString());
        htmlContent = htmlContent.replaceAll("${styleVSCodeUri}",styleVSCodeUri.toString());
        htmlContent = htmlContent.replaceAll("${stylesMainUri}",stylesMainUri.toString());
        htmlContent = htmlContent.replaceAll("${scriptUri}",scriptUri.toString());
        htmlContent = htmlContent.replaceAll("${nonce}",nonce);
        
        return htmlContent;

		return /* html */`
			`;
	}

	private _requestId = 1;
	private readonly _callbacks = new Map<number, (response: any) => void>();

	private postMessageWithResponse<R = unknown>(panel: vscode.WebviewPanel, type: string, body: any): Promise<R> {
		const requestId = this._requestId++;
		const p = new Promise<R>(resolve => this._callbacks.set(requestId, resolve));
		panel.webview.postMessage({ type, requestId, body });
		return p;
	}

	private postMessage(panel: vscode.WebviewPanel, type: string, body: any): void {
		panel.webview.postMessage({ type, body });
	}

	private async onMessage(document: PLDProjectDocument, message: any) {
		switch (message.type) {
            case 'alert':
                vscode.window.showErrorMessage(message.text);
                return;
            case 'refresh':
                const project = await Project.openProject(document.uri);
                const panel = Array.from(this.webviews.get(document.uri))[0];
                providerChipView.openProjectChipView(project);
                if(panel === undefined || panel === null){
                    throw new Error('Could not find webview to refresh');                    
                }
                this.postMessage(panel, 'initialize', { pinConfigurations:pinConfigurations, deviceList: deviceList, project: project});
                return;
            case 'update':{
                //const projectConfig = JSON.stringify( message.data, null, 4);
                // document.update(message.data);
                document.update(message.data.id, message.data.value);
                const project = await Project.openProject(document.uri);
                const deviceData = document.workingCopy;
                if(project !== undefined && message.data.id === 'pinConfiguration'){
                    project.device = deviceData;
                    providerChipView.openProjectChipView(project);
                }
                //await this.updateProjectFile(document, projectConfig);
                break;
            }
            case 'save':{
                const projectConfig = JSON.stringify( message.data, null, 4);
                // document.update(message.data);
                await  this.updateProjectFile(document, projectConfig);

               
                const encodedConfig = new TextEncoder().encode(projectConfig);
                const workingProject = stateProjects.openProjects.find(p => p.projectName === message.data.projectName);
                if(workingProject !== undefined){
                    vscode.workspace.fs.writeFile(
                        workingProject.prjFilePath,
                        encodedConfig
                    );
                    //reload project
                    workingProject.device = message.data;                            
                    updatePLD(workingProject);
                    providerChipView.openProjectChipView(workingProject);
                }     
                break;  
            }
			case 'response':
            {
                const callback = this._callbacks.get(message.requestId);
                callback?.(message.body);
                return;
            }
		}
	}


    private async updateProjectFile(document: PLDProjectDocument, json: any){
        const edit = new vscode.WorkspaceEdit();        
        const projectConfig = new TextDecoder('utf-8').decode(document.documentData);
        // Just replace the entire document every time for this example extension.
        // A more complete extension should compute minimal edits instead.
        const lines =  Array.from(projectConfig).filter(c => c === '\n').length + 1;
       edit.replace(
            document.uri,
            new vscode.Range(0, 0,lines, projectConfig.length - projectConfig.lastIndexOf('\n')),
            json);

        return await vscode.workspace.applyEdit(edit);
    }
}
