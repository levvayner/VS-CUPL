import * as vscode from "vscode";

export function stateManager(context: vscode.ExtensionContext) {
    return {
        read,
        write,
    };

    function read(paramName: string): string {
        return context.globalState.get(paramName) as string;
    }

    async function write(paramName: string, value: string) {
        await context.globalState.update(paramName, value);
    }
}

export function getNonce() {
    let text = "";
    const possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
