import * as vscode from "vscode";
import { Variable } from "./PythonSelection";
import { VariableInformation, ViewerService } from "./ViewerService";
import { allFulfilled, notEmpty } from "./utils";
import { getConfiguration, WatchServices } from "./config";
import { debugVariablesTrackerService } from "./DebugVariablesTracker";
import ViewImageService from "./ViewImageService";
import ViewPlotService from "./ViewPlotService";
import ViewTensorService from "./ViewTensorService";
import type { SupportedServicesNames } from "./supported-services";
import { WatchTreeItem } from "./WatchTreeItem";

enum VariableTrackingState {
  tracked = "trackedVariable",
  nonTracked = "nonTrackedVariable",
}

export class VariableWatcher {
  // this variable is used as a workaround. the debugger stopped event is emitted before the variables
  // are instantiated in the debugger, so the first stop results without any variables.
  // so, we add a another call to refresh, which will occur only if no info were acquired yet.
  private _hasInfo: boolean = false;

  // whether the watcher is activate
  private _activated: boolean = false;

  private _variables: VariableWatchTreeItem[] = [];

  constructor(
    private readonly viewServices: { [key in WatchServices]?: ViewerService },
  ) { }

  get hasInfo(): boolean {
    return this._hasInfo;
  }

  activate(): void {
    this._activated = getConfiguration("imageWatch.enable") ?? false;
  }

  deactivate(): void {
    this._activated = false;
    this._hasInfo = false;
    this._variables = [];
  }

  get activated(): boolean {
    return this._activated;
  }

  async refreshVariablesAndWatches(): Promise<void> {
    if (!this.activated) {
      return;
    }

    // workaround for the debugger does not set the variables before it stops,
    // so we'll retry until it works
    const getVariablesFunc = async () => {
      if (!this.activated) {
        return;
      }
      return this.acquireVariables();
    };
    const tryGetVariableRec = (resolve: (arg0: VariableWatchTreeItem[] | undefined) => void, _: unknown) => {
      setTimeout(async () => {
        try {
          const res = await getVariablesFunc();
          resolve(res);
        } catch {
          tryGetVariableRec(resolve, _);
        }
      }, 500);
    };

    function getVariables(): Promise<VariableWatchTreeItem[] | undefined> {
      return new Promise(tryGetVariableRec);
    }
    const newVariables = await getVariables();
    if (newVariables === undefined) {
      return;
    }
    this._hasInfo = true;

    const currentVariables = this._variables.reduce(
      (map: Record<string, VariableWatchTreeItem>, obj: VariableWatchTreeItem) => {
        map[obj.evaluateName] = obj;
        return map;
      },
      {}
    );

    for (const variable of newVariables) {
      const current = currentVariables[variable.evaluateName];
      if (current !== undefined) {
        variable.tracking = current.trackingState;
        variable.path = current.path;
        variable.iconPath = current.iconPath;
        variable.updateContext();
      }
    }

    this._variables = newVariables;

    // must be processes sequentially
    for (const v of this._variables.filter(
      (v) => v.trackingState === VariableTrackingState.tracked
    )) {
      // TODO: temporary solution is to use the first viewer service
      await v.viewServices[0].save({ variable: v.evaluateName }, v.path);
    }
  }

  private async acquireVariables() {
    const { locals, globals } = await debugVariablesTrackerService().currentFrameVariables();
    if (!globals) {
      // ask again
      await this.refreshVariablesAndWatches();
    }

    // take only unique variables by name
    const allVariables = [...locals, ...globals];
    const names = allVariables.map((v) => v.name);
    const uniqueVariables = allVariables.filter(
      (value, index) => names.indexOf(value.name) === index
    );

    const watchServicesInConfig = getConfiguration("imageWatch.objects") ?? [];
    const viewerServicesToUse = Object.entries(this.viewServices)
      .filter(([id, _]) => watchServicesInConfig.includes(id as WatchServices))
      .map(([_, srv]) => srv);
    const items = await allFulfilled(
      uniqueVariables
        .filter(mightBeViewable)
        .map((v) => toWatchVariable(v, viewerServicesToUse.filter(notEmpty)))
        .filter(notEmpty)
    );
    return items.filter(notEmpty);
  }

  variables(): VariableWatchTreeItem[] {
    return this._variables;
  }
}

export class VariableWatchTreeItem extends WatchTreeItem {
  public path: string;
  iconPath: vscode.ThemeIcon | undefined = undefined;
  tracking: VariableTrackingState = VariableTrackingState.nonTracked;
  types: SupportedServicesNames[] = [];

  constructor(
    public readonly label: string,
    public readonly evaluateName: string,
    public readonly variableInformation: Record<string, string>,
    public readonly viewServices: ViewerService[],
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.Collapsed
  ) {
    super(label, collapsibleState);
    this.path = viewServices[0].pathForSelection({ variable: evaluateName });
    for (const service of viewServices) {
      if (service instanceof ViewImageService) {
        this.types.push("image");
      }
      if (service instanceof ViewPlotService) {
        this.types.push("plot");
      }
      if (service instanceof ViewTensorService) {
        this.types.push("tensor");
      }
    }
    this.updateContext();
  }

  get trackingState(): VariableTrackingState {
    return this.tracking;
  }

  updateContext(): void {
    this.contextValue = this.tracking + "-" + this.types.join("_");
  }
  setTracked(): void {
    this.tracking = VariableTrackingState.tracked;
    this.iconPath = new vscode.ThemeIcon("eye");
    this.updateContext();
  }
  setNonTracked(): void {
    this.tracking = VariableTrackingState.nonTracked;
    this.iconPath = undefined;
    this.updateContext();
  }

  viewerServiceByType(type: SupportedServicesNames): ViewerService | undefined {
    const cls = type === "image" ? ViewImageService : type === "plot" ? ViewPlotService : ViewTensorService;
    return this.viewServices.find((s) => s instanceof cls);
  }

}

async function toWatchVariable(
  v: Variable,
  viewerServices: ViewerService[]
): Promise<VariableWatchTreeItem | undefined> {

  let variableInformation: VariableInformation | undefined;
  const services: ViewerService[] = [];

  for (const viewSrv of viewerServices) {
    const varInfo = await viewSrv.variableInformation({
      variable: v.evaluateName,
    }, v.type);
    if (varInfo !== undefined) {
      variableInformation = varInfo;
      services.push(viewSrv);
    }
  }
  if (variableInformation === undefined) {
    return;
  }
  return new VariableWatchTreeItem(variableInformation.name, variableInformation.name, variableInformation.more, services);
}

function mightBeViewable(mightBeViewable: { type?: string }): boolean {
  // list of python types that cannot be viewed. 
  // this will help to avoid querying the viewer service for types that cannot be viewed anyway.
  const NonViewableTypes = [
    "", "module", "dict", "tuple", "set", "str", "bytes",
    "NoneType", "int", "float", "bool", "ZMQExitAutocall", "function",
  ];
  return mightBeViewable.type !== undefined && !NonViewableTypes.includes(mightBeViewable.type);
}

