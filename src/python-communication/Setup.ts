import * as vscode from "vscode";
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
import Container from "typedi";
import { WatchTreeProvider } from "../image-watch-tree/WatchTreeProvider";
import { EXTENSION_IMAGE_WATCH_TREE_VIEW_ID } from "../globals";
import { DebugSessionData } from "../debugger-utils/DebugSessionData";

export function setSetupIsNotOkay(): void {
  logTrace("Manual set 'setup is not okay'");
  const debugSessionData = activeDebugSessionData();
  if (debugSessionData !== undefined) {
    debugSessionData.setupOkay = false;
  }
}

async function checkSetupOkay(session: DebugSession) {
  const code = verifyModuleExistsCode();
  const res = await evaluateInPython(code, session, { context: "repl" }, false);
  return joinResult(res);
}

async function handleSetupError(
  debugSessionData: DebugSessionData,
  debugSession: DebugSession,
) {
  const KEY = "ignoreSetupError";
  if ((debugSessionData.customState[KEY] ?? false) === true) {
    return;
  }
  const options = {
    ignore_for_session: "Ignore (current session)",
    show: "Show errors",
    retry: "Retry",
  };
  if (!debugSessionData.isDebuggerAttached) {
    return;
  }
  const selection = await vscode.window.showErrorMessage(
    "Failed to setup the python side of the extension.",
    options.show,
    options.ignore_for_session,
    options.retry,
  );
  switch (selection) {
    case options.show:
      const watchTreeProvider = Container.get(WatchTreeProvider);
      watchTreeProvider.showDiagnosticsTemporarily = true;
      await debugSessionData.diagnostics.update();
      watchTreeProvider.refresh();
      await vscode.commands.executeCommand(
        `${EXTENSION_IMAGE_WATCH_TREE_VIEW_ID}.focus`,
      );
      break;
    case options.retry:
      await runSetup(debugSession, true);
      break;
    case options.ignore_for_session:
      debugSessionData.customState[KEY] = true;
      break;
  }
}

async function _runSetup(
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

  const run = async () => {
    logDebug("Run module setup code");
    await execInPython(moduleSetupCode(), session);
    logDebug("Run viewables setup code");
    await execInPython(viewablesSetupCode(), session);
    const result = await isSetupOkay();
    debugSessionData.setupOkay = result;
    return debugSessionData.setupOkay;
  };

  // run N times without progress
  const numTriesWithoutProgress = 3;
  for (let i = 0; i < numTriesWithoutProgress; i++) {
    const isOk = await run();
    if (isOk) {
      return true;
    }
    await sleep(500 * 2 ** (i + 1));
  }

  // retry show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Setting up the python side of the extension...",
      cancellable: true,
    },
    async (progress, cancelToken) => {
      for (
        let i = numTriesWithoutProgress;
        debugSessionData.isDebuggerAttached &&
        !cancelToken.isCancellationRequested &&
        i < maxTries;
        i++
      ) {
        const message = `tries left: ${maxTries - i}`;
        progress.report({ message });
        logDebug("Running setup... tries left:", maxTries - i);
        const isOk = await run();
        if (isOk) {
          return true;
        }
        await sleep(500 * 2 ** (i + 1));
      }
    },
  );

  if (!debugSessionData.setupOkay) {
    handleSetupError(debugSessionData, session);
  }

  return debugSessionData.setupOkay;
}

export const runSetup = _.debounce(_runSetup, 1000, { leading: true });

export async function getSetupStatus(
  session: DebugSession,
): Promise<{ mainModuleStatus: string; [key: string]: string }> {
  const mainModuleCode = constructGetMainModuleErrorCode();
  const mainModuleStatus = joinResult(
    await evaluateInPython(mainModuleCode, session, { context: "repl" }, false),
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
