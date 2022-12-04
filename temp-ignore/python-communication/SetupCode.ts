import { indent } from "../utils/Utils";
import { PYTHON_MODULE_NAME } from "./ExecInPython";

const CREATE_MODULE_IF_NOT_EXISTS = `
try:
    ${PYTHON_MODULE_NAME}
except:
    
    from types import ModuleType
    ${PYTHON_MODULE_NAME} = ModuleType('python_view_image_mod', '')
`;


function execInModuleCode(content: string, tryExpression: string): string {

    const code: string = `
exec('''
try:
${indent(tryExpression, 4)}
except:
${indent(content, 4)}
''', ${PYTHON_MODULE_NAME}.__dict__
)
`
    return code;
}

export function combineSetupCodes(setupCodes: SetupCode[]): string {

    const setupCode = setupCodes.map(
        ({ setupCode, testSetupCode }) => execInModuleCode(setupCode, testSetupCode)
    ).join("\n\n");

    const code = `
${CREATE_MODULE_IF_NOT_EXISTS}

${setupCode}
`;

    return code;
}
