import { Kernel } from "@vscode/jupyter-extension";
import * as vscode from "vscode";
import { None, Option, Optional } from "../utils/Option";
import { getSessionDataById as getDebugSessionDataById } from "./debugger/DebugSessionsHolder";
import { findJupyterSessionByDocumentUri } from "./jupyter/JupyterSessionRegistry";

export type DebugSession = {
  type: "debug";
  session: vscode.DebugSession;
};
export type JupyterSession = {
  type: "jupyter";
  uri: vscode.Uri;
  kernel: Kernel;
};
export type Session = DebugSession | JupyterSession;

export function jupyterSession(
  uri: vscode.Uri,
  kernel: Kernel,
): JupyterSession {
  return { type: "jupyter", uri, kernel };
}
export function debugSession(session: vscode.DebugSession): DebugSession {
  return { type: "debug", session };
}

export function maybeDebugSession(
  maybeSession: Optional<vscode.DebugSession>,
): Option<DebugSession> {
  return Option.wrap(maybeSession).map(debugSession);
}

export function isDebugSession(
  session: Session,
): session is DebugSession & { type: "debug" } {
  return session.type === "debug";
}
export function isJupyterSession(
  session: Session,
): session is JupyterSession & { type: "jupyter" } {
  return session.type === "jupyter";
}

export function sessionToId(session: Session): string {
  if (isDebugSession(session)) {
    return `debug://${session.session.id}`;
  } else if (isJupyterSession(session)) {
    return `jupyter://${session.uri.toString()}`;
  }
  throw new Error("Unknown session type");
}

function parseDebugSessionId(id: string): Option<DebugSession> {
  const match = id.match(/^debug:\/\/(.+)$/);
  if (match) {
    const sessionId = match[1];
    const session = getDebugSessionDataById(sessionId);
    return session.map((s) => {
      return {
        type: "debug",
        session: s.session,
      } as DebugSession;
    });
  }
  return None;
}

function parseJupyterSessionId(id: string): Option<JupyterSession> {
  const match = id.match(/^jupyter:\/\/(.+)$/);
  if (match) {
    const uriString = match[1];
    const uri = vscode.Uri.parse(uriString);
    const sessionData = findJupyterSessionByDocumentUri(uri);
    return sessionData.map((session) => {
      return {
        type: "jupyter",
        uri: session.uri,
        kernel: session.kernel,
      } as JupyterSession;
    });
  }
  return None;
}

export function parseSessionId(id: string): Option<Session> {
  return Option.any(parseDebugSessionId(id), parseJupyterSessionId(id));
}
