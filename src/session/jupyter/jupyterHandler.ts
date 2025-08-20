import type { Kernel, KernelStatus } from '@vscode/jupyter-extension';
import * as vscode from 'vscode';
import { disposeAll } from '../../utils/VSCodeUtils';

export class JupyterHandler implements vscode.Disposable {
  private _disposables: vscode.Disposable[] = [];

  constructor(kernel: Kernel) {
    this._disposables.push(
      kernel.onDidChangeStatus((status) => {
        this.onKernelStatusChange(status);
      }),
    );
  }

  dispose() {
    disposeAll(this._disposables);
  }

  private _emitters = new Map<
    KernelStatus,
    vscode.EventEmitter<JupyterHandler>
  >();

  private _getEmitter(key: KernelStatus): vscode.EventEmitter<JupyterHandler> {
    if (!this._emitters.has(key)) {
      const emitter = new vscode.EventEmitter<JupyterHandler>();
      this._emitters.set(key, emitter);
      this._disposables.push(emitter);
    }
    // eslint-disable-next-line ts/no-non-null-assertion
    return this._emitters.get(key)!;
  }

  public onIdle = this._getEmitter('idle').event;
  public onBusy = this._getEmitter('busy').event;
  public onStarting = this._getEmitter('starting').event;
  public onDead = this._getEmitter('dead').event;
  public onRestarting = this._getEmitter('restarting').event;
  public onTerminating = this._getEmitter('terminating').event;
  public onAutoRestarting = this._getEmitter('autorestarting').event;

  private onKernelStatusChange(status: KernelStatus) {
    this._getEmitter(status).fire(this);
  }
}
