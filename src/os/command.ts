import * as cp from "child_process";
import * as vscode from "vscode";
import { isWindows } from "./platform";
import { extensionState } from "../states/state.global";
import path = require("path/posix");
export let atfOutputChannel: vscode.OutputChannel;

export enum ShellType {
    cmd = "cmd.exe",
    bash = "bash",
    powershell = "powershell.exe",
}

export class Command {
    public debugMessages: boolean;
    public runInIntegratedTerminal;
    public setFolder;
    constructor() {
        if (!atfOutputChannel) {
            atfOutputChannel = vscode.window.createOutputChannel("VS Output");
        }
        const extConfig = vscode.workspace.getConfiguration("vs-cupl");
        this.debugMessages = (extConfig.get("DebugLevel") as boolean) ?? false;
        this.runInIntegratedTerminal =
            (extConfig.get("RunInIntegratedTerminal") as boolean) ?? false;
        this.setFolder = (extConfig.get("SetFolder") as boolean) ?? true;
    }

    async runCommand(
        title: string,
        workingPath: string | undefined,
        buildCommand: string,
        commandProc : ShellType = ShellType.cmd
    ): Promise<ShellResponse> {
        const extConfig = vscode.workspace.getConfiguration("vs-cupl");
        
        this.debugMessages = extConfig.get("DebugLevel") as boolean;
        if (this.runInIntegratedTerminal) {
            // call terminal to run md file
            var t = vscode.window.terminals.find((t) => t.name === title);
            if (t === undefined) {
                t = vscode.window.createTerminal(title);
            }

            //set folder
            if (workingPath !== undefined) {
                t.sendText(`cd "${workingPath}"`);
            } else if (workingPath === undefined) {
                t.sendText(
                    `cd "${
                        isWindows()
                            ? extensionState.pathWinDrive
                            : path.join(extensionState.pathWineBase ??'',extensionState.pathWinDrive??'')
                    }"`
                );
            }

            t.show();
            t.sendText(buildCommand);
            return {
                responseCode: 0,
                responseError: undefined,
                responseText:
                    "Terminal feedback is unavailable in integrated terminal mode.",
            };
        } else {
            try {
                atfOutputChannel.show();
                if (this.debugMessages) {
                    atfOutputChannel.appendLine(
                        `Executing Command [ ${buildCommand} ] @ ${new Date().toLocaleString()}`
                    );
                }

                let workingDirectory: string | undefined = undefined;
                //set folder
                if (this.setFolder) {
                    workingDirectory =
                        workingPath !== undefined && workingPath.length > 0
                            ? workingPath
                            : isWindows()
                            ? undefined
                            : extensionState.pathWineBase;
                }
                const cmdResponse = await this.execShell(
                    buildCommand,
                    workingDirectory,
                    commandProc
                );
                if (this.debugMessages) {
                    atfOutputChannel.appendLine(
                        ">>" +
                            cmdResponse.responseText.replace("\r\n", "\n") +
                            " @ " +
                            new Date().toLocaleString()
                    );
                }
                //vscode.window.showInformationMessage(cmdResponse.responseText.replace('\r\n', '\n'));
                return cmdResponse;
            } catch (err: any) {
                atfOutputChannel.appendLine(
                    " ** ERROR ** @ " +
                        new Date().toLocaleString() +
                        ":" +
                        err.responseText.replace("\r\n", "\n")                       
                );
                //vscode.window.showErrorMessage(err.responseError.message, err.responseError.stack);
                return err;
            }
        }
    }

    private execShell = (cmd: string, dir: string | undefined = undefined, commandProc: ShellType = 
        ShellType.cmd
    ) =>
        new Promise<ShellResponse>((resolve, reject) => {            
            cp.exec(
                cmd,
                { cwd: dir, shell: isWindows() ? commandProc : "bash" },
                (err, out) => {
                    if (err) {
                        if (atfOutputChannel && this.debugMessages) {
                            atfOutputChannel.appendLine(
                                `Error executing: ${cmd}\nOutput:\n${out}\nError Details:\n${err.message}`
                            );
                        }

                        return reject(
                            new ShellResponse((err as any).code, out, err)
                        );
                    }
                    return resolve(new ShellResponse(0, out, undefined));
                }
            );
        });

        private execPowerShell = (cmd: string, dir: string | undefined = undefined) =>
            new Promise<ShellResponse>((resolve, reject) => {            
                if(!isWindows() ){
                    return;
                }
                cp.exec(
                    cmd,
                    { cwd: dir, shell: "powershell.exe" },
                    (err, out) => {
                        if (err) {
                            if (atfOutputChannel && this.debugMessages) {
                                atfOutputChannel.appendLine(
                                    `Error executing: ${cmd}\nOutput:\n${out}\nError Details:\n${err.message}`
                                );
                            }
    
                            return reject(
                                new ShellResponse((err as any).code, out, err)
                            );
                        }
                        return resolve(new ShellResponse(0, out, undefined));
                    }
                );
            });
}

export class ShellResponse {
    constructor(
        readonly responseCode: number,
        readonly responseText: string,
        readonly responseError: any | undefined
    ) {}
}
