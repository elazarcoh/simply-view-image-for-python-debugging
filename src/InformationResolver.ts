import * as vscode from "vscode";
import { SupportedServicesNames } from "./supported-services";
import { ViewerService } from "./ViewerService";
import {evaluatePython, execInModuleCode, execPython, pyModuleName } from "./PythonCodeHelper";
import RESOLVE_INFORMATION_CODE from "./python/resolve_information.py?raw";
import { pythonInContextExecutor } from "./PythonInContextExecutor";
import { mapValueOrError, ValueOrError } from "./ValueOrError";
import { getConfiguration } from "./config";

export interface Information {
    types: string[];
    details: Record<string, string>;
}

class InformationResolver {
    readonly findObjectTypesPythonFunction = `${pyModuleName}.find_object_types`; // return string representation of: tuple[list[str], dict[str, str]]
    readonly setupPythonCode = execInModuleCode(RESOLVE_INFORMATION_CODE, this.findObjectTypesPythonFunction);

    constructor(
        private readonly inContextExecutor = pythonInContextExecutor()
    ) {
    }

    // async setupPython() {
    //     const session = vscode.debug.activeDebugSession;
    //     if (session === undefined) {
    //         return;
    //     }
    //     try {
    //         await this.inContextExecutor.evaluate(session, this.setupPythonCode)
    //     } catch (error) {
    //         logTrace(error);
    //         vscode.window.showErrorMessage(
    //             "could not setup python side. please check log."
    //         );
    //     }
    // }

    async resolveExpression(expression: string): Promise<ValueOrError<Information>> {
        const setupResult = await execPython(this.setupPythonCode);
        if (setupResult.isError) {
            return setupResult;
        }
      const restrictImageTypes = getConfiguration("restrictImageTypes")
        ? "True"
        : "False";
        const code = `${this.findObjectTypesPythonFunction}(${expression}, restrict_types=${restrictImageTypes})`;
        const result = await evaluatePython(code);
        return mapValueOrError(
            result,
            (res) => {
                const [types, details] = res as [string[], Record<string, string>];
                return {
                    types,
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

