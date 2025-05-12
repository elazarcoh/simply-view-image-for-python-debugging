import * as vscode from "vscode";
import { jupyterSession } from "./session/Session";
import { runSetup } from "./python-communication/Setup";
import { viewObject } from "./ViewPythonObject";
import { AllViewables } from "./AllViewables";
import Container, { Service } from "typedi";
import { Jupyter, Kernel, KernelStatus } from "@vscode/jupyter-extension";
import _ from "lodash";
import { disposeAll } from "./utils/VSCodeUtils";

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
  Container.get(Registry).addHandler(uri, kernel);
}

@Service()
class Registry {
  readonly handlers = new Map<string, JupyterHandler>();

  static async getKernel(
    uri: vscode.Uri,
    wait: boolean,
  ): Promise<Kernel | undefined> {
    const ext = vscode.extensions.getExtension<Jupyter>("ms-toolsai.jupyter");
    await ext?.activate();
    const api = ext?.exports;
    if (!api) {
      return;
    }
    if (!wait) {
      return api.kernels.getKernel(uri);
    } else {
      const kernel = await waitForKernel(api, uri);
      if (!kernel) {
        return;
      }
      return kernel;
    }
  }

  addHandler(uri: vscode.Uri, kernel: Kernel) {
    const handler = new JupyterHandler(uri, kernel);
    this.handlers.set(uri.toString(), handler);
  }

  removeHandler(uri: vscode.Uri) {
    const handler = this.handlers.get(uri.toString());
    if (handler) {
      handler.dispose();
      this.handlers.delete(uri.toString());
    }
  }

  getHandler(uri: vscode.Uri) {
    return this.handlers.get(uri.toString());
  }
}

export const JupyterHandlersRegistry = Registry;

class JupyterHandler implements vscode.Disposable {
  private _disposables: vscode.Disposable[] = [];

  constructor(
    readonly uri: vscode.Uri,
    readonly kernel: Kernel,
  ) {
    this._disposables.push(
      kernel.onDidChangeStatus((status) => {
        this.onKernelStatusChange(status);
      }),
    );
  }

  dispose() {
    disposeAll(this._disposables);
  }

  _onIdle() {
    console.log("Kernel idle");
  }

  onIdle = _.debounce(this._onIdle.bind(this), 200);

  private onKernelStatusChange(status: KernelStatus) {
    switch (status) {
      case "idle":
        this.onIdle();
        break;
      case "busy":
        break;
      case "starting":
        break;
      case "dead":
      case "restarting":
      case "terminating":
        this.dispose();
        Container.get(Registry).removeHandler(this.uri);
        break;
      case "autorestarting":
        break;
      default:
        break;
    }
  }
}
