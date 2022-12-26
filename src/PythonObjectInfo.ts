import Container from "typedi";
import * as vscode from "vscode";
import { AllViewables } from "./AllViewables";
import { logError } from "./Logging";
import {
    combineMultiEvalCodePython,
    constructRunSameExpressionWithMultipleEvaluatorsCode,
} from "./python-communication/BuildPythonCode";
import { evaluateInPython } from "./python-communication/RunPythonCode";
import { Viewable } from "./viewable/Viewable";

function listOfValidViewables(
    viewables: ReadonlyArray<Viewable>,
    isOfType: Except<boolean>[]
) {
    return isOfType
        .map((isOfType, i) => ({ isOfType, i }))
        .filter(({ isOfType }) => !isOfType.isError && isOfType.result)
        .map(({ i }) => viewables[i]);
}

export async function findExpressionViewables(
    expression: string,
    session: vscode.DebugSession
): Promise<Viewable[]> {
    const viewables = Container.get(AllViewables).allViewables;
    const code = constructRunSameExpressionWithMultipleEvaluatorsCode(
        expression,
        viewables.map((v) => v.testTypePythonCode)
    );
    const isOfType = await evaluateInPython(code, session);

    if (isOfType.isError) {
        logError(
            `Error finding viewables for expression \`${expression}\`. Error: ${isOfType.errorMessage}`
        );
        return [];
    } else {
        const objectViewables = listOfValidViewables(
            viewables,
            isOfType.result
        );

        return objectViewables;
    }
}

export async function findExpressionsViewables(
    expressions: string[],
    session: vscode.DebugSession
): Promise<Viewable[][]> {
    const viewables = Container.get(AllViewables).allViewables;
    const codes = expressions.map((expression) =>
        constructRunSameExpressionWithMultipleEvaluatorsCode(
            expression,
            viewables.map((v) => v.testTypePythonCode)
        )
    );
    const code = combineMultiEvalCodePython(codes);
    const isOfType = await evaluateInPython(code, session);

    if (isOfType.isError) {
        const message = `Error finding viewables for expressions \`${expressions.join(
            ", "
        )}\`. Error: ${isOfType.errorMessage}`;
        logError(message);
        return [];
    } else {
        const objectsViewables = isOfType.result.map(
            (isOfType: Except<boolean>[]) =>
                listOfValidViewables(viewables, isOfType)
        );
        return objectsViewables;
    }
}
