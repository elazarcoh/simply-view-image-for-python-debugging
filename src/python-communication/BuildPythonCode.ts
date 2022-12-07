import Container from "typedi";
import { AllViewables } from "../AllViewables";
import {
    execInModuleCode,
    PYTHON_MODULE_NAME,
    sameValueMultipleEvalsPythonCode,
} from "./PythonCodeUtils";
import COMMON from "../python/common.py?raw";

const CREATE_MODULE_IF_NOT_EXISTS = `
try:
    ${PYTHON_MODULE_NAME}
except:
    
    from types import ModuleType
    ${PYTHON_MODULE_NAME} = ModuleType('python_view_image_mod', '')
    exec('''${COMMON}''', ${PYTHON_MODULE_NAME}.__dict__)
`;

function combineSetupCodes(setupCodes: SetupCode[]): string {
    const setupCode = setupCodes
        .map(({ setupCode, testSetupCode }) =>
            execInModuleCode(PYTHON_MODULE_NAME, setupCode, testSetupCode)
        )
        .join("\n\n");

    const code = `
${CREATE_MODULE_IF_NOT_EXISTS}

${setupCode}
`;

    return code;
}

export function viewablesSetupCode(): string {
    const viewables = Container.get(AllViewables).allViewables;
    const code = combineSetupCodes(viewables.map((v) => v.setupPythonCode));
    return code;
}

export function pythonObjectTypeCode(expression: string): string {
    const viewables = Container.get(AllViewables).allViewables;
    const code = sameValueMultipleEvalsPythonCode(
        expression,
        viewables.map((v) => v.testTypePythonCode)
    );
    return code;
}

export function pythonObjectInfoCode(expression: string): string {
    const viewables = Container.get(AllViewables).allViewables;
    const code = sameValueMultipleEvalsPythonCode(
        expression,
        viewables.map((v) => v.infoPythonCode)
    );
    return code;
}
