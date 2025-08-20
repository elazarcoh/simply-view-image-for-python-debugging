import type { Viewable } from './viewable/Viewable';
import { Service } from 'typedi';
import * as vscode from 'vscode';
import { makeViewWatchTreeItemCommand } from './image-watch-tree/WatchTreeRelatedCommands';
import { logWarn } from './Logging';

@Service()
export class AllViewables {
  private readonly _groups = new Set<string>();
  private readonly _allViewables: Viewable[] = [];

  public get allViewables(): ReadonlyArray<Viewable> {
    return this._allViewables;
  }

  public addViewable(viewable: Viewable): vscode.Disposable | undefined {
    if (this.allViewables.includes(viewable)) {
      logWarn('Viewable already added', viewable.type);
      return undefined;
    }
    this._allViewables.push(viewable);
    const allViewables = this._allViewables;

    const group = viewable.group;
    const groups = this._groups;
    const groupDisposables: vscode.Disposable[] = [];

    // Watch tree-item button command, which is per group
    if (!groups.has(group)) {
      groups.add(group);
      const command = `svifpd.watch-view-${group}`;
      groupDisposables.push(
        vscode.commands.registerCommand(
          command,
          makeViewWatchTreeItemCommand(group),
        ),
      );
    }

    const dispose = () => {
      const index = allViewables.indexOf(viewable);
      if (index > -1)
        allViewables.splice(index, 1);

      if (!allViewables.some(v => v.group === group)) {
        // no more remained from the group, dispose
        groups.delete(group);
        groupDisposables.forEach(d => d.dispose());
      }
    };

    return { dispose };
  }
}
