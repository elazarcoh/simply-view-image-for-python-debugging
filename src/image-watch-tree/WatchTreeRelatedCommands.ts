import Container from "typedi";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
import { PythonObjectTreeItem } from "./WatchTreeItem";
import { WatchTreeProvider } from "./WatchTreeProvider";

export function trackPythonObjectTreeItem(
    pythonObjectTreeItem: PythonObjectTreeItem
): void {
    const trackingId = activeDebugSessionData()?.trackedPythonObjects.track(
        { expression: pythonObjectTreeItem.expression },
        pythonObjectTreeItem.trackingId
    );
    if (trackingId) {
        pythonObjectTreeItem.setTracked(trackingId);
    }
    Container.get(WatchTreeProvider).refresh(pythonObjectTreeItem);
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
    await activeDebugSessionData()?.currentPythonObjectsList.update();
    Container.get(WatchTreeProvider).refresh();
}
