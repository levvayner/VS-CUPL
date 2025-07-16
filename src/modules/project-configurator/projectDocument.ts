import * as vscode from 'vscode';
import { Disposable } from '../../dispose';
import { DeviceConfiguration } from '../../devices/devices';
import { Project } from '../../project';
import { TextDecoder } from 'util';
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
export class PLDProjectDocument extends Disposable implements vscode.CustomDocument {

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

    private _workingCopy: DeviceConfiguration;

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
        this._workingCopy = JSON.parse(new TextDecoder('utf-8').decode(initialContent));
    }

    public get uri() { return this._uri; }

    public get documentData(): Uint8Array { return this._documentData; }
    public get workingCopy(): DeviceConfiguration { return this._workingCopy; }

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

    // async update(data: Uint8Array){
    //     this._documentData = data;
    // }
    async update(field: string, value: string){
        this._workingCopy[field] = value;
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
        if (cancellation.isCancellationRequested) {
            return;
        }
        await vscode.workspace.fs.writeFile(targetResource, fileData);
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
