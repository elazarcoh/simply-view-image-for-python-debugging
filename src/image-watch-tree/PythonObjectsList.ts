import Container, { Service } from "typedi";
import * as vscode from "vscode";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
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
    readonly expressions: string[] = [];
}

export const globalExpressionsList: ReadonlyArray<string> =
    Container.get(ExpressionsList).expressions;

export type InfoOrError = Except<[Viewable[], PythonObjectInformation]>;
type ExpressingWithInfo = [string, InfoOrError];

export class CurrentPythonObjectsList {
    private readonly _variablesList: ExpressingWithInfo[] = [];
    private _expressionsInfo: InfoOrError[] = [];

    constructor(
        private readonly debugVariablesTracker: DebugVariablesTracker,
        private readonly debugSession: vscode.DebugSession
    ) {}

    private async retrieveVariables(): Promise<string[]> {
        const { locals, globals } =
            await this.debugVariablesTracker.currentFrameVariables();
        if (globals.length === 0) {
            return [];
        }
        const allUniqueVariables = arrayUniqueByKey(
            [...globals, ...locals],
            (v) => v.evaluateName
        );

        return allUniqueVariables.map((v) => v.evaluateName);
    }

    private async retrieveInformation(): Promise<{
        variables: InfoOrError[];
        expressions: InfoOrError[];
    }> {
        const allExpressions = [
            ...this._variablesList.map((v) => v[0]),
            ...globalExpressionsList,
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
                    this._variablesList.length
                );
            const expressionsInformation =
                allExpressionsViewablesAndInformation.slice(
                    this._variablesList.length
                );

            return {
                variables: variablesInformation,
                expressions: expressionsInformation,
            };
        }
    }

    public async update(): Promise<void> {
        this._variablesList.length = 0;
        const variables = await this.retrieveVariables();
        this._variablesList.push(
            ...variables.map(
                (v) => [v, Except.error("Not ready")] as ExpressingWithInfo
            )
        );

        const information = await this.retrieveInformation();
        if (information.variables.length !== this._variablesList.length) {
            throw new Error("Unexpected number of variables");
        }
        if (information.expressions.length !== globalExpressionsList.length) {
            throw new Error("Unexpected number of expressions");
        }
        for (let i = 0; i < this._variablesList.length; i++) {
            this._variablesList[i][1] = information.variables[i];
        }
        this._expressionsInfo = information.expressions;
        return;
    }

    public clear(): void {
        this._variablesList.length = 0;
        this._expressionsInfo.length = 0;
    }

    public get variablesList(): ExpressingWithInfo[] {
        return this._variablesList;
    }

    public get expressionsInfo(): InfoOrError[] | undefined {
        return this._expressionsInfo.length === 0
            ? undefined // return undefined, so in case the debugger is stopping it won't use the empty array here
            : this._expressionsInfo;
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
        Container.get(ExpressionsList).expressions.push(maybeExpression);
        await activeDebugSessionData()?.currentPythonObjectsList.update();
        Container.get(WatchTreeProvider).refresh();
    }
}
