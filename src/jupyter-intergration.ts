import * as vscode from "vscode";
import { jupyterSession } from "./session/Session";
import { runSetup } from "./python-communication/Setup";
import { viewObject } from "./ViewPythonObject";
import { AllViewables } from "./AllViewables";
import Container from "typedi";
import { Jupyter } from "@vscode/jupyter-extension";
import _ from "lodash";

const COMMAND = "svifpd.view-jupyter-debug-variable";

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

// function waitForStableState(kernel: Kernel): Promise<void> {
//   let currentStatus = kernel.status;
//   let dirty = false;
//   const dispose = kernel.onDidChangeStatus((status) => {
//     dirty = true;
//     currentStatus = status;
//   }).dispose;
//   return new Promise<void>((resolve) => {
//     const interval = setInterval(() => {
//       if (!dirty && currentStatus === "idle") {
//         clearInterval(interval);
//         dispose();
//         resolve();
//       } else {
//         dirty = false;
//       }
//     }, 100);
//   });
// }
