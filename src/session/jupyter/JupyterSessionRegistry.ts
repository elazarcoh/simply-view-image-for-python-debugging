import * as vscode from "vscode";
import Container, { Service } from "typedi";
import { JupyterSessionData } from "./JupyterSessionData";
import { Jupyter, Kernel } from "@vscode/jupyter-extension";
import { jupyterSession, JupyterSession } from "../Session";
import { Err, joinResult, Ok, Result } from "../../utils/Result";
import { runSetup } from "../../python-communication/Setup";
import { convertExpressionIntoValueWrappedExpression } from "../../python-communication/BuildPythonCode";
import { evaluateInPython } from "../../python-communication/RunPythonCode";
import { logError } from "../../Logging";
import { Option } from "ts-results";

function waitForKernel(api: Jupyter, uri: vscode.Uri): Promise<Kernel> {
  return new Promise<Kernel>((resolve) => {
    const interval = setInterval(() => {
      api.kernels.getKernel(uri).then((kernel) => {
        if (kernel) {
          clearInterval(interval);
          resolve(kernel);
        }
      });
    }, 100);
  });
}

async function getSessionDocumentUri(
  session: JupyterSession,
): Promise<Result<vscode.Uri>> {
  const setupOk = await runSetup(session, false);
  if (!setupOk) {
    return Err("Failed to run setup");
  }
  const code = convertExpressionIntoValueWrappedExpression<string>("__file__");
  const res = joinResult(await evaluateInPython(code, session));
  const uri = res.andThen((r) => {
    if (typeof r === "string") {
      return Ok(vscode.Uri.file(r));
    } else {
      return Err("Failed to get session document uri");
    }
  });
  return uri;
}

@Service()
class JupyterSessionRegistry {
  private _sessions: Map<string, JupyterSessionData> = new Map();

  private static uriToId(uri: vscode.Uri): string {
    return uri.toString();
  }

  public debugSessionData(uri: vscode.Uri): JupyterSessionData | undefined {
    const id = JupyterSessionRegistry.uriToId(uri);
    return this._sessions.get(id);
  }

  public addSessionData(
    uri: vscode.Uri,
    data: JupyterSessionData,
  ): JupyterSessionData | undefined {
    const id = JupyterSessionRegistry.uriToId(uri);
    this._sessions.set(id, data);
    return this._sessions.get(id);
  }

  public removeSessionData(uri: vscode.Uri): void {
    const id = JupyterSessionRegistry.uriToId(uri);
    const sessionData = this._sessions.get(id);
    this._sessions.delete(id);
    if (sessionData) {
      sessionData.dispose();
    }
  }

  public dispose(): void {
    this._sessions.forEach((session) => session.dispose());
    this._sessions.clear();
  }

  public findSessionByDocumentUri(uri: vscode.Uri): Option<JupyterSession> {
    const sessionData = Array.from(this._sessions.values()).find(
      (sessionData) => sessionData.documentUri?.toString() === uri.toString(),
    );
    return Option.wrap(sessionData).map(({ notebookUri, kernel }) =>
      jupyterSession(notebookUri, kernel),
    );
  }
}

export async function onNotebookOpen(notebook: vscode.NotebookDocument) {
  const ext = vscode.extensions.getExtension<Jupyter>("ms-toolsai.jupyter");
  await ext?.activate();
  const api = ext?.exports;
  if (!api) {
    return;
  }
  const uri = notebook.uri;
  const kernel = await waitForKernel(api, uri);
  if (!kernel) {
    return;
  }
  const session = jupyterSession(uri, kernel);
  const sessionData = Container.get(JupyterSessionRegistry).addSessionData(
    uri,
    new JupyterSessionData(uri, kernel),
  );
  if (!sessionData) {
    logError("Failed to add session data to registry");
    return;
  }

  sessionData.jupyterHandler.onTerminating(() => {
    Container.get(JupyterSessionRegistry).removeSessionData(uri);
  });
  sessionData.jupyterHandler.onDead(() => {
    sessionData.isValid = false;
    sessionData.setupOkay = false;
    sessionData.currentPythonObjectsList.clear();
  });
  sessionData.jupyterHandler.onAutoRestarting(() => {
    sessionData.isValid = false;
    sessionData.setupOkay = false;
    sessionData.currentPythonObjectsList.clear();
  });
  sessionData.jupyterHandler.onRestarting(() => {
    sessionData.isValid = false;
    sessionData.setupOkay = false;
    sessionData.currentPythonObjectsList.clear();
  });
  sessionData.jupyterHandler.onStarting(() => {
    sessionData.isValid = false;
    sessionData.setupOkay = false;
    sessionData.currentPythonObjectsList.clear();
  });

  sessionData.jupyterHandler.onIdle(() => {
    sessionData.isValid = true;
    sessionData.isIdle = true;
  });

  const documentUri = await getSessionDocumentUri(session);
  if (documentUri.ok) {
    sessionData.documentUri = documentUri.val;
  }
}

export function jupyterSessionData(
  uri: vscode.Uri,
): JupyterSessionData | undefined {
  return Container.get(JupyterSessionRegistry).debugSessionData(uri);
}

const jupyterSessionRegistry = Container.get(JupyterSessionRegistry);
export const findJupyterSessionByDocumentUri =
  jupyterSessionRegistry.findSessionByDocumentUri.bind(jupyterSessionRegistry);
