import * as vscode from "vscode";
import { CurrentPythonObjectsList } from "../image-watch-tree/PythonObjectsLists";
import { TrackedPythonObjects } from "../image-watch-tree/TrackedPythonObjects";
import { SavePathHelper } from "../SerializationHelper";
import { DebugVariablesTracker } from "./DebugVariablesTracker";

export class DebugSessionData {
    public readonly savePathHelper: SavePathHelper;
    public readonly debugVariablesTracker: DebugVariablesTracker =
        new DebugVariablesTracker();
    public readonly trackedVariables: TrackedPythonObjects =
        new TrackedPythonObjects();
    public readonly currentPythonObjectsList: CurrentPythonObjectsList;

    constructor(session: vscode.DebugSession) {
        this.savePathHelper = new SavePathHelper(session.id);
        this.currentPythonObjectsList = new CurrentPythonObjectsList(
            this.debugVariablesTracker,
            session
        );
    }
}
