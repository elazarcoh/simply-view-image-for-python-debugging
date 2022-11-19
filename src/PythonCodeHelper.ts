import * as vscode from "vscode";
import COMMON from "./python/common.py?raw";
import BOOKKEEPING from "./python/bookkeeping.py?raw";
import { pythonInContextExecutor } from "./PythonInContextExecutor";
import * as P from 'parsimmon';
import { ValueOrError } from "./utils/ValueOrError";

const PythonConstructs = P.createLanguage({
    Quote: _ => P.oneOf("'\""),
    Tuple: r => r.PythonValue.sepBy(P.string(",").trim(P.optWhitespace)).wrap(P.string("("), P.string(")")),
    List: r => r.PythonValue.sepBy(P.string(",").trim(P.optWhitespace)).wrap(P.string("["), P.string("]")),
    String: r => r.Quote.chain(quote => P.takeWhile(c => c !== quote).skip(P.string(quote))),
    None: _ => P.string("None").result(null),
    KeyValue: r => P.seqObj<string, any>(
        ["key", r.String],
        P.string(":").trim(P.optWhitespace),
        ["value", r.PythonValue],
    ),
    Dict: r => r.KeyValue
        .sepBy(P.string(",").trim(P.optWhitespace))
        .wrap(P.string("{").trim(P.optWhitespace), P.string("}").trim(P.optWhitespace))
        .map((keyValues) => Object.fromEntries(keyValues.map(kv => [kv.key, kv.value]))),
    PythonValue: r => P.alt(r.Tuple, r.String, r.Dict, r.List, r.None),
    Error: r => r.Quote.chain(q => P.seqObj<{ error: string }>(
        P.string("Error"),
        P.string("(").trim(P.optWhitespace),
        ["error", r.String],
        P.string(")").trim(P.optWhitespace),
    ).skip(P.string(q))),
    Value: r => r.Quote.chain(q => P.seqObj<{ result: unknown }>(
        P.string("Value"),
        P.string("(").trim(P.optWhitespace),
        ["result", r.PythonValue],
        P.string(")").trim(P.optWhitespace),
    ).skip(P.string(q))),
    ResultOrError: r => P.alt(
        r.Error.map(({ error }) => ({ isError: true, error })),
        r.None.map(() => ({ isError: false, value: null })),
        r.Value.map(({ result }) => ({ isError: false, result })),
    ),
});

export const pyModuleName = "_python_view_image_mod";

export function execInModuleCode(content: string, tryExpression: string): string {
    const code: string = `
try:
    ${pyModuleName}
except:
    
    from types import ModuleType
    ${pyModuleName} = ModuleType('python_view_image_mod', '')
    
try:
    ${pyModuleName}.savers  # code from 'common.py'
except:
    
    exec(
'''
${COMMON}
'''
    , ${pyModuleName}.__dict__
    )

try:
    ${tryExpression}
except:
 
    exec(
'''
${content}
'''
    , ${pyModuleName}.__dict__
    )
`
    return code;
}

type RequestId = string;

function genRequestId(): RequestId {
    return (+Date.now()).toString() + (Math.random() * 1000).toFixed(0);
}

export function execIntoBookkeepingCode(content: string): [string, RequestId] {
    const requestId = genRequestId();
    const setupCode = execInModuleCode(BOOKKEEPING, `assert hasattr(${pyModuleName}, "_add_bookkeeping")`);
    const addToBookkeepingCode = `
${pyModuleName}.add_bookkeeping("${requestId}", ${content})
`;
    const code = setupCode + "\n" + addToBookkeepingCode;
    return [code, requestId];
}

export function getFromBookkeepingCode(requestId: RequestId): string {
    const code = `
${pyModuleName}.get_bookkeeping("${requestId}")
`;
    return code;
}


async function runPython<T = unknown>(code: string, session?: vscode.DebugSession): Promise<ValueOrError<T>> {
    session = session ?? vscode.debug.activeDebugSession;
    if (session === undefined) {
        return {
            error: "no active debug session",
            isError: true,
        }
    }
    try {
        const res = await pythonInContextExecutor().evaluate(session, code);
        return PythonConstructs.ResultOrError.tryParse(res.result);
    } catch (error) {
        if (error instanceof Error) {
            return {
                error: error.message,
                isError: true,
            }
        } else {
            return {
                error: JSON.stringify(error),
                isError: true,
            }
        }
    }
}


export async function execPython(code: string, session?: vscode.DebugSession): Promise<ValueOrError<null>> {
    code = `
exec(\"\"\"
${code}
\"\"\"
)
`;
    return runPython<null>(code, session);
}

export async function evaluatePython<T = unknown>(code: string, session?: vscode.DebugSession): Promise<ValueOrError<T>> {
    return runPython<T>(code, session);
}