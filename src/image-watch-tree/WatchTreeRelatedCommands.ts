import * as vscode from "vscode";
import Container from "typedi";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
import { PythonObjectTreeItem } from "./WatchTreeItem";
import { WatchTreeProvider } from "./WatchTreeProvider";
import { VariableWatchTreeItem } from "./WatchVariable";
import { constructValueWrappedExpressionFromEvalCode } from "../python-communication/BuildPythonCode";
import { evaluateInPython } from "../python-communication/RunPythonCode";
import { openImageToTheSide } from "../utils/VSCodeUtils";
import { viewObject } from "../ViewPythonObject";

export function pythonObjectTreeItemSavePath(
    pythonObjectTreeItem: PythonObjectTreeItem,
    session: vscode.DebugSession
): string {
    const debugSessionData = activeDebugSessionData(session);

    let savePath: string | undefined;
    if (pythonObjectTreeItem.trackingId) {
        savePath = debugSessionData.trackedPythonObjects.savePath(
            pythonObjectTreeItem.trackingId
        );
    }
    if (savePath === undefined) {
        savePath = debugSessionData.savePathHelper.savePathFor(
            pythonObjectTreeItem instanceof VariableWatchTreeItem
                ? { variable: pythonObjectTreeItem.variableName }
                : { expression: pythonObjectTreeItem.expression }
        );
    }

    return savePath;
}

export function trackPythonObjectTreeItem(
    pythonObjectTreeItem: PythonObjectTreeItem
): void {
    const debugSession = vscode.debug.activeDebugSession;
    if (debugSession !== undefined) {
        const debugSessionData = activeDebugSessionData(debugSession);
        const savePath = pythonObjectTreeItemSavePath(
            pythonObjectTreeItem,
            debugSession
        );

        const trackingId = debugSessionData.trackedPythonObjects.track(
            { expression: pythonObjectTreeItem.expression },
            pythonObjectTreeItem.lastUsedViewable,
            savePath,
            pythonObjectTreeItem.trackingId
        );

        pythonObjectTreeItem.setTracked(trackingId);
        Container.get(WatchTreeProvider).refresh(pythonObjectTreeItem);
    }
}

export function untrackPythonObjectTreeItem(
    pythonObjectTreeItem: PythonObjectTreeItem
): void {
    if (pythonObjectTreeItem.trackingId) {
        activeDebugSessionData()?.trackedPythonObjects.untrack(
            pythonObjectTreeItem.trackingId
        );
    }
    pythonObjectTreeItem.setNonTracked();
    Container.get(WatchTreeProvider).refresh(pythonObjectTreeItem);
}

export async function refreshWatchTree(): Promise<void> {
    // make variables request
    // await activeDebugSessionData()?.debugVariablesTracker.frameForVariableReference
    // await vscode.debug.activeDebugSession?.customRequest('variables', {
    //     variablesReference: 0,
    // } as DebugProtocol.VariablesArguments)
    await activeDebugSessionData()?.currentPythonObjectsList.update();
    Container.get(WatchTreeProvider).refresh();
}

async function viewWatchTreeItem(
    group: string,
    item: PythonObjectTreeItem,
    session: vscode.DebugSession
): Promise<void> {
    const viewableToUse =
        item.lastUsedViewable.group === group
            ? item.lastUsedViewable
            : item.viewables.find((v) => v.group === group) ??
              item.lastUsedViewable;
    item.lastUsedViewable = viewableToUse;

    if (item.trackingId) {
        activeDebugSessionData(session).trackedPythonObjects.changeViewable(
            item.trackingId,
            viewableToUse
        );
    }

    const savePath = pythonObjectTreeItemSavePath(item, session);

    return viewObject(
        { expression: item.expression },
        viewableToUse,
        session,
        savePath
    );
}

export function makeViewWatchTreeItemCommand(
    group: string
): (item: PythonObjectTreeItem) => Promise<void> {
    return async (item: PythonObjectTreeItem): Promise<void> => {
        const debugSession = vscode.debug.activeDebugSession;
        if (debugSession !== undefined) {
            await viewWatchTreeItem(group, item, debugSession);
        }
    };
}
