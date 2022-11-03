import * as vscode from "vscode";
import { SupportedServicesNames } from "./supported-services";
import { ViewerService } from "./ViewerService";
import { execInModuleCode, pyModuleName } from "./PythonCodeHelper";
import RESOLVE_INFORMATION_CODE from "./python/resolve_information.py?raw";
import { pythonInContextExecutor } from "./PythonInContextExecutor";
import { logTrace } from "./logging";

export interface Information {
    services: SupportedServicesNames[];
    details: Record<string, string>;
}

export class InformationResolver {
    readonly findObjectTypesPythonFunction = `${pyModuleName}.find_object_types`;
    readonly setupPythonCode = execInModuleCode(RESOLVE_INFORMATION_CODE, this.findObjectTypesPythonFunction);

    constructor(
        private readonly services: ViewerService[],
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

    async resolveExpression(expression: string): Promise<Information> {
        return {
            services: ["image"],
            details: {
                type: "np.ndarray",
            }
        }
    }

    async resolveVariable(variable: string): Promise<Information> {
        return {
            services: ["image"],
            details: {
                type: "np.ndarray",
            }
        }
    }
}
