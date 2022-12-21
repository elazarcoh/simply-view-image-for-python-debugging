import Container, { Service } from "typedi";
import * as vscode from "vscode";
import { DebugSessionsHolder } from "../debugger-utils/DebugSessionsHolder";
import { DebugVariablesTracker } from "../debugger-utils/DebugVariablesTracker";
import {
    combineMultiEvalCodePython,
    constructRunSameExpressionWithMultipleEvaluatorsCode,
} from "../python-communication/BuildPythonCode";
import { evaluateInPython } from "../python-communication/RunPythonCode";
import { findExpressionsViewables } from "../PythonObjectInfo";
import { Except } from "../utils/Except";
import { arrayUniqueByKey, zip } from "../utils/Utils";
import { Viewable } from "../viewable/Viewable";
import { WatchTreeProvider } from "./WatchTreeProvider";

// ExpressionsList is global to all debug sessions
@Service()
class ExpressionsList {
    readonly expressions: [
        string,
        Except<[Viewable[], PythonObjectInformation]>
    ][] = [];
}

export const expressionsList: ReadonlyArray<
    [string, Except<[Viewable[], PythonObjectInformation]>]
> = Container.get(ExpressionsList).expressions;

export class CurrentPythonObjectsList {
    readonly variablesList: [
        string,
        Except<[Viewable[], PythonObjectInformation]>
    ][] = [];

    constructor(
        private readonly debugVariablesTracker: DebugVariablesTracker,
        private readonly debugSession: vscode.DebugSession
    ) {}

    private async retrieveVariables(): Promise<string[]> {
        const { locals, globals } =
            await this.debugVariablesTracker.currentFrameVariables();
        if (!globals) {
            return [];
        }
        const allUniqueVariables = arrayUniqueByKey(
            [...globals, ...locals],
            (v) => v.evaluateName
        );

        return allUniqueVariables.map((v) => v.evaluateName);
    }

    private async retrieveInformation(): Promise<{
        variables: Except<[Viewable[], PythonObjectInformation]>[];
        expressions: Except<[Viewable[], PythonObjectInformation]>[];
    }> {
        const allExpressions = [
            ...this.variablesList.map((v) => v[0]),
            ...expressionsList.map((e) => e[0]),
        ];

        const allViewables = await findExpressionsViewables(
            allExpressions,
            this.debugSession
        );

        const informationEvalCode = allViewables.map((vs) =>
            vs.map((v) => v.infoPythonCode)
        );

        const codes = zip(allExpressions, informationEvalCode).map(
            ([exp, infoEvalCodes]) =>
                constructRunSameExpressionWithMultipleEvaluatorsCode(
                    exp,
                    infoEvalCodes
                )
        );
        const code = combineMultiEvalCodePython(codes);
        const res = await evaluateInPython(code, this.debugSession);

        if (res.isError) {
            // TODO: handle error

            return {
                variables: [],
                expressions: [],
            };
        } else {
            const allExpressionsInformation = res.result.map(
                combineValidInfoErrorIfNone
            );

            const allExpressionsViewablesAndInformation = zip(
                allViewables,
                allExpressionsInformation
            ).map(([vs, vi]) =>
                Except.map(
                    vi,
                    (vi) => [vs, vi] as [Viewable[], PythonObjectInformation]
                )
            );

            const variablesInformation =
                allExpressionsViewablesAndInformation.slice(
                    0,
                    this.variablesList.length
                );
            const expressionsInformation =
                allExpressionsViewablesAndInformation.slice(
                    this.variablesList.length
                );

            return {
                variables: variablesInformation,
                expressions: expressionsInformation,
            };
        }
    }

    public async update(): Promise<void> {
        this.variablesList.length = 0;
        const variables = await this.retrieveVariables();
        this.variablesList.push(
            ...variables.map(
                (v) =>
                    [v, Except.error("No info yet")] as [
                        string,
                        Except<[Viewable[], PythonObjectInformation]>
                    ]
            )
        );

        const information = await this.retrieveInformation();
        if (information.variables.length !== this.variablesList.length) {
            throw new Error("Unexpected number of variables");
        }
        if (information.expressions.length !== expressionsList.length) {
            throw new Error("Unexpected number of expressions");
        }
        for (let i = 0; i < this.variablesList.length; i++) {
            this.variablesList[i][1] = information.variables[i];
        }
        for (let i = 0; i < expressionsList.length; i++) {
            expressionsList[i][1] = information.expressions[i];
        }
        return;
    }
}

function combineValidInfoErrorIfNone(
    infoOrErrors: Except<Record<string, string>>[]
): Except<Record<string, string>> {
    const validRecords = infoOrErrors
        .filter(Except.isOkay)
        .map((p) => p.result);

    if (validRecords.length === 0) {
        return Except.error("Invalid expression");
    } else {
        const allEntries = validRecords.flatMap((o) => Object.entries(o));
        const merged = Object.fromEntries(allEntries);
        return Except.result(merged);
    }
}

export async function addExpression(): Promise<void> {
    // const maybeExpression = await vscode.window.showInputBox({
    //   prompt: "Enter expression to watch",
    //   placeHolder: "e.g. images[0]",
    //   ignoreFocusOut: true,
    // });
    const maybeExpression = "x[::2, ::2]";
    if (maybeExpression !== undefined) {
        Container.get(ExpressionsList).expressions.push([
            maybeExpression,
            Except.error("Not ready"),
        ]);
        const session = vscode.debug.activeDebugSession;
        if (session !== undefined) {
            await Container.get(DebugSessionsHolder)
                .debugSessionData(session)
                .currentPythonObjectsList.update();
        }
        Container.get(WatchTreeProvider).refresh();
    }
}
