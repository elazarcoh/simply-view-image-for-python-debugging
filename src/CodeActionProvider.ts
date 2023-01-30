import * as vscode from "vscode";
import { TypedCommand } from "./commands";
import { findExpressionViewables } from "./PythonObjectInfo";
import { arrayUniqueByKey } from "./utils/Utils";
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

        const objectViewables = await findExpressionViewables(
            selectionString(userSelection),
            debugSession
        );
        if (objectViewables.isError) {
            return undefined;
        }

        return arrayUniqueByKey(objectViewables.result, (t) => t.title).map(
            (viewable) => ({
                title: `View ${viewable.title}`,
                command: "svifpd._internal_view-object",
                arguments: [userSelection, viewable, debugSession],
            })
        );
    }
}
