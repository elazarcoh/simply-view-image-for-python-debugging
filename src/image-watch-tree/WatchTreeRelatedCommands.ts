import type { PythonObjectTreeItem } from './WatchTreeItem';
import Container from 'typedi';
import * as vscode from 'vscode';
import { activeDebugSessionData } from '../session/debugger/DebugSessionsHolder';
import { debugSession } from '../session/Session';
import { viewObject } from '../ViewPythonObject';
import { WatchTreeProvider } from './WatchTreeProvider';
import { VariableWatchTreeItem } from './WatchVariable';

function pythonObjectTreeItemSavePath(
  pythonObjectTreeItem: PythonObjectTreeItem,
  session: vscode.DebugSession,
): string {
  const debugSessionData = activeDebugSessionData(session);

  let savePath: string | undefined;
  if (pythonObjectTreeItem.trackingId) {
    savePath = debugSessionData.trackedPythonObjects.savePath(
      pythonObjectTreeItem.trackingId,
    );
  }
  if (savePath === undefined) {
    savePath = debugSessionData.savePathHelper.savePathFor(
      pythonObjectTreeItem instanceof VariableWatchTreeItem
        ? { variable: pythonObjectTreeItem.variableName }
        : { expression: pythonObjectTreeItem.expression },
    );
  }

  return savePath;
}

export function trackPythonObjectTreeItem(
  pythonObjectTreeItem: PythonObjectTreeItem,
): void {
  const debugSession = vscode.debug.activeDebugSession;
  if (debugSession !== undefined) {
    const debugSessionData = activeDebugSessionData(debugSession);
    const savePath = pythonObjectTreeItemSavePath(
      pythonObjectTreeItem,
      debugSession,
    );

    const trackingId = debugSessionData.trackedPythonObjects.track(
      { expression: pythonObjectTreeItem.expression },
      pythonObjectTreeItem.lastUsedViewable,
      savePath,
      pythonObjectTreeItem.trackingId,
    );

    pythonObjectTreeItem.setTracked(trackingId);
    Container.get(WatchTreeProvider).refresh(pythonObjectTreeItem);
  }
}

export function untrackPythonObjectTreeItem(
  pythonObjectTreeItem: PythonObjectTreeItem,
): void {
  if (pythonObjectTreeItem.trackingId) {
    activeDebugSessionData()?.trackedPythonObjects.untrack(
      pythonObjectTreeItem.trackingId,
    );
  }
  pythonObjectTreeItem.setNonTracked();
  Container.get(WatchTreeProvider).refresh(pythonObjectTreeItem);
}

export async function refreshWatchTree(): Promise<void> {
  await activeDebugSessionData()?.currentPythonObjectsList.update();
  Container.get(WatchTreeProvider).refresh();
}

async function viewWatchTreeItem(
  group: string,
  item: PythonObjectTreeItem,
  session: vscode.DebugSession,
): Promise<void> {
  const viewableToUse
    = item.lastUsedViewable.group === group
      ? item.lastUsedViewable
      : (item.viewables.find(v => v.group === group)
        ?? item.lastUsedViewable);
  item.lastUsedViewable = viewableToUse;

  if (item.trackingId) {
    activeDebugSessionData(session).trackedPythonObjects.changeViewable(
      item.trackingId,
      viewableToUse,
    );
  }

  const savePath = pythonObjectTreeItemSavePath(item, session);

  return viewObject({
    obj: { expression: item.expression },
    viewable: viewableToUse,
    session: debugSession(session),
    path: savePath,
  });
}

export function makeViewWatchTreeItemCommand(
  group: string,
): (item: PythonObjectTreeItem) => Promise<void> {
  return async (item: PythonObjectTreeItem): Promise<void> => {
    const debugSession = vscode.debug.activeDebugSession;
    if (debugSession !== undefined) {
      if (activeDebugSessionData(debugSession).isStopped) {
        await viewWatchTreeItem(group, item, debugSession);
      }
      else {
        vscode.window.showWarningMessage(
          'Cannot view object while debugging is not paused.',
        );
      }
    }
  };
}
