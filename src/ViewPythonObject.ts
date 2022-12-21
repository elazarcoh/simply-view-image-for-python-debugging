import * as vscode from "vscode";
import { activeDebugSessionData } from "./debugger-utils/DebugSessionsHolder";
import {
    currentUserSelection,
    selectionString,
    openImageToTheSide,
} from "./utils/VSCodeUtils";
import { Viewable } from "./viewable/Viewable";
import { evaluateInPython } from "./python-communication/RunPythonCode";
import { constructValueWrappedExpressionFromEvalCode } from "./python-communication/BuildPythonCode";
import { findExpressionViewables } from "./PythonObjectInfo";

export async function viewObject(
    obj: PythonObjectRepresentation,
    viewable: Viewable,
    session: vscode.DebugSession
): Promise<void> {
    const debugSessionData = activeDebugSessionData(session);
    const path = debugSessionData.savePathHelper.savePathFor(obj);
    const objectAsString = "expression" in obj ? obj.expression : obj.variable; // TODO: fix
    const code = constructValueWrappedExpressionFromEvalCode(
        viewable.serializeObjectPythonCode,
        objectAsString,
        path
    );
    const result = await evaluateInPython<null>(code, session);
    // TODO: Handle error
    if (!result.isError) {
        await openImageToTheSide(path, true);
    }
}

export async function viewObjectUnderCursor(): Promise<unknown> {
    const debugSession = vscode.debug.activeDebugSession;
    const document = vscode.window.activeTextEditor?.document;
    const range = vscode.window.activeTextEditor?.selection;
    if (
        debugSession === undefined ||
        document === undefined ||
        range === undefined
    ) {
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
    if (objectViewables === undefined || objectViewables.length === 0) {
        return undefined;
    }

    return viewObject(userSelection, objectViewables[0], debugSession);
}
