import * as vscode from "vscode";
import Container from "typedi";
import { AllViewables } from "./AllViewables";
import { DebugSessionsHolder } from "./debugger-utils/DebugSessionsHolder";
import { openImageToTheSide } from "./utils/VSCodeUtils";
import { ObjectType } from "./viewable/Viewable";
import { BuildEvalCodeWithExpressionPythonCode } from "./python-communication/PythonCodeUtils";
import { evaluateInPython } from "./python-communication/RunPythonCode";
import { logError } from "./Logging";

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
    const debugSessionData =
        Container.get(DebugSessionsHolder).debugSessionData(session);
    const path = debugSessionData.savePathHelper.savePathFor(obj);
    const objectAsString = "expression" in obj ? obj.expression : obj.variable; // TODO: fix
    const code = BuildEvalCodeWithExpressionPythonCode(
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
