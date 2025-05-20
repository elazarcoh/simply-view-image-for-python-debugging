import { Kernel } from "@vscode/jupyter-extension";
import * as vscode from "vscode";
import { Option, Optional } from "../utils/Option";

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
