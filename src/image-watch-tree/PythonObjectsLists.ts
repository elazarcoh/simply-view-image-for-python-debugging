import * as vscode from "vscode";
import { DebugVariablesTracker } from "../debugger-utils/DebugVariablesTracker";
import { Except } from "../utils/Except";
import { arrayUniqueByKey } from "../utils/Utils";

export class CurrentPythonObjectsList {
    readonly expressionsList: [string, Except<PythonObjectInformation>][] = [];
    readonly variablesList: [string, Except<PythonObjectInformation>][] = [];

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
        variables: Except<PythonObjectInformation>[];
        expressions: Except<PythonObjectInformation>[];
    }> {
        return {
            variables: [],
            expressions: [],
        };
        // const allExpressions = [
        //     ...this.variablesList.map((v) => v[0]),
        //     ...this.expressionsList.map((e) => e[0]),
        // ];
        // const code = "";
        // const information = await evaluateInPython<Record<string, unknown>[]>(
        //     code,
        //     this.debugSession
        // );
        // if (information.isError) {
        //     // TODO: handle error
        //     throw new Error(
        //         `Error while retrieving information: ${information.error}`
        //     );
        // }
        // const variablesInformation = information.result
        //     .slice(0, this.variablesList.length)
        //     .map(sanitize);
        // const expressionsInformation = information.result
        //     .slice(this.variablesList.length)
        //     .map(sanitize);
        // return {
        //     variables: variablesInformation,
        //     expressions: expressionsInformation,
        // };
    }

    public async update(): Promise<void> {
        this.variablesList.length = 0;
        const variables = await this.retrieveVariables();
        this.variablesList.push(
            ...variables.map(
                (v) =>
                    [v, Except.result({})] as [
                        string,
                        Except<PythonObjectInformation>
                    ]
            )
        );
        const information = await this.retrieveInformation();
        if (information.variables.length !== this.variablesList.length) {
            throw new Error("Unexpected number of variables");
        }
        if (information.expressions.length !== this.expressionsList.length) {
            throw new Error("Unexpected number of expressions");
        }
        for (let i = 0; i < this.variablesList.length; i++) {
            this.variablesList[i][1] = information.variables[i];
        }
        for (let i = 0; i < this.expressionsList.length; i++) {
            this.expressionsList[i][1] = information.expressions[i];
        }
        return;
    }
}
function sanitize(obj: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string") {
            result[key] = value;
        } else {
            result[key] = JSON.stringify(value);
        }
    }
    return result;
}
