import { DebugSession } from "vscode";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
import { logDebug, logTrace } from "../Logging";
import { Except } from "../utils/Except";
import { debounce } from "../utils/Utils";
import {
    moduleSetupCode,
    verifyModuleExistsCode,
    viewablesSetupCode,
} from "./BuildPythonCode";
import { execInPython, runPython } from "./RunPythonCode";

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
    return Except.join(res);
}

export async function runSetup(session: DebugSession): Promise<boolean> {
    const debugSessionData = activeDebugSessionData(session);
    let maxTries = 5;

    const trySetupExtensionAndRunAgainIfFailed = async (): Promise<boolean> => {
        logDebug("Checks setup is okay or not");
        const isSetupOkay = await checkSetupOkay(session);

        if (Except.isError(isSetupOkay) || isSetupOkay.result === false) {
            if (maxTries <= 0) {
                throw new Error("Setup failed");
            }

            debugSessionData.setupOkay = false;

            maxTries -= 1;
            logDebug("No setup. Run setup code");
            await execInPython(moduleSetupCode(), session);
            await execInPython(viewablesSetupCode(), session);
            // run again to make sure setup is okay
            return trySetupExtensionAndRunAgainIfFailedDebounced();
        } else {
            logDebug("Setup is okay");
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
