import * as vscode from "vscode";
import { Python } from "./PythonObjectInfo";
import type { ObjectType, PythonObjectRepresentation } from "./types";
import { currentUserSelection } from "./utils/VSCodeUtils";


export class CodeActionProvider implements vscode.CodeActionProvider {
    public async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range
    ): Promise<vscode.Command<[PythonObjectRepresentation, ObjectType]>[] | undefined> {

        if (vscode.debug.activeDebugSession === undefined) {
            return undefined;
        }

        const userSelection = currentUserSelection(document, range);
        if (userSelection === undefined) {
            return;
        }

        const objectInfo = await Python.PythonObject.info(userSelection);
        if (objectInfo === undefined) {
            return undefined;
        }

        const actions =
            objectInfo.types
                .map(t => ({
                    title: `View ${t.group} (${t.type})`,
                    command: 'svifpd._internal_view-object',
                    arguments: [userSelection, t] as [PythonObjectRepresentation, ObjectType],
                })
                );

        return actions;
    }
}
