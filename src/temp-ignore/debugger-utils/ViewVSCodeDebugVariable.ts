import { DebugProtocol } from "vscode-debugprotocol";
import { viewObject } from "../commands";
import { VariableSelection } from "../types";

export function patchDebugVariableContext(variablesResponse: DebugProtocol.VariablesResponse) {
    const viewableTypes = [
        "AxesSubplot",
        "Figure",
    ]
    variablesResponse.body.variables.forEach((v) => {
        if (v.type && viewableTypes.includes(v.type)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (v as any).__vscodeVariableMenuContext = 'viewableInGraphicViewer';
        }
    });
}

export const commands = [
    [
        "svifpd.view-debug-variable",
        async ({ variable }: { variable: DebugProtocol.Variable }) => {
            const variableSelection: VariableSelection = {
                variable: variable.evaluateName!
            }
            return viewObject(variableSelection);
        }
    ]
];