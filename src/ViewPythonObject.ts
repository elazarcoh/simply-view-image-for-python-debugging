import * as vscode from "vscode";
import Container from "typedi";
import { AllViewables } from "./AllViewables";
import {
    activeDebugSessionData,
    DebugSessionsHolder,
} from "./debugger-utils/DebugSessionsHolder";
import { openImageToTheSide } from "./utils/VSCodeUtils";
import { ObjectType } from "./viewable/Viewable";
import { evaluateInPython } from "./python-communication/RunPythonCode";
import { constructValueWrappedExpressionFromEvalCode } from "./python-communication/BuildPythonCode";

export async function viewObject(
    obj: PythonObjectRepresentation,
    asType: ObjectType,
    session: vscode.DebugSession
): Promise<void> {
    const viewable = Container.get(AllViewables).allViewables.find(
        (v) => v.group === asType.group && v.type === asType.type
    );
    if (viewable === undefined) {
        // TODO: Handle this error
        return;
    }
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
