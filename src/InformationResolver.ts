import * as vscode from "vscode";
import { evaluatePython, execInModuleCode, execPython, pyModuleName } from "./python-communication/ExecInPython";
import RESOLVE_INFORMATION_CODE from "./python/resolve_information.py?raw";
import { pythonInContextExecutor } from "./python-communication/PythonInContextExecutor";
import { mapValueOrError, ValueOrError } from "./utils/Except";
import { getConfiguration } from "./config";

export interface Information {
    types: { group: string, type: string }[];
    details: Record<string, string>;
}

class InformationResolver {
    readonly findObjectTypesPythonFunction = `${pyModuleName}.find_object_types`; // return string representation of: tuple[list[str], dict[str, str]]
    readonly setupPythonCode = execInModuleCode(RESOLVE_INFORMATION_CODE, this.findObjectTypesPythonFunction);

    constructor(
        private readonly inContextExecutor = pythonInContextExecutor()
    ) {
    }

    async resolveExpression(expression: string): Promise<ValueOrError<Information>> {
        const setupResult = await execPython(this.setupPythonCode);
        if (setupResult.isError) {
            return setupResult;
        }
        const restrictImageTypes = getConfiguration("restrictImageTypes")
            ? "True"
            : "False";
        const code = `${this.findObjectTypesPythonFunction}(${expression}, restrict_types=${restrictImageTypes})`;
        const result = await evaluatePython<[[string, string][], Record<string, string>]>(code);
        return mapValueOrError(
            result,
            (res) => {
                const [types, details] = res;
                return {
                    types: types.map(([group, type]) => ({ group, type })),
                    details,
                }
            }
        );
    }

}

let _pythonInformationResolver: InformationResolver;
export function pythonInformationResolver(): InformationResolver {
    _pythonInformationResolver ??
        (_pythonInformationResolver = new InformationResolver());
    return _pythonInformationResolver;
}

