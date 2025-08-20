import type {
  DebugSessionData,
} from '../session/debugger/DebugSessionData';
import type { Session } from '../session/Session';
import type { Result } from '../utils/Result';
import _ from 'lodash';
import Container from 'typedi';
import * as vscode from 'vscode';
import { EXTENSION_IMAGE_WATCH_TREE_VIEW_ID } from '../globals';
import { WatchTreeProvider } from '../image-watch-tree/WatchTreeProvider';
import { logDebug, logTrace } from '../Logging';
import {
  isDebugSessionData,
} from '../session/debugger/DebugSessionData';
import { activeDebugSessionData } from '../session/debugger/DebugSessionsHolder';
import { getSessionData } from '../session/SessionData';
import { isOkay, joinResult } from '../utils/Result';
import { sleep } from '../utils/Utils';
import {
  constructGetMainModuleErrorCode,
  constructGetViewablesErrorsCode,
  moduleSetupCode,
  verifyModuleExistsCode,
  viewablesSetupCode,
} from './BuildPythonCode';
import { evaluateInPython, execInPython } from './RunPythonCode';

export function setSetupIsNotOkay(): void {
  logTrace('Manual set \'setup is not okay\'');
  const debugSessionData = activeDebugSessionData();
  if (debugSessionData !== undefined) {
    debugSessionData.setupOkay = false;
  }
}

async function checkSetupOkay(session: Session) {
  const code = verifyModuleExistsCode();
  const res = await evaluateInPython(code, session, { context: 'repl' }, false);
  return joinResult(res);
}

async function _runSetup(session: Session, force?: boolean): Promise<boolean> {
  const debugSessionData = getSessionData(session);
  if (!debugSessionData) {
    logDebug('No debug session data');
    return false;
  }

  const maxTries = 5;

  const isSetupOkay = async () => {
    const result = await checkSetupOkay(session);
    if (result.err) {
      logDebug('Setup check failed', result.val);
      return false;
    }
    else if (result.safeUnwrap() === false) {
      logDebug('Setup check succeeded, but no setup');
      return false;
    }
    else {
      logDebug('Setup check succeeded, setup is okay');
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
    logDebug('Run module setup code');
    await execInPython(moduleSetupCode(), session);
    logDebug('Run viewables setup code');
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
      title: 'Setting up the python side of the extension...',
      cancellable: true,
    },
    async (progress, cancelToken) => {
      for (
        let i = numTriesWithoutProgress;
        debugSessionData.isValid
        && !cancelToken.isCancellationRequested
        && i < maxTries;
        i++
      ) {
        const message = `tries left: ${maxTries - i}`;
        progress.report({ message });
        if (debugSessionData.canExecute) {
          logDebug('Running setup... tries left:', maxTries - i);
          const isOk = await run();
          if (isOk) {
            return true;
          }
        }
        await sleep(500 * 2 ** (i + 1));
      }
    },
  );

  if (!debugSessionData.setupOkay) {
    if (isDebugSessionData(debugSessionData)) {
      handleSetupError(debugSessionData, session);
    }
    else {
      vscode.window.showErrorMessage(
        'Failed to setup the python side of the extension.',
      );
    }
  }

  return debugSessionData.setupOkay;
}

export const runSetup = _.debounce(_runSetup, 1000, { leading: true });

async function handleSetupError(
  debugSessionData: DebugSessionData,
  session: Session,
) {
  const KEY = 'ignoreSetupError';
  if ((debugSessionData.customState[KEY] ?? false) === true) {
    return;
  }
  const options = {
    ignore_for_session: 'Ignore (current session)',
    show: 'Show errors',
    retry: 'Retry',
  };
  if (!debugSessionData.isDebuggerAttached) {
    return;
  }
  const selection = await vscode.window.showErrorMessage(
    'Failed to setup the python side of the extension.',
    options.show,
    options.ignore_for_session,
    options.retry,
  );

  const watchTreeProvider = Container.get(WatchTreeProvider);
  switch (selection) {
    case options.show:
      watchTreeProvider.showDiagnosticsTemporarily = true;
      await debugSessionData.diagnostics.update();
      watchTreeProvider.refresh();
      await vscode.commands.executeCommand(
        `${EXTENSION_IMAGE_WATCH_TREE_VIEW_ID}.focus`,
      );
      break;
    case options.retry:
      await runSetup(session, true);
      break;
    case options.ignore_for_session:
      debugSessionData.customState[KEY] = true;
      break;
  }
}

export async function getSetupStatus(
  session: Session,
): Promise<{ mainModuleStatus: string; [key: string]: string }> {
  const mainModuleCode = constructGetMainModuleErrorCode();
  const mainModuleStatus = joinResult(
    await evaluateInPython(mainModuleCode, session, { context: 'repl' }, false),
  );
  if (mainModuleStatus.err) {
    return {
      mainModuleStatus: mainModuleStatus.toString(),
    };
  }

  const viewablesCode = constructGetViewablesErrorsCode();
  const viewablesStatus: Result<Result<[string, string]>[]>
    = await evaluateInPython(viewablesCode, session, {
      context: 'repl',
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
        .map(r => r.safeUnwrap()),
    ),
  };
}
