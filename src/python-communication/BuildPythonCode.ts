import COMMON from "../python/common.py?raw";
import Container from "typedi";
import { AllViewables } from "../AllViewables";
import { indent } from "../utils/Utils";

export const PYTHON_MODULE_NAME = "_python_view_image_mod";
const SAME_VALUE_MULTIPLE_CALLABLES = `${PYTHON_MODULE_NAME}.same_value_multiple_callables`;
const EVAL_INTO_VALUE_FUNCTION = `${PYTHON_MODULE_NAME}.eval_into_value`;
const STRINGIFY = `${PYTHON_MODULE_NAME}.stringify`;

const CREATE_MODULE_IF_NOT_EXISTS = `
try:
    ${PYTHON_MODULE_NAME}
except:
    
    from types import ModuleType
    ${PYTHON_MODULE_NAME} = ModuleType('python_view_image_mod', '')
    exec('''${COMMON}''', ${PYTHON_MODULE_NAME}.__dict__)
`;

export function execInModuleCode(
    moduleName: string,
    content: string,
    tryExpression: string
): string {
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

export function stringifyPython<R>(
    evalCodePython: EvalCodePython<R>
): EvalCodePython<R> {
    return {
        pythonCode: `${STRINGIFY}(${evalCodePython.pythonCode})`,
    };
}

export function convertBoolToPython(bool: boolean): string {
    return bool ? "True" : "False";
}

export function atModule(name: string): string {
    return `${PYTHON_MODULE_NAME}.${name}`;
}

function concatExpressionsToPythonList(expressions: string[]): string {
    return `[${expressions.join(", ")}]`;
}

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

export function verifyModuleExistsCode(): EvalCodePython<boolean> {
    return convertExpressionIntoValueWrappedExpression(
        `'${PYTHON_MODULE_NAME}' in globals()`
    );
}

export function viewablesSetupCode(): EvalCodePython<null> {
    const viewables = Container.get(AllViewables).allViewables;
    const pythonCode = combineSetupCodes(
        viewables.map((v) => v.setupPythonCode)
    );
    return { pythonCode };
}

function convertExpressionIntoValueWrappedExpression<R>(
    expression: string
): EvalCodePython<R> {
    // verify it's a single-line expression
    if (expression.includes("\n")) {
        throw new Error("Expression must be a single line");
    }
    const asLambda = `lambda: ${expression}`;
    const pythonCode = `${EVAL_INTO_VALUE_FUNCTION}(${asLambda})`;
    return { pythonCode };
}

export function constructValueWrappedExpressionFromEvalCode<
    R,
    P extends Array<unknown>
>(evalCode: EvalCode<R, P>, expression: string, ...args: P): EvalCodePython<R> {
    const expressionToEval = evalCode.evalCode(expression, ...args);
    return convertExpressionIntoValueWrappedExpression<R>(expressionToEval);
}

export function constructRunSameExpressionWithMultipleEvaluatorsCode<
    EvalCodes extends EvalCode<unknown>[]
>(
    expression: string,
    evals: EvalCodes
): EvalCodePython<{
    [K in keyof EvalCodes]: EvalCodes[K] extends EvalCode<infer R>
        ? Except<R>
        : never;
}> {
    const lazyEvalExpression = `lambda: ${expression}`;
    const lambdas = evals.map(({ evalCode }) => `lambda x: ${evalCode("x")}`);
    const asList = concatExpressionsToPythonList(lambdas);
    return {
        pythonCode: `${SAME_VALUE_MULTIPLE_CALLABLES}(${lazyEvalExpression}, ${asList})`,
    };
}

export function combineMultiEvalCodePython<
    EvalCodesPython extends EvalCodePython<unknown>[]
>(
    multiEvalCodePython: EvalCodesPython
): EvalCodePython<{
    [K in keyof EvalCodesPython]: EvalCodesPython[K] extends EvalCodePython<
        infer R
    >
        ? R
        : never;
}> {
    const code = concatExpressionsToPythonList(
        multiEvalCodePython.map(({ pythonCode }) => pythonCode)
    );
    return {
        pythonCode: code,
    };
}
