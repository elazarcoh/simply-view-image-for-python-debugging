import * as vscode from "vscode";
import ViewImageService from "./ViewImageService";
import ViewPlotService from "./ViewPlotService";
import ViewTensorService from "./ViewTensorService";
import { tmpdir } from "os";
import { mkdirSync, existsSync, readdirSync, unlinkSync, chmodSync } from "fs";
import { join } from "path";
import { UserSelection, VariableSelection } from "./PythonSelection";
import { pythonVariablesService } from "./PythonVariablesService";
import {
  VariableWatchTreeItem,
  VariableWatcher,
} from "./WatchVariable";
import { ViewerService } from "./ViewerService";
import { extensionConfigSection, getConfiguration, WatchServices } from "./config";
import { debugVariablesTrackerService } from "./DebugVariablesTracker";
import { DebugProtocol } from "vscode-debugprotocol";
import { initLog, logDebug, logTrace } from "./logging";
import SUPPORTED_SERVICES from "./supported-services";
import { openImageToTheSide } from "./open-image";
import { WatchTreeProvider } from "./WatchTreeProvider";
import { ExpressionsWatcher } from "./WatchExpression";

let viewImageSrv: ViewImageService;
let viewPlotSrv: ViewPlotService;
let viewTensorSrv: ViewTensorService;

let variableWatcherSrv: VariableWatcher;
let expressionsWatcherSrv: ExpressionsWatcher;
let watchTreeProvider: WatchTreeProvider;

// const services: IStackWatcher[] = [];
const viewServices: { [key in WatchServices]?: ViewerService } = {};

const WORKING_DIR = "svifpd";

function onConfigChange(): void {
  initLog();
}

function patchDebugVariableContext(variablesResponse: DebugProtocol.VariablesResponse) {
  const viewableTypes = [
    "AxesSubplot",
    "Figure",
  ]
  variablesResponse.body.variables.forEach((v) => {
    if (v.type && viewableTypes.includes(v.type)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (v as any).__vscodeVariableMenuContext = 'viewableInGraphicViewer';
    }
  });
}

export function activate(context: vscode.ExtensionContext): void {

  onConfigChange();
  vscode.workspace.onDidChangeConfiguration(config => {
    if (config.affectsConfiguration(extensionConfigSection)) {
      onConfigChange();
    }
  });

  const usetmp = getConfiguration("useTmpPathToSave");
  let dir = context.globalStorageUri.fsPath;
  if (usetmp || dir === undefined) {
    dir = tmpdir();
    dir = join(dir, WORKING_DIR);
  }
  logDebug(`Using ${dir} as save directory`);

  // setup the services
  logDebug("Setting up view services");
  viewImageSrv = new ViewImageService(dir);
  viewServices["images"] = viewImageSrv;
  viewPlotSrv = new ViewPlotService(dir);
  viewServices["plots"] = viewPlotSrv;
  viewTensorSrv = new ViewTensorService(dir);
  viewServices["image-tensors"] = viewTensorSrv;

  // create output directory if it doesn't exist
  if (existsSync(dir)) {
    logDebug("cleanup old files in save directory");
    const files = readdirSync(dir);
    files.forEach((file) => {
      const curPath = join(dir, file);
      unlinkSync(curPath);
    });
  } else {
    logDebug("create save directory");
    mkdirSync(dir);
    if (usetmp) {
      chmodSync(dir, 0o777); // make the folder world writable for other users uses the extension
    }
  }

  variableWatcherSrv = new VariableWatcher(viewServices);
  expressionsWatcherSrv = new ExpressionsWatcher();
  watchTreeProvider = new WatchTreeProvider(variableWatcherSrv, expressionsWatcherSrv);

  // register watcher for the debugging session. used to identify the running-frame,
  // so multi-thread will work
  // inspired from https://github.com/microsoft/vscode/issues/30810#issuecomment-590099482
  const createDebugAdapterTracker = () => {
    type Request<T> = T & { type: 'request' };
    type Response<T> = T & { type: 'response' };
    type WithEvent<T, Event> = T & { type: 'event', event: Event }
    type WithCommand<T, Command> = T & { command: Command }
    type RecvMsg =
      WithCommand<Request<DebugProtocol.ScopesRequest>, "scopes">
      | WithCommand<Request<DebugProtocol.VariablesRequest>, 'variables'>
      | WithCommand<Request<DebugProtocol.EvaluateRequest>, 'evaluate'>

    type SendMsg =
      WithEvent<DebugProtocol.StoppedEvent, "stopped">
      | WithEvent<DebugProtocol.ContinuedEvent, "continued">
      | WithCommand<Response<DebugProtocol.VariablesResponse>, "variables">
      | WithCommand<Response<DebugProtocol.ScopesResponse>, "scopes">

    return {
      onWillStartSession: () => {
        variableWatcherSrv.activate();
      },

      onWillStopSession: () => {
        variableWatcherSrv.deactivate();
        watchTreeProvider.refresh();
      },

      onWillReceiveMessage: async (msg: RecvMsg) => {
        if (msg.type === "request" && msg.command === "scopes") {
          return debugVariablesTrackerService().onScopesRequest(msg);
        } else if (msg.type === "request" && msg.command === "variables") {
          return debugVariablesTrackerService().onVariablesRequest(msg);
        } else if (msg.type === "request" && msg.command === "evaluate" && /^\s*$/.test(msg.arguments.expression)) {
          // this is our call, in "update-frame-id" command.
          return debugVariablesTrackerService().setFrameId(msg.arguments.frameId);
        }
      },

      onDidSendMessage: async (msg: SendMsg) => {

        if (msg.type === "event" && msg.event === "stopped" && msg.body.threadId !== undefined) {
          variableWatcherSrv.activate();  // just in case it wasn't set earlier for some reason
          const updateWatchView = () => {
            return variableWatcherSrv
              .refreshVariablesAndWatches()
              .then(() => watchTreeProvider.refresh())
              .catch((e) => logTrace(e));
          };
          return setTimeout(updateWatchView, 100); // wait a bit for the variables to be updated

        } else if (msg.type === 'response' && msg.command === 'variables') {
          if (msg.body && getConfiguration('addViewContextEntryToVSCodeDebugVariables')) patchDebugVariableContext(msg);
          return debugVariablesTrackerService().onVariablesResponse(msg);
        } else if (msg.type === "event" && msg.event === "continued") {
          return debugVariablesTrackerService().onContinued();
        } else if (msg.type === "response" && msg.command === "scopes") {
          return debugVariablesTrackerService().onScopesResponse(msg);
        }
      },
    };
  };

  // register the debug adapter tracker
  logDebug("Registering debug adapter tracker for python");
  vscode.debug.registerDebugAdapterTrackerFactory("python", {
    createDebugAdapterTracker
  });
  logDebug("Registering debug adapter tracker for python-Jupyter");
  vscode.debug.registerDebugAdapterTrackerFactory("Python Kernel Debug Adapter", {
    createDebugAdapterTracker
  });

  logDebug("Registering code actions provider (the lightbulb)");
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "python",
      new PythonViewImageProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.Empty] }
    )
  );

  logDebug("Registering image watch tree view provider");
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "pythonDebugImageWatch",
      watchTreeProvider
    )
  );

  // add commands
  logDebug("Registering commands");
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
        openImageToTheSide(path, true);
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
        openImageToTheSide(path, true);
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
        openImageToTheSide(path, true);
      }
    )
  );

  // command to get the current frame, using a hacky way.
  context.subscriptions.push(
    vscode.commands.registerCommand("svifpd.update-frame-id", async () => {
      const activeTextEditor = vscode.window.activeTextEditor;
      if (activeTextEditor) {
        const prevSelection = activeTextEditor.selection;
        let whitespaceLocation = null;
        for (let i = 0; i < activeTextEditor.document.lineCount && whitespaceLocation === null; i++) {
          const line = activeTextEditor.document.lineAt(i);
          const whitespaceIndex = line.text.search(/\s/);
          if (whitespaceIndex !== -1) {
            whitespaceLocation = new vscode.Position(i, whitespaceIndex);
          }
        }
        if (whitespaceLocation === null) return;
        activeTextEditor.selection = new vscode.Selection(whitespaceLocation, whitespaceLocation.translate({ characterDelta: 1 }));
        await vscode.commands.executeCommand('editor.debug.action.selectionToRepl', {}).then(() => {
          activeTextEditor.selection = prevSelection;
        });
      }
    })
  );

  // image watch command
  for (const [type, _] of SUPPORTED_SERVICES) {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        `svifpd.watch-view-${type}`,
        async (watchVariable: VariableWatchTreeItem) => {
          const path = await watchVariable.viewerServiceByType(type)?.save(
            { variable: watchVariable.evaluateName },
            watchVariable.path
          );
          if (path === undefined) {
            return;
          }
          openImageToTheSide(path, false);
        }
      )
    );
  }

  // image watch track commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "svifpd.watch-track-enable",
      async (watchVariable: VariableWatchTreeItem) => {
        watchVariable.setTracked();
        watchTreeProvider.refresh();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "svifpd.watch-track-disable",
      async (watchVariable: VariableWatchTreeItem) => {
        watchVariable.setNonTracked();
        watchTreeProvider.refresh();
      }
    )
  );

  // image watch manual refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand("svifpd.watch-refresh", async () => {
      // just in case it wasn't set earlier for some reason
      variableWatcherSrv.activate();
      await variableWatcherSrv.refreshVariablesAndWatches();
      watchTreeProvider.refresh();
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

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "svifpd.view-debug-variable",
      async ({ variable }) => {
        const variableSelection: VariableSelection = {
          variable: variable.evaluateName
        }
        const command = await inspectToGetCommand(variableSelection);
        if (command !== undefined) {
          await vscode.commands.executeCommand(command.command, variableSelection);
        }
      }
    )
  );

  // Add expression command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      `svifpd.add-expression`,
      async () => {
        const maybeExpression = await vscode.window.showInputBox({
          prompt: "Enter expression to watch",
          placeHolder: "e.g. images[0]",
          ignoreFocusOut: true,
        });
        if (maybeExpression !== undefined) {
          expressionsWatcherSrv.addExpression(maybeExpression);
          watchTreeProvider.refresh();
        }
      }
    )
  );
}

async function inspectToGetCommand(userSelection: UserSelection) {

  const [isAnImage, _] = await viewImageSrv.isAnImage(userSelection);
  if (isAnImage) {
    return {
      command: "svifpd.view-image",
      title: "View Image",
      arguments: [userSelection],
    };
  }

  const [isAPlot, plotType] = await viewPlotSrv.isAPlot(userSelection);
  if (isAPlot) {
    return {
      command: "svifpd.view-plot",
      title: `View Plot (${plotType})`,
      arguments: [userSelection],
    };
  }

  const [isATensor, tensorType] = await viewTensorSrv.isATensor(
    userSelection
  );
  if (isATensor) {
    return {
      command: "svifpd.view-tensor",
      title: `View Tensor (${tensorType})`,
      arguments: [userSelection],
    };
  }

  return undefined;
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

    const command = await inspectToGetCommand(userSelection);
    if (command !== undefined) {
      return [command];
    } else {
      return undefined;
    }
  }
}
