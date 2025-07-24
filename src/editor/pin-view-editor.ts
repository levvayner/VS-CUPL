import * as vscode from "vscode";
/*
Custom pin layout viewer

*/
export class PinViewEditorProvider implements vscode.CustomTextEditorProvider {
    public static register(
        context: vscode.ExtensionContext
    ): vscode.Disposable {
        vscode.commands.registerCommand(this.pinLayoutView, () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage(
                    "Creating new Paw Draw files currently requires opening a workspace"
                );
                return;
            }

            const activeFile =
                vscode.window.activeTextEditor?.document.fileName;
            if (activeFile) {
                const uri = vscode.Uri.file(`${activeFile}.pins`).with({
                    scheme: "untitled",
                });
                vscode.commands.executeCommand(
                    "vscode.openWith",
                    uri,
                    PinViewEditorProvider.pinLayoutView
                );
            }
            //use tree item
        });

        const provider = new PinViewEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            PinViewEditorProvider.pinLayoutView,
            provider
        );
        return providerRegistration;
    }

    private static readonly pinLayoutView = "vs-cupl.pinLayout.open";

    constructor(private readonly context: vscode.ExtensionContext) {}

    /**
     * Called when our custom editor is opened.
     *
     *
     */
    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Setup initial content for the webview
        webviewPanel.webview.options = {
            enableScripts: true,
        };
        webviewPanel.webview.html = this.getHtmlForWebview(
            webviewPanel.webview,
            document
        );

        function updateWebview() {
            webviewPanel.webview.postMessage({
                type: "update",
                text: document.getText(),
            });
        }

        // Hook up event handlers so that we can synchronize the webview with the text document.
        //
        // The text document acts as our model, so we have to sync change in the document to our
        // editor and sync changes in the editor back to the document.
        //
        // Remember that a single text document can also be shared between multiple custom
        // editors (this happens for example when you split a custom editor)

        const changeDocumentSubscription =
            vscode.workspace.onDidChangeTextDocument((e) => {
                if (e.document.uri.toString() === document.uri.toString()) {
                    updateWebview();
                }
            });

        // Make sure we get rid of the listener when our editor is closed.
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        // Receive message from the webview.
        webviewPanel.webview.onDidReceiveMessage((e) => {
            switch (
                e.type
                // case 'add':
                // 	this.addNewScratch(document);
                // 	return;

                // case 'delete':
                // 	this.deleteScratch(document, e.id);
                // 	return;
            ) {
            }
        });

        updateWebview();
    }

    /**
     * Get the static html used for the editor webviews.
     */
    private getHtmlForWebview(
        webview: vscode.Webview,
        document: vscode.TextDocument
    ): string {
        // Local path to script and css for the webview
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                "assets",
                "css",
                "style.css"
            )
        );

        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                "assets",
                "js",
                "chipView.js"
            )
        );

        // const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
        // 	this.context.extensionUri, 'media', 'vscode.css'));

        // const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
        // 	this.context.extensionUri, 'media', 'catScratch.css'));

        // Use a nonce to whitelist which scripts can be run
        const nonce = getNonce();

        return /* html */ `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${
                    webview.cspSource
                }; style-src ${
            webview.cspSource
        }; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleUri}" rel="stylesheet" />				
				<title>Cat Scratch</title>
			</head>
			<body>
				<div class="notes">
					<div class="text">
					<pre>${document.getText()}</pre></div>
					<div class="add-button">
						<button>Scratch!</button>
					</div>
				</div>
				
				<!--<script nonce="${nonce}" src="${scriptUri}"></script>-->
			</body>
			</html>`;
    }

    // /**
    //  * Add a new scratch to the current document.
    //  */
    // private addPin(document: vscode.TextDocument) {
    // 	const json = this.getDocumentAsPld(document);

    // 	return this.updateTextDocument(document, json);
    // }

    // /**
    //  * Delete an existing scratch from a document.
    //  */
    // private deleteScratch(document: vscode.TextDocument, id: string) {
    // 	const json = this.getDocumentAsPld(document);
    // 	if (!Array.isArray(json.scratches)) {
    // 		return;
    // 	}

    // 	json.scratches = json.scratches.filter((note: any) => note.id !== id);

    // 	return this.updateTextDocument(document, json);
    // }

    /**
     * Try to get a current document as json text.
     */
    // private getDocumentAsPld(document: vscode.TextDocument): any {
    // 	const text = document.getText();
    // 	if (text.trim().length === 0) {
    // 		return {};
    // 	}

    // 	try {
    // 		//TODO: write parser for pld files or use vs code syntax checker
    // 		return text;
    // 	} catch {
    // 		throw new Error('Could not get document as json. Content is not valid json');
    // 	}
    // }

    /**
     * Write out the json to a given document.
     */
    private updateTextDocument(document: vscode.TextDocument, json: any) {
        const edit = new vscode.WorkspaceEdit();

        // Just replace the entire document every time for this example extension.
        // A more complete extension should compute minimal edits instead.
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            JSON.stringify(json, null, 2)
        );

        return vscode.workspace.applyEdit(edit);
    }
}

function getNonce() {
    throw new Error("Function not implemented.");
}
