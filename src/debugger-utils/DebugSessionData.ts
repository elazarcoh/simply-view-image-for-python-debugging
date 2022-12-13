import * as vscode from "vscode";
import * as fsp from "path";
import { defaultSaveDir, SavePathHelper } from "../SerializationHelper";
import { DebugVariablesTracker } from "./DebugVariablesTracker";

export class DebugSessionData {
    public readonly debugVariablesTracker: DebugVariablesTracker;
    public readonly savePathHelper: SavePathHelper;
    constructor(private readonly session: vscode.DebugSession) {
        this.debugVariablesTracker = new DebugVariablesTracker();

        const saveDir = fsp.join(defaultSaveDir(), session.id);
        this.savePathHelper = new SavePathHelper(saveDir);
    }
}
