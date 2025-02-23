import * as vscode from "vscode";
import Container, { Service } from "typedi";
import { JupyterSessionData } from "./JupyterSessionData";

@Service()
class JupyterSessionRegistry {
  private _sessions: Map<string, JupyterSessionData> = new Map();

  private static uriToId(uri: vscode.Uri): string {
    return uri.toString();
  }

  public debugSessionData(uri: vscode.Uri): JupyterSessionData {
    const id = JupyterSessionRegistry.uriToId(uri);
    if (!this._sessions.has(id)) {
      const debugSessionData = new JupyterSessionData(id);
      this._sessions.set(id, debugSessionData);
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._sessions.get(id)!;
  }
}

export function jupyterSessionData(uri: vscode.Uri): JupyterSessionData {
  return Container.get(JupyterSessionRegistry).debugSessionData(uri);
}
