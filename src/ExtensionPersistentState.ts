import type * as vscode from 'vscode';
import { Service } from 'typedi';

@Service()
export class ExtensionPersistentState {
  constructor(
    public readonly global: vscode.Memento,
    public readonly workspace: vscode.Memento,
  ) {}
}
