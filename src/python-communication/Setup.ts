import { DebugSession } from "vscode";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
import { logDebug, logTrace } from "../Logging";
import {
    constructGetMainModuleErrorCode,
    constructGetViewablesErrorsCode,
    moduleSetupCode,
    verifyModuleExistsCode,
    viewablesSetupCode,
} from "./BuildPythonCode";
import { evaluateInPython, execInPython } from "./RunPythonCode";
import { isOkay, joinResult, Result } from "../utils/Result";
import _ from "lodash";
import { sleep } from "../utils/Utils";

export function setSetupIsNotOkay(): void {
    logTrace("Manual set 'setup is not okay'");
    const debugSessionData = activeDebugSessionData();
    if (debugSessionData !== undefined) {
        debugSessionData.setupOkay = false;
    }
}

async function checkSetupOkay(session: DebugSession) {
    const code = verifyModuleExistsCode();
    const res = await evaluateInPython(
        code,
        session,
        { context: "repl" },
        false,
    );
    return joinResult(res);
}

export async function runSetup(
    session: DebugSession,
    force?: boolean,
): Promise<boolean> {
    const debugSessionData = activeDebugSessionData(session);
    const maxTries = 5;

    const isSetupOkay = async () => {
        const result = await checkSetupOkay(session);
        if (result.err) {
            logDebug("Setup check failed", result.val);
            return false;
        } else if (result.safeUnwrap() === false) {
            logDebug("Setup check succeeded, but no setup");
            return false;
        } else {
            logDebug("Setup check succeeded, setup is okay");
            debugSessionData.setupOkay = true;
            return true;
        }
    };

    if (!force) {
        debugSessionData.setupOkay = await isSetupOkay();
        if (debugSessionData.setupOkay) {
            return true;
        }
    }

    const runDebounced = _.debounce(async () => {
        logDebug("Run module setup code");
        await execInPython(moduleSetupCode(), session);
        logDebug("Run viewables setup code");
        await execInPython(viewablesSetupCode(), session);
        const result = await isSetupOkay();
        debugSessionData.setupOkay = result;
        return debugSessionData.setupOkay;
    }, 500);

    for (let i = 0; i < maxTries; i++) {
        logDebug("Running setup... tries left:", maxTries - i);
        const isOk = await runDebounced();
        if (isOk) {
            return true;
        }
        await sleep(250 * 2 ** i);
    }

    return debugSessionData.setupOkay;
}

export async function getSetupStatus(
    session: DebugSession,
): Promise<{ mainModuleStatus: string; [key: string]: string }> {
    const mainModuleCode = constructGetMainModuleErrorCode();
    const mainModuleStatus = joinResult(
        await evaluateInPython(
            mainModuleCode,
            session,
            { context: "repl" },
            false,
        ),
    );
    if (mainModuleStatus.err) {
        return {
            mainModuleStatus: mainModuleStatus.toString(),
        };
    }

    const viewablesCode = constructGetViewablesErrorsCode();
    const viewablesStatus: Result<Result<[string, string]>[]> =
        await evaluateInPython(viewablesCode, session, {
            context: "repl",
        });
    if (viewablesStatus.err) {
        return {
            mainModuleStatus: mainModuleStatus.safeUnwrap(),
            viewablesStatus: viewablesStatus.toString(),
        };
    }

    return {
        mainModuleStatus: mainModuleStatus.safeUnwrap(),
        ...Object.fromEntries(
            viewablesStatus
                .safeUnwrap()
                .filter(isOkay)
                .map((r) => r.safeUnwrap()),
        ),
    };
}
