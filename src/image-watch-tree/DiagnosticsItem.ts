import * as vscode from "vscode";
import { getSetupStatus } from "../python-communication/Setup";
import { PYTHON_MODULE_NAME } from "../python-communication/BuildPythonCode";
import { debugSession } from "../session/Session";

export class ExtensionDiagnostics {
  public readonly _diagnosticsItems: DiagnosticsTreeItem[] = [];
  private readonly _onDidChange = new vscode.EventEmitter<void>();

  constructor(private readonly debugSession: vscode.DebugSession) {}

  public async update() {
    this._diagnosticsItems.length = 0;

    const { mainModuleStatus, ...restModules } = await getSetupStatus(
      debugSession(this.debugSession),
    );
    this._diagnosticsItems.push(
      new DiagnosticsTreeItem(PYTHON_MODULE_NAME, mainModuleStatus),
    );
    for (const [moduleName, status] of Object.entries(restModules)) {
      this._diagnosticsItems.push(new DiagnosticsTreeItem(moduleName, status));
    }

    this._onDidChange.fire();
  }

  public onDidChange(callback: () => void) {
    return this._onDidChange.event(callback);
  }

  public getDiagnosticsItems(): DiagnosticsTreeItem[] {
    return this._diagnosticsItems;
  }
}

export class DiagnosticsTreeItem extends vscode.TreeItem {
  constructor(label: string, description?: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.tooltip = description;
  }
}
