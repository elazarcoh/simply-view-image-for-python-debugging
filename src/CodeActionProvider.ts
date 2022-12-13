import * as vscode from "vscode";
import { findExpressionTypes } from "./PythonObjectInfo";
import { currentUserSelection, selectionString } from "./utils/VSCodeUtils";
import { ObjectType } from "./viewable/Viewable";

export class CodeActionProvider implements vscode.CodeActionProvider {
    public async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range
    ): Promise<
        vscode.Command<[PythonObjectRepresentation, ObjectType]>[] | undefined
    > {
        if (vscode.debug.activeDebugSession === undefined) {
            return undefined;
        }

        const userSelection = currentUserSelection(document, range);
        if (userSelection === undefined) {
            return;
        }

        const objectTypes = await findExpressionTypes(
            selectionString(userSelection),
            vscode.debug.activeDebugSession
        );
        if (objectTypes === undefined) {
            return undefined;
        }

        const actions = objectTypes.map((t) => ({
            title: `View ${t.group} (${t.type})`,
            command: "svifpd._internal_view-object",
            arguments: [userSelection, t] as [
                PythonObjectRepresentation,
                ObjectType
            ],
        }));

        return actions;
    }
}
