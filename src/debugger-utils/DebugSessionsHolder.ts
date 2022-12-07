import * as vscode from "vscode";
import { Service } from "typedi";
import { DebugSessionData } from "./DebugSessionData";

@Service()
export class DebugSessionsHolder {
    private _debugSessions: Map<vscode.DebugSession["id"], DebugSessionData> =
        new Map();

    public debugSessionData(session: vscode.DebugSession): DebugSessionData {
        const id = session.id;
        if (!this._debugSessions.has(id)) {
            const debugSessionData = new DebugSessionData(session);
            this._debugSessions.set(id, debugSessionData);
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this._debugSessions.get(id)!;
    }
}
