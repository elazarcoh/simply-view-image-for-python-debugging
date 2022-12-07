import * as vscode from "vscode";
import { Service } from "typedi";
import { DebugSessionData } from "./DebugSessionData";

@Service()
export class DebugSessionsHolderSingleton {
    private _debugSessions: Map<vscode.DebugSession['id'], DebugSessionData> = new Map();

    public debugSessionData(session: vscode.DebugSession): DebugSessionData {
        const id = session.id;
        if (!this._debugSessions.has(id)) {
            this._debugSessions.set(id, new DebugSessionData(session));
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this._debugSessions.get(id)!;
    }


}