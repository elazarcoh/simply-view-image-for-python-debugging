import Container from "typedi";
import * as vscode from "vscode";
import { AllViewables } from "./AllViewables";
import { pythonObjectTypeCode } from "./python-communication/BuildPythonCode";
import { evaluateInPythonMulti } from "./python-communication/RunPythonCode";
import { ObjectType } from "./viewable/Viewable";

export async function findExpressionTypes(
    expression: string,
    session: vscode.DebugSession
): Promise<ObjectType[]> {
    const viewables = Container.get(AllViewables).allViewables.map(
        ({ group, type }) => ({ group, type })
    );
    const code = pythonObjectTypeCode(expression);
    const isOfType = await evaluateInPythonMulti<boolean>(code, session, {
        context: "repl",
    });
    const types = isOfType
        .map((isOfType, i) => ({ isOfType, i }))
        .filter(({ isOfType }) => !isOfType.isError && isOfType.result)
        .map(({ i }) => viewables[i]);

    return types;
}
