// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import ViewImageService from "./ViewImageService";
import ViewPlotService from "./ViewPlotService";
import ViewTensorService from "./ViewTensorService";
import { tmpdir } from "os";
import { mkdirSync, existsSync, readdirSync, unlinkSync, chmodSync } from "fs";
import { join } from "path";
import { UserSelection } from "./PythonSelection";
import { pythonVariablesService } from "./PythonVariablesService";
import {
  VariableWatchTreeProvider,
  VariableItem,
  VariableWatcher,
} from "./VariableWatcher";
import { pythonInContextExecutor } from "./PythonInContextExecutor";
import { ViewerService } from "./ViewerService";
import { getConfiguration, WatchServices } from "./config";

let viewImageSrv: ViewImageService;
let viewPlotSrv: ViewPlotService;
let viewTensorSrv: ViewTensorService;

let variableWatcherSrv: VariableWatcher;
let variableWatchTreeProvider: VariableWatchTreeProvider;

const services: IStackWatcher[] = [];
const viewServices: { [key in WatchServices]?: ViewerService } = {};

const WORKING_DIR = "svifpd";

function viewImage(path: string, preview: boolean) {
  const options = {
    viewColumn: vscode.ViewColumn.Beside,
    preview: preview,
    preserveFocus: true,
  };
  return vscode.commands.executeCommand(
    "vscode.open",
    vscode.Uri.file(path),
    options
  );
}

export function activate(context: vscode.ExtensionContext): void {
  const usetmp = getConfiguration("useTmpPathToSave");
  let dir = context.globalStorageUri.fsPath;
  if (usetmp || dir === undefined) {
    dir = tmpdir();
    dir = join(dir, WORKING_DIR);
  }

  viewImageSrv = new ViewImageService(dir);
  viewServices["images"] = viewImageSrv;
  viewPlotSrv = new ViewPlotService(dir);
  viewServices["plots"] = viewPlotSrv;
  viewTensorSrv = new ViewTensorService(dir);
  viewServices["image-tensors"] = viewTensorSrv;

  if (existsSync(dir)) {
    const files = readdirSync(dir);
    files.forEach((file) => {
      const curPath = join(dir, file);
      unlinkSync(curPath);
    });
  } else {
    mkdirSync(dir);
    if (usetmp) {
      chmodSync(dir, 0o777); // make the folder world writable for other users uses the extension
    }
  }

  variableWatcherSrv = new VariableWatcher(viewServices);
  variableWatchTreeProvider = new VariableWatchTreeProvider(variableWatcherSrv);

  // register watcher for the debugging session. used to identify the running-frame,
  // so multi-thread will work
  // inspired from https://github.com/microsoft/vscode/issues/30810#issuecomment-590099482
  vscode.debug.registerDebugAdapterTrackerFactory("python", {
    createDebugAdapterTracker: (_) => {
      return {
        onWillStartSession: () => {
          variableWatcherSrv.activate();
        },

        onWillStopSession: () => {
          variableWatcherSrv.deactivate();
          variableWatchTreeProvider.refresh();
        },

        onWillReceiveMessage: async (msg) => {
          interface ScopesRequest {
            type: "request";
            command: "scopes";
            arguments: {
              frameId: number;
            };
          }
          const m = msg as ScopesRequest;
          if (m.type === "request" && m.command === "scopes") {
            const currentFrame = m.arguments.frameId;
            for (const service of services) {
              service.setFrameId(currentFrame);
            }
          }
        },

        onDidSendMessage: async (msg) => {
          interface StoppedEvent {
            type: "event";
            event: "stopped";
            body: {
              threadId: number;
            };
          }
          const m = msg as StoppedEvent;
          if (m.type === "event" && m.event === "stopped") {
            const currentThread = m.body.threadId;
            for (const service of services) {
              service.setThreadId(currentThread);
            }

            // just in case it wasn't set earlier for some reason
            variableWatcherSrv.activate();
            const updateWatchView = () => {
              return variableWatcherSrv
                .refreshVariablesAndWatches()
                .then(() => variableWatchTreeProvider.refresh())
                .catch((e) => console.log(e));
            };
            return updateWatchView();
          }
        },
      };
    },
  });

  // init services
  services.push(pythonVariablesService());
  services.push(pythonInContextExecutor());

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "python",
      new PythonViewImageProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.Empty] }
    )
  );

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "pythonDebugImageWatch",
      variableWatchTreeProvider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "svifpd.view-image",
      async (editor, _, userSelection?: UserSelection) => {
        userSelection ??
          (userSelection = await pythonVariablesService().userSelection(
            editor.document,
            editor.selection
          ));
        if (userSelection === undefined) {
          return;
        }

        const path = await viewImageSrv.save(userSelection);
        if (path === undefined) {
          return;
        }
        viewImage(path, true);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "svifpd.view-plot",
      async (editor, _, userSelection?: UserSelection) => {
        userSelection ??
          (userSelection = await pythonVariablesService().userSelection(
            editor.document,
            editor.selection
          ));
        if (userSelection === undefined) {
          return;
        }

        const path = await viewPlotSrv.save(userSelection);
        if (path === undefined) {
          return;
        }
        viewImage(path, true);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "svifpd.view-tensor",
      async (editor, _, userSelection?: UserSelection) => {
        userSelection ??
          (userSelection = await pythonVariablesService().userSelection(
            editor.document,
            editor.selection
          ));
        if (userSelection === undefined) {
          return;
        }

        const path = await viewTensorSrv.save(userSelection);
        if (path === undefined) {
          return;
        }
        viewImage(path, true);
      }
    )
  );

  // image watch command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "svifpd.watch-view",
      async (watchVariable: VariableItem) => {
        const path = await watchVariable.viewService.save(
          { variable: watchVariable.evaluateName },
          watchVariable.path
        );
        if (path === undefined) {
          return;
        }
        viewImage(path, false);
      }
    )
  );

  // image watch track commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "svifpd.watch-track-enable",
      async (watchVariable: VariableItem) => {
        watchVariable.setTracked();
        variableWatchTreeProvider.refresh();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "svifpd.watch-track-disable",
      async (watchVariable: VariableItem) => {
        watchVariable.setNonTracked();
        variableWatchTreeProvider.refresh();
      }
    )
  );

  // image watch manual refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand("svifpd.watch-refresh", async () => {
      // just in case it wasn't set earlier for some reason
      variableWatcherSrv.activate();
      await variableWatcherSrv.refreshVariablesAndWatches();
      variableWatchTreeProvider.refresh();
    })
  );

  // image watch open settings
  context.subscriptions.push(
    vscode.commands.registerCommand("svifpd.open-watch-settings", async () => {
      await vscode.commands.executeCommand("workbench.action.openSettings", {
        query: "svifpd.imageWatch.objects",
      });
    })
  );
}

/**
 * Provides code actions for python opencv image.
 */
export class PythonViewImageProvider implements vscode.CodeActionProvider {
  public async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): Promise<vscode.Command[] | undefined> {
    if (vscode.debug.activeDebugSession === undefined) {
      return undefined;
    }

    const userSelection = await pythonVariablesService().userSelection(
      document,
      range
    );
    if (userSelection === undefined) {
      return;
    }

    const [isAnImage, _] = await viewImageSrv.isAnImage(userSelection);
    if (isAnImage) {
      return [
        {
          command: "svifpd.view-image",
          title: "View Image",
          arguments: [userSelection],
        },
      ];
    }

    const [isAPlot, plotType] = await viewPlotSrv.isAPlot(userSelection);
    if (isAPlot) {
      return [
        {
          command: "svifpd.view-plot",
          title: `View Plot (${plotType})`,
          arguments: [userSelection],
        },
      ];
    }

    const [isATensor, tensorType] = await viewTensorSrv.isATensor(
      userSelection
    );
    if (isATensor) {
      return [
        {
          command: "svifpd.view-tensor",
          title: `View Tensor (${tensorType})`,
          arguments: [userSelection],
        },
      ];
    }

    return undefined;
  }
}
