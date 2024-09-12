import { DebugSession } from "vscode";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
import { logDebug, logTrace } from "../Logging";
import { debounce } from "../utils/Utils";
import {
    constructGetErrorsCode,
    moduleSetupCode,
    verifyModuleExistsCode,
    viewablesSetupCode,
} from "./BuildPythonCode";
import { execInPython, runPython } from "./RunPythonCode";
import { joinResult } from "../utils/Result";

export function setSetupIsNotOkay(): void {
    logTrace("Manual set 'setup is not okay'");
    const debugSessionData = activeDebugSessionData();
    if (debugSessionData !== undefined) {
        debugSessionData.setupOkay = false;
    }
}

async function checkSetupOkay(session: DebugSession) {
    const res = await runPython(verifyModuleExistsCode(), true, session, {
        context: "repl",
    });
    return joinResult(res);
}

export async function runSetup(
    session: DebugSession,
    force?: boolean
): Promise<boolean> {
    const debugSessionData = activeDebugSessionData(session);
    let maxTries = 5;

    const trySetupExtensionAndRunAgainIfFailed = async (): Promise<boolean> => {
        let isSetupOkay: boolean;
        if (force === true) {
            isSetupOkay = false;
            force = false;
            logDebug("Force run setup");
        } else {
            logDebug("Check setup is okay or not");
            const result = await checkSetupOkay(session);
            if (result.err) {
                logDebug("Setup check failed", result.val);
                isSetupOkay = false;
            } else if (result.safeUnwrap() === false) {
                logDebug("Setup check succeeded, but no setup");
                isSetupOkay = false;
            } else {
                logDebug("Setup check succeeded, setup is okay");
                isSetupOkay = true;
            }
        }

        if (isSetupOkay === false) {
            if (maxTries <= 0) {
                throw new Error("Setup failed");
            }

            debugSessionData.setupOkay = false;

            maxTries -= 1;
            logDebug("Running setup... tries left:", maxTries);
            logDebug("Run module setup code");
            await execInPython(moduleSetupCode(), session);
            logDebug("Run viewables setup code");
            await execInPython(viewablesSetupCode(), session);
            // run again to make sure setup is okay
            return trySetupExtensionAndRunAgainIfFailedDebounced();
        } else {
            debugSessionData.setupOkay = true;
            return true;
        }
    };

    const trySetupExtensionAndRunAgainIfFailedDebounced = debounce(
        trySetupExtensionAndRunAgainIfFailed,
        250
    );

    return trySetupExtensionAndRunAgainIfFailed();
}

export async function getDiagnostics(
    session: DebugSession
) {
    const code = constructGetErrorsCode();
    logDebug("Get diagnostics", code);
    const res = await runPython(code, true, session, {
        context: "repl",
    });
    logDebug("Get diagnostics result", res);
    return joinResult(res);
}