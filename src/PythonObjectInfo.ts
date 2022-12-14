import Container from "typedi";
import * as vscode from "vscode";
import { AllViewables } from "./AllViewables";
import { pythonObjectTypeCode } from "./python-communication/BuildPythonCode";
import { evaluateInPythonMulti } from "./python-communication/RunPythonCode";
import {Viewable } from "./viewable/Viewable";

export async function findExpressionViewables(
    expression: string,
    session: vscode.DebugSession
): Promise<Viewable[]> {
    const code = pythonObjectTypeCode(expression);
    const isOfType = await evaluateInPythonMulti<boolean>(code, session, {
        context: "repl",
    });

    const viewables = Container.get(AllViewables).allViewables;
    const objectViewables = isOfType
        .map((isOfType, i) => ({ isOfType, i }))
        .filter(({ isOfType }) => !isOfType.isError && isOfType.result)
        .map(({ i }) => viewables[i]);

    return objectViewables;
}
