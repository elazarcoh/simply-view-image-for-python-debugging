import * as vscode from "vscode";
import { TypedCommand } from "./commands";
import { findExpressionTypes } from "./PythonObjectInfo";
import { currentUserSelection, selectionString } from "./utils/VSCodeUtils";

export class CodeActionProvider implements vscode.CodeActionProvider {
    public async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range
    ): Promise<TypedCommand<"svifpd._internal_view-object">[] | undefined> {
        const debugSession = vscode.debug.activeDebugSession;
        if (debugSession === undefined) {
            return undefined;
        }

        const userSelection = currentUserSelection(document, range);
        if (userSelection === undefined) {
            return;
        }

        const objectTypes = await findExpressionTypes(
            selectionString(userSelection),
            debugSession
        );
        if (objectTypes === undefined) {
            return undefined;
        }

        return objectTypes.map((t) => ({
            title: `View ${t.group} (${t.type})`,
            command: "svifpd._internal_view-object",
            arguments: [userSelection, t, debugSession],
        }));
    }
}
