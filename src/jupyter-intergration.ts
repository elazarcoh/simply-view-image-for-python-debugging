import * as vscode from "vscode";
import { jupyterSession } from "./session/Session";
import { runSetup } from "./python-communication/Setup";
import { viewObject } from "./ViewPythonObject";
import { AllViewables } from "./AllViewables";
import Container from "typedi";
import { Jupyter, Kernel } from "@vscode/jupyter-extension";
import _ from "lodash";

const COMMAND = "svifpd.view-jupyter-debug-variable";

function onChange(event) {
  console.log(event);
}
const event = new vscode.EventEmitter();
event.event(onChange);
let registered = false;


type JupyterVariable = {
  name: string;
  supportsDataExplorer: boolean;
  type: string;
  fullType: string;
  fileName: { path: string; scheme: string };
  value: string;
  size: number;
};

export async function viewVariableFromJupyterDebugView(
  variable: JupyterVariable,
) {
  const ext = vscode.extensions.getExtension<Jupyter>("ms-toolsai.jupyter");
  await ext?.activate();
  const api = ext?.exports;
  if (!api) {
    return;
  }
  const uri = vscode.Uri.from({
    scheme: variable.fileName.scheme,
    path: variable.fileName.path,
  });
  const kernel = await api.kernels.getKernel(uri);
  if (!kernel) {
    return;
  }
  if (!registered) {
    kernel.onDidChangeStatus(console.log);
    registered = true;
  }
  const session = jupyterSession(uri, kernel);
  const setupOk = await runSetup(session, false);
  if (!setupOk) {
    return;
  }
  const viewable = Container.get(AllViewables).allViewables.find(
    (v) => v.type === "numpy_image",
  );
  if (!viewable) {
    return;
  }
  viewObject({ variable: variable.name }, viewable, session);
}

export const JUPYTER_VIEW_COMMAND = COMMAND;
