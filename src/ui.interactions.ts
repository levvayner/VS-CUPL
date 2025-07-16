import * as vscode from "vscode";

export async function uiIntentDeployQuestion() {
    var selectedProjectOption = await vscode.window.showQuickPick(
        ["No", "Yes"],
        {
            canPickMany: false,
            title: "Execute Deployment",
        }
    );

    if (!selectedProjectOption || selectedProjectOption?.length === 0) {
        vscode.window.showErrorMessage(
            "Must select option if to deploy or not"
        );
        return;
    }
    return selectedProjectOption === "Yes";
}


export async function uiIntentSelectTextFromArray(
    selections: string[],
    title: string | undefined = undefined
): Promise<string> {
    var selectedOption = await vscode.window.showQuickPick(
        selections.map((s) => s.trim()),
        {
            canPickMany: false,
            title: title,
        }
    );

    return selectedOption ?? "";
}

export async function uiEnterProjectName(): Promise<string> {
    var selectProjectName = await vscode.window.showInputBox({
        title: "Specify Project Name",
    });
    return selectProjectName ?? "";
}
