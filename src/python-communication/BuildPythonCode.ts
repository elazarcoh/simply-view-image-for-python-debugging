import COMMON from "../python/common.py?raw";
import { indent } from "../utils/Utils";

const PYTHON_MODULE_NAME = "_python_view_image_mod";
const EVAL_INTO_VALUE_FUNCTION = `${PYTHON_MODULE_NAME}.eval_into_value`;
const SAME_VALUE_MULTIPLE_CALLABLES = `${PYTHON_MODULE_NAME}.same_value_multiple_callables`;

const CREATE_MODULE_IF_NOT_EXISTS = `
try:
    ${PYTHON_MODULE_NAME}
except:
    
    from types import ModuleType
    ${PYTHON_MODULE_NAME} = ModuleType('python_view_image_mod', '')
    exec('''${COMMON}''', ${PYTHON_MODULE_NAME}.__dict__)
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
`;
    return code;
}

export function combineSetupCodes(setupCodes: SetupCode[]): string {
    const setupCode = setupCodes
        .map(({ setupCode, testSetupCode }) =>
            execInModuleCode(setupCode, testSetupCode)
        )
        .join("\n\n");

    const code = `
${CREATE_MODULE_IF_NOT_EXISTS}

${setupCode}
`;

    return code;
}

export function evaluateExpressionPythonCode(
    evalCode: EvalCode,
    expression: string
): string {
    const expressionToEval = evalCode.evalCode(expression);
    // verify it's a single-line expression
    if (expressionToEval.includes("\n")) {
        throw new Error("Expression must be a single line");
    }
    const asLambda = `lambda: ${expressionToEval}`;
    const code = `${EVAL_INTO_VALUE_FUNCTION}(${asLambda})`;
    return code;
}

export function convertBoolToPython(bool: boolean): string {
    return bool ? "True" : "False";
}

export function atModule(name: string): string {
    return `${PYTHON_MODULE_NAME}.${name}`;
}

export function sameValueMultipleCallables(expression: string, callables: ((_:string) => string)): string {
    return `[${expressions.join(", ")}]`;
}
