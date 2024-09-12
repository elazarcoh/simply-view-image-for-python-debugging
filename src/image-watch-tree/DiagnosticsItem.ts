import * as vscode from 'vscode';

export class ExtensionDiagnostics {
    public readonly _diagnosticsItems: DiagnosticsTreeItem[] = [];
    private readonly _onDidChange = new vscode.EventEmitter<void>();

    public update() {
        this._diagnosticsItems.push(new DiagnosticsTreeItem(`Diagnostics ${this._diagnosticsItems.length}`));
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
}