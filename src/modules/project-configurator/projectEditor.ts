import * as vscode from 'vscode';
import { Disposable, disposeAll } from '../../dispose';
import { TextDecoder, TextEncoder } from 'util';
import { stateProjects } from '../../states/state.projects';
import { updatePLD } from '../../explorer/project-file-functions';
import { Project } from '../../project';
import { pinConfigurations } from '../../devices/pin-configurations';
import { deviceList } from '../../devices/devices';
import { getNonce } from '../../states/stateManager';

/**
 * Define the type of edits used in PLD Project files.
 */
// interface PawDrawEdit {
// 	readonly color: string;
// 	readonly stroke: ReadonlyArray<[number, number]>;
// }

interface PLDProjectDocumentDelegate {
	getFileData(): Promise<Uint8Array>;
}

/**
 * Define the document (the data model) used for PLD Project files.
 */
class PLDProjectDocument extends Disposable implements vscode.CustomDocument {

	static async create(
		uri: vscode.Uri,
		backupId: string | undefined,
		delegate: PLDProjectDocumentDelegate,
	): Promise<PLDProjectDocument | PromiseLike<PLDProjectDocument>> {
		// If we have a backup, read that. Otherwise read the resource from the workspace
		const dataFile = typeof backupId === 'string' ? vscode.Uri.parse(backupId) : uri;
		const fileData = await PLDProjectDocument.readFile(dataFile);
		return new PLDProjectDocument(uri, fileData, delegate);
	}

	private static async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		if (uri.scheme === 'untitled') {
			return new Uint8Array();
		}
		return new Uint8Array(await vscode.workspace.fs.readFile(uri));
	}

	private readonly _uri: vscode.Uri;

	private _documentData: Uint8Array;
	private _edits: Project[] = [];
	// private _savedEdits: PawDrawEdit[] = [];

	private readonly _delegate: PLDProjectDocumentDelegate;

	private constructor(
		uri: vscode.Uri,
		initialContent: Uint8Array,
		delegate: PLDProjectDocumentDelegate
	) {
		super();
		this._uri = uri;
		this._documentData = initialContent;
		this._delegate = delegate;
	}

	public get uri() { return this._uri; }

	public get documentData(): Uint8Array { return this._documentData; }

	private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
	/**
	 * Fired when the document is disposed of.
	 */
	public readonly onDidDispose = this._onDidDispose.event;

	private readonly _onDidChangeDocument = this._register(new vscode.EventEmitter<{
		readonly content?: Uint8Array;
		readonly edits: readonly Project[];
	}>());
	/**
	 * Fired to notify webviews that the document has changed.
	 */
	public readonly onDidChangeContent = this._onDidChangeDocument.event;

	private readonly _onDidChange = this._register(new vscode.EventEmitter<{
		readonly label: string,
		undo(): void,
		redo(): void,
	}>());
	/**
	 * Fired to tell VS Code that an edit has occurred in the document.
	 *
	 * This updates the document's dirty indicator.
	 */
	public readonly onDidChange = this._onDidChange.event;

	/**
	 * Called by VS Code when there are no more references to the document.
	 *
	 * This happens when all editors for it have been closed.
	 */
	dispose(): void {
		this._onDidDispose.fire();
		super.dispose();
	}

    async update(data: Uint8Array){
        this._documentData = data;
    }

	/**
	 * Called by VS Code when the user saves the document.
	 */
	async save(cancellation: vscode.CancellationToken): Promise<void> {
		await this.saveAs(this.uri, cancellation);
		//this._savedEdits = Array.from(this._edits);
	}
    /**
	 * Called by VS Code when the user saves the document to a new location.
	 */
	async saveAs(targetResource: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
		const fileData = await this._delegate.getFileData();
        const json = JSON.parse( new TextDecoder('utf-8').decode(fileData));
		if (cancellation.isCancellationRequested) {
			return;
		}
		await vscode.workspace.fs.writeFile(targetResource, json);
	}

    /**
	 * Called by VS Code when the user calls `revert` on a document.
	 */
	async revert(_cancellation: vscode.CancellationToken): Promise<void> {
		const diskContent = await PLDProjectDocument.readFile(this.uri);
		this._documentData = diskContent;
		//this._edits = this._savedEdits;
		this._onDidChangeDocument.fire({
			content: diskContent,
			edits: this._edits,
		});
	}

	/**
	 * Called by VS Code to backup the edited document.
	 *
	 * These backups are used to implement hot exit.
	 */
	async backup(destination: vscode.Uri, cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
		await this.saveAs(destination, cancellation);

		return {
			id: destination.toString(),
			delete: async () => {
				try {
					await vscode.workspace.fs.delete(destination);
				} catch {
					// noop
				}
			}
		};
	}
}

/**
 * Provider for PLD Project editors.
 * PLD Project editors are used for `.prj` files.
 */
export class PLDProjectEditorProvider implements vscode.CustomEditorProvider<PLDProjectDocument> {

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		// vscode.commands.registerCommand('catCustoms.prj.new', () => {
		// 	const workspaceFolders = vscode.workspace.workspaceFolders;
		// 	if (!workspaceFolders) {
		// 		vscode.window.showErrorMessage("Creating new PLD Project files currently requires opening a workspace");
		// 		return;
		// 	}

		// 	const uri = vscode.Uri.joinPath(workspaceFolders[0].uri, `new-${PLDProjectEditorProvider.newPawDrawFileId++}.prj`)
		// 		.with({ scheme: 'untitled' });

		// 	vscode.commands.executeCommand('vscode.openWith', uri, PLDProjectEditorProvider.viewType);
		// });

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

	//#region CustomEditorProvider

	async openCustomDocument(
		uri: vscode.Uri,
		openContext: { backupId?: string },
		_token: vscode.CancellationToken
	): Promise<PLDProjectDocument> {
		const document: PLDProjectDocument = await PLDProjectDocument.create(uri, openContext.backupId, {
			getFileData: async () => {
				const webviewsForDocument = Array.from(this.webviews.get(document.uri));
				if (!webviewsForDocument.length) {
					throw new Error('Could not find webview to save for');
				}
				const panel = webviewsForDocument[0];
				const response = await this.postMessageWithResponse<number[]>(panel, 'getFileData', {});
				return new Uint8Array(response);
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
            const storedData = await vscode.workspace.fs.readFile(document.uri);
            const editingData = document.documentData;
            const isModified = !(storedData.length === editingData.length && storedData.every((sd, idx) => editingData[idx] === sd));
            if(isModified === true){
                vscode.window
                .showInformationMessage(`You have unsaved changes in ${document.uri.fsPath}\nDo you want to save before closing?`, "Yes", "No")
                .then(async(answer) => {
                    if (answer === "Yes") {
                       //await vscode.workspace.fs.writeFile(document.uri, document.documentData);
                        const customCancellationToken = new vscode.CancellationTokenSource();
                        const token = customCancellationToken.token;
                        document.save(token);
                    }
                    disposeAll(listeners);
                });            
            }
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
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		webviewPanel.webview.onDidReceiveMessage(e => this.onMessage(document, e));

		// Wait for the webview to be properly ready before we init
		webviewPanel.webview.onDidReceiveMessage(async(message) => {
			if (message.type === 'ready') {
				if (document.uri.scheme === 'untitled') {
					this.postMessage(webviewPanel, 'error', {text: `File System is not writable at ${document.uri.fsPath}. Cannot create project here.`});
				} else {
					const editable = vscode.workspace.fs.isWritableFileSystem(document.uri.scheme);
                    const project = await Project.openProject(document.uri);
					this.postMessage(webviewPanel, 'initialize', { pinConfigurations:pinConfigurations, deviceList: deviceList, project: project});
				}
			}else if(message.type === 'update'){
                const projectConfig = JSON.stringify( message.data, null, 4);
                const encodedConfig = new TextEncoder().encode(projectConfig);
                
                //const editable = vscode.workspace.fs.isWritableFileSystem(document.uri.scheme);
                document.update(encodedConfig);
                // this.postMessage(webviewPanel, 'update', {
                //     value: document.documentData,
                //     editable,
                // });
            }            
            else if (message.type === 'save'){
                const projectConfig = JSON.stringify( message.data, null, 4);
                const buffer = Buffer.from(projectConfig, "utf-8");
                //const encodedConfig = new TextEncoder().encode( projectConfig);
                const workingProject = stateProjects.getOpenProject(document.uri);
                if(workingProject !== undefined){
                    await vscode.workspace.fs.writeFile(
                        workingProject.prjFilePath,
                        buffer
                    );
                    //reload project
                    workingProject.device = message.data;                            
                    updatePLD(workingProject);
                    this.postMessage(webviewPanel, 'initialize', { pinConfigurations:pinConfigurations, deviceList: deviceList, project: workingProject});                
                }
            }
		});
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

		return /* html */`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${stylesResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${stylesMainUri}" rel="stylesheet">	

				<title>PLD Project</title>
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
                        <div id="pendingChanges">
                            * You have pending changes
                        </div>
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
                if(panel === undefined || panel === null){
                    throw new Error('Could not find webview to refresh');                    
                }
                this.postMessage(panel, 'initialize', { pinConfigurations:pinConfigurations, deviceList: deviceList, project: project});
                return;
            case 'update':{
                 const projectConfig = JSON.stringify( message.data, null, 4);
                await this.updateProjectFile(document, projectConfig);
                break;
            }
            case 'save':{
                 const projectConfig = JSON.stringify( message.data, null, 4);
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

    // private getDocumentAsJson(document: vscode.TextDocument): any {
	// 	const text = document.getText();
	// 	if (text.trim().length === 0) {
	// 		return {};
	// 	}

	// 	try {
	// 		return JSON.parse(text);
	// 	} catch {
	// 		throw new Error('Could not get document as json. Content is not valid json');
	// 	}
	// }

    private async updateProjectFile(document: PLDProjectDocument, json: any){
        const edit = new vscode.WorkspaceEdit();        
        const projectConfig = new TextDecoder('utf-8').decode(document.documentData);
        // Just replace the entire document every time for this example extension.
        // A more complete extension should compute minimal edits instead.
        const lines =  Array.from(projectConfig).filter(c => c === '\n').length;
        edit.replace(
            document.uri,
            new vscode.Range(0, 0,lines, 0),
            JSON.stringify(json, null, 2));

        return await vscode.workspace.applyEdit(edit);
    }
}

/**
 * Tracks all webviews.
 */
class WebviewCollection {

	private readonly _webviews = new Set<{
		readonly resource: string;
		readonly webviewPanel: vscode.WebviewPanel;
	}>();

	/**
	 * Get all known webviews for a given uri.
	 */
	public *get(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
		const key = uri.toString();
		for (const entry of this._webviews) {
			if (entry.resource === key) {
				yield entry.webviewPanel;
			}
		}
	}

	/**
	 * Add a new webview to the collection.
	 */
	public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
		const entry = { resource: uri.toString(), webviewPanel };
		this._webviews.add(entry);

		webviewPanel.onDidDispose(() => {
			this._webviews.delete(entry);
		});
	}
}
