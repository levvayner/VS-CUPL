import * as vscode from "vscode";
import {
    Pin,
    PinConfiguration,
    getDevicePins,
} from "../devices/pin-configurations";
import { providerChipView } from "./chip-view";
import { Project } from "../project";
import { deviceList } from "../devices/devices";
import { extensionState } from "../states/state.global";
/*
Custom pin layout viewer

*/
export let providerPinView: PinViewProvider;
export function registerPinViewPanelProvider(context: vscode.ExtensionContext) {
    providerPinView = new PinViewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            PinViewProvider.viewType,
            providerPinView
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("vs-cupl.selectPin", (pin: number) => {
            providerPinView.selectPin(pin);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "vs-cupl.setPins",
            (pins: PinConfiguration) => {
                providerPinView.setPins(pins);
            }
        )
    );

    vscode.workspace.onDidOpenTextDocument(
        providerPinView.checkIfPinsAreNeeded
    );
    // providerPinView.setPins(pins);
}
export class PinViewProvider implements vscode.WebviewViewProvider {
    setColors(colors: { type: string; color: string }[]) {
        if (this._view) {
            this._view.show?.(true);
            this._view.webview.postMessage({ message: "colors", colors });
        }
    }

    public static readonly viewType = "vs-cupl.pin-view";

    public pins = [] as Pin[];
    public selectedPin : number | undefined;

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
        this._view.onDidChangeVisibility(() => {
            if(this._view?.visible && extensionState.activeProject !== undefined){
                webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
                providerPinView.setPins(extensionState.activeProject?.devicePins);
                providerPinView.setColors(providerChipView.colors);
                if(this.selectedPin !== undefined)
                {
                    providerPinView.selectPin(this.selectedPin);
                }
            }            
        });


        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((data) => {
            const pin = data.value as Pin;
            switch (data.type) {
                case "pinSelected":
                    //console.log(`[Pin View] Pin Selected ${pin.pin}`);
                    this.selectedPin = pin.pin;
                    providerChipView.selectPin(pin);
                    //TODO: implement select pin (show on chip view as selected)
                    //vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
                    break;
                case "pinPreview":
                    //console.log(`[Pin View] Pin Preview ${pin.pin}`);
                    providerChipView.previewPin(pin);
                    //TODO: implement select pin (show on chip view as selected)
                    //vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
                    break;
                case "addPin":
                    providerChipView.addPin(data.pin.pin, data.pin.pinType);
            }
        });
    }

    public selectPin(pin: number) {
        if (this._view) {
            this._view.show?.(true);
            this._view.webview.postMessage({ message: "selectPin", pin: pin });
            this.selectedPin = pin;
        }
    }
    public setPins(pins: PinConfiguration | undefined) {
        this.pins = pins?.pins ?? [];
        if (this._view) {
            this._view.show?.(true);
            this._view.webview.postMessage({
                message: "setPins",
                pins: pins?.pins ?? undefined,
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        //const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'assets', 'js',  'main.js'));
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "assets", "js", "pinView.js")
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

				<title>Pin View</title>
			</head>
			<body>
                <div class="pin-header">
                    <div>Pin</div>
                    <div>Signals</div>
                </div>
				<div class="pin-list">				
				</div>
				

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }

    async checkIfPinsAreNeeded(e: vscode.TextDocument) {
        let name = e.fileName.replace(".git", "");
        if (
            !(
                name.endsWith("prj") ||
                name.endsWith(".pld") ||
                name.endsWith(".jed")
            )
        ) {
            return;
        }
        const project = await Project.openProject(vscode.Uri.file(name));
        if (project === undefined || !project.deviceName) {
            return;
        }
        if (project.devicePins === undefined) {
            return;
        }
        providerPinView.setPins(project.devicePins);
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
