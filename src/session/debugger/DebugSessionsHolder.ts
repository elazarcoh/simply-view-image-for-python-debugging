import * as vscode from "vscode";
import Container, { Service } from "typedi";
import { DebugSessionData } from "./DebugSessionData";

@Service()
class DebugSessionsHolder {
  public debugSessions: Map<vscode.DebugSession["id"], DebugSessionData> =
    new Map();

  public debugSessionData(session: vscode.DebugSession): DebugSessionData {
    const id = session.id;
    if (!this.debugSessions.has(id)) {
      const debugSessionData = new DebugSessionData(session);
      this.debugSessions.set(id, debugSessionData);
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.debugSessions.get(id)!;
  }
}

export function activeDebugSessionData(
  session: vscode.DebugSession,
): DebugSessionData;
export function activeDebugSessionData(
  session: undefined | vscode.DebugSession,
): DebugSessionData | undefined;
export function activeDebugSessionData(): DebugSessionData | undefined;
export function activeDebugSessionData(
  session?: vscode.DebugSession | undefined,
): DebugSessionData | undefined {
  session ??= vscode.debug.activeDebugSession;
  return session
    ? Container.get(DebugSessionsHolder).debugSessionData(session)
    : undefined;
}

export function validDebugSessions(): DebugSessionData[] {
  const debugSessions = Container.get(DebugSessionsHolder).debugSessions;
  return Array.from(debugSessions.values()).filter(
    (session) => session.isValid,
  );
}
