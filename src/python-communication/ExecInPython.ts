import * as vscode from "vscode";
import { PythonInContextExecutor } from "./PythonInContextExecutor";
import { Except } from "../utils/Except";
import { parsePythonValue } from "./PythonValueParser";
import Container from "typedi";

const pythonInContextExecutor = Container.get(PythonInContextExecutor);

export const PYTHON_MODULE_NAME = "_python_view_image_mod";

function evalInModuleCode(evalCode: string) {
    return `${PYTHON_MODULE_NAME}.${evalCode}`;
}

async function runPython<T = unknown>(code: string, session?: vscode.DebugSession): Promise<Except<T>> {
    session = session ?? vscode.debug.activeDebugSession;
    if (session === undefined) {
        return Except.error("no active debug session");
    }
    try {
        const res = await pythonInContextExecutor.evaluate(session, code);
        return parsePythonValue<T>(res.result);
    } catch (error) {
        if (error instanceof Error) {
            return Except.error(error.message);
        } else {
            return Except.error(JSON.stringify(error));
        }
    }
}


export async function execInPython(code: string, session?: vscode.DebugSession): Promise<Except<null>> {
    code = `
exec(\"\"\"
${code}
\"\"\"
)
`;
    return runPython<null>(code, session);
}

export async function evaluateInPython<T = unknown>(code: string, session?: vscode.DebugSession): Promise<Except<T>> {
    return runPython<T>(evalInModuleCode(code), session);
}