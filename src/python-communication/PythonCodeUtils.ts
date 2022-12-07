import { indent } from "../utils/Utils";

export const PYTHON_MODULE_NAME = "_python_view_image_mod";
const EVAL_INTO_VALUE_FUNCTION = `${PYTHON_MODULE_NAME}.eval_into_value`;
const SAME_VALUE_MULTIPLE_CALLABLES = `${PYTHON_MODULE_NAME}.same_value_multiple_callables`;

export function execInModuleCode(moduleName: string, content: string, tryExpression: string): string {
    const code: string = `
exec('''
try:
${indent(tryExpression, 4)}
except:
${indent(content, 4)}
''', ${moduleName}.__dict__
)
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

export function sameValueMultipleEvalsPythonCode(expression: string, multiEvals: EvalCode[]): string {
    const lazyEvalExpression = `lambda: ${expression}`;
    const lambdas = multiEvals.map(({ evalCode }) => `lambda x: ${evalCode("x")}`).join(", ");
    return `${SAME_VALUE_MULTIPLE_CALLABLES}(${lazyEvalExpression}, [${lambdas}])`;
}
