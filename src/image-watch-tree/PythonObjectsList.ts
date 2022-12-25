import Container, { Service } from "typedi";
import * as vscode from "vscode";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
import { DebugVariablesTracker } from "../debugger-utils/DebugVariablesTracker";
import { logError } from "../Logging";
import {
    combineMultiEvalCodePython,
    constructRunSameExpressionWithMultipleEvaluatorsCode,
} from "../python-communication/BuildPythonCode";
import { evaluateInPython } from "../python-communication/RunPythonCode";
import { findExpressionsViewables } from "../PythonObjectInfo";
import { Except } from "../utils/Except";
import { arrayUniqueByKey, notEmptyArray, zip } from "../utils/Utils";
import { Viewable } from "../viewable/Viewable";
import { WatchTreeProvider } from "./WatchTreeProvider";

// ExpressionsList is global to all debug sessions
@Service()
class ExpressionsList {
    readonly expressions: string[] = [];
}

export const globalExpressionsList: ReadonlyArray<string> =
    Container.get(ExpressionsList).expressions;

export type InfoOrError = Except<
    [NonEmptyArray<Viewable>, PythonObjectInformation]
>;
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
        if (globals.length === 0 && locals.length === 0) {
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
            logError(
                `Error while retrieving information for variables and expressions: ${res.errorMessage}`
            );
            return {
                variables: [],
                expressions: [],
            };
        } else {
            const allExpressionsInformation = res.result.map(
                combineValidInfoErrorIfNone
            );

            const sanitize = ([viewables, info]: [
                Viewable[],
                Except<PythonObjectInformation>
            ]): InfoOrError => {
                if (notEmptyArray(viewables)) {
                    if (info.isError) {
                        return info;
                    } else {
                        return Except.result([viewables, info.result]);
                    }
                } else {
                    return Except.error("Not viewable");
                }
            };

            const allExpressionsViewablesAndInformation = zip(
                allViewables,
                allExpressionsInformation
            ).map(sanitize);

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
            logError(
                `Unexpected number of variables: ${information.variables.length} vs ${this._variablesList.length}`
            );
            return;
        }
        if (information.expressions.length !== globalExpressionsList.length) {
            logError(
                `Unexpected number of expressions: ${information.expressions.length} vs ${globalExpressionsList.length}`
            );
            return;
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

export async function addExpression(): Promise<boolean> {
    const maybeExpression = await vscode.window.showInputBox({
        prompt: "Enter expression to watch",
        placeHolder: "e.g. images[0]",
        ignoreFocusOut: true,
    });
    if (maybeExpression !== undefined) {
        Container.get(ExpressionsList).expressions.push(maybeExpression);
        return true;
    }
    return false;
}

export async function editExpression(expression: string): Promise<boolean> {
    const expressions = Container.get(ExpressionsList).expressions;
    const idx = expressions.indexOf(expression);
    if (idx > -1) {
        const maybeExpression = await vscode.window.showInputBox({
            prompt: "Enter expression to watch",
            value: expression,
            placeHolder: "e.g. images[0]",
            ignoreFocusOut: true,
        });
        if (maybeExpression !== undefined) {
            expressions[idx] = maybeExpression;
            return true;
        }
    }
    return false;
}

export function removeExpression(expression: string): boolean {
    const expressions = Container.get(ExpressionsList).expressions;
    const idx = expressions.indexOf(expression);
    if (idx > -1) {
        expressions.splice(idx, 1);
        return true;
    }
    return false;
}

export function removeAllExpressions(): string[] {
    const expressions = Container.get(ExpressionsList).expressions;
    if (expressions.length > 0) {
        const removedExpressions = expressions.slice(0);
        expressions.length = 0;
        return removedExpressions;
    }
    return [];
}
