import * as vscode from "vscode";
import { SavePathHelper } from "../SerializationHelper";
import { DebugVariablesTracker } from "./DebugVariablesTracker";

export class DebugSessionData {
    public readonly debugVariablesTracker: DebugVariablesTracker;
    public readonly savePathHelper: SavePathHelper;
    constructor(private readonly session: vscode.DebugSession) {
        this.debugVariablesTracker = new DebugVariablesTracker();

        this.savePathHelper = new SavePathHelper(session.id);
    }
}
