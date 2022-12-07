import * as vscode from "vscode";
import { DebugVariablesTracker } from "./DebugVariablesTracker";

export class DebugSessionData {
    public readonly debugVariablesTracker: DebugVariablesTracker;
    constructor(private readonly session: vscode.DebugSession) {
        this.debugVariablesTracker = new DebugVariablesTracker();
    }
}
