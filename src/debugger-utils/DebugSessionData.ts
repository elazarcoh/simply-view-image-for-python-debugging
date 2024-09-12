import * as vscode from "vscode";
import { CurrentPythonObjectsList } from "../image-watch-tree/PythonObjectsList";
import { TrackedPythonObjects } from "../image-watch-tree/TrackedPythonObjects";
import { SavePathHelper } from "../SerializationHelper";
import { DebugVariablesTracker } from "./DebugVariablesTracker";
import { ExtensionDiagnostics } from "../image-watch-tree/DiagnosticsItem";

export class DebugSessionData {
    public readonly savePathHelper: SavePathHelper;
    public readonly debugVariablesTracker: DebugVariablesTracker =
        new DebugVariablesTracker();
    public readonly trackedPythonObjects: TrackedPythonObjects =
        new TrackedPythonObjects();
    public readonly currentPythonObjectsList: CurrentPythonObjectsList;
    public readonly diagnostics: ExtensionDiagnostics = new ExtensionDiagnostics();
    public setupOkay: boolean = false;
    public isStopped: boolean = false;

    constructor(session: vscode.DebugSession) {
        this.savePathHelper = new SavePathHelper(session.id);
        this.currentPythonObjectsList = new CurrentPythonObjectsList(
            this.debugVariablesTracker,
            session
        );
    }
}
