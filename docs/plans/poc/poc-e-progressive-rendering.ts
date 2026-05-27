/**
 * POC E: Progressive / lazy UI rendering
 *
 * Current behaviour: the Image Watch tree stays completely empty (cleared at
 * the start of each stop) until ALL Python evaluations complete.  The user
 * sees a blank tree for the entire 500ms – 2000ms evaluation window.
 *
 * This POC demonstrates a streaming update pattern:
 *   1. On stop: immediately show all variable NAMES with "evaluating…" labels.
 *   2. Evaluate each variable's type and info.
 *   3. As results arrive (per-variable or per-batch), update individual tree items.
 *   4. Final state is identical to today — but the UI is responsive immediately.
 *
 * This does NOT reduce Python eval count.  It improves PERCEIVED performance.
 */

import * as vscode from 'vscode';
import type { Viewable } from '../../../src/viewable/Viewable';
import type { Result } from '../../../src/utils/Result';
import { Err } from '../../../src/utils/Result';

// ─── Placeholder tree item ────────────────────────────────────────────────────

/**
 * A tree item that can update itself from "evaluating…" to a real value.
 * The WatchTreeProvider holds a Map<name, LiveVariableItem> and fires
 * onDidChangeTreeItem for individual items without rebuilding the whole tree.
 */
class LiveVariableItem extends vscode.TreeItem {
  private _info: Result<[Viewable[], PythonObjectInformation]> = Err('Evaluating…');

  constructor(public readonly variableName: string) {
    super(variableName, vscode.TreeItemCollapsibleState.None);
    this._updateVisuals();
  }

  setResult(info: Result<[Viewable[], PythonObjectInformation]>): void {
    this._info = info;
    this._updateVisuals();
  }

  private _updateVisuals(): void {
    if (this._info.err) {
      this.description = this._info.val === 'Evaluating…' ? '⏳' : '✗';
      this.tooltip = this._info.val;
      this.iconPath = undefined;
    } else {
      const [viewables, info] = this._info.val;
      this.description = info['shape'] ?? info['type'] ?? '';
      this.tooltip = JSON.stringify(info, null, 2);
    }
  }
}

// ─── Streaming WatchTreeProvider sketch ─────────────────────────────────────

class StreamingWatchTreeProvider implements vscode.TreeDataProvider<LiveVariableItem> {
  private readonly _items = new Map<string, LiveVariableItem>();
  private readonly _onDidChangeItem = new vscode.EventEmitter<LiveVariableItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeItem.event;

  /** Phase 1: set placeholder items for all variable names immediately. */
  setVariableNames(names: string[]): void {
    // Preserve items whose names are unchanged (avoids flicker).
    const incoming = new Set(names);
    for (const name of this._items.keys()) {
      if (!incoming.has(name)) this._items.delete(name);
    }
    for (const name of names) {
      if (!this._items.has(name)) {
        this._items.set(name, new LiveVariableItem(name));
      }
    }
    this._onDidChangeItem.fire(undefined); // full tree refresh (names changed)
  }

  /** Phase 2+: update a single item as its evaluation completes. */
  updateItem(
    name: string,
    result: Result<[Viewable[], PythonObjectInformation]>,
  ): void {
    const item = this._items.get(name);
    if (item) {
      item.setResult(result);
      this._onDidChangeItem.fire(item); // targeted item refresh
    }
  }

  getTreeItem(element: LiveVariableItem): vscode.TreeItem {
    return element;
  }

  getChildren(): LiveVariableItem[] {
    return [...this._items.values()];
  }
}

// ─── Updated PythonObjectsList._update sketch ────────────────────────────────

/*
async function _update(provider: StreamingWatchTreeProvider): Promise<void> {
  // Phase 1: show names immediately
  const variableNames = await this.retrieveVariables();
  provider.setVariableNames(variableNames);

  // Phase 2: evaluate in batch, update items as they complete
  const viewableResults = await findExpressionsViewables(variableNames, session);
  if (viewableResults.ok) {
    // Start info fetches in parallel
    const infoPromises = variableNames.map(async (name, i) => {
      const viewables = viewableResults.val[i];
      if (viewables.length === 0) {
        provider.updateItem(name, Err('Not viewable'));
        return;
      }
      const info = await fetchInfo(name, viewables, session);
      provider.updateItem(name, info);
    });
    await Promise.all(infoPromises);
  }
}
*/

/*
 * ─── Why this matters ────────────────────────────────────────────────────────
 *
 * With the current 500ms debounce + 2000ms throttle, the worst case is:
 *   t=0:      debug stop
 *   t=500ms:  debounce fires, _update() starts
 *   t=500ms:  tree is cleared (now empty)
 *   t=~600ms: retrieveVariables() returns (DAP round-trip)
 *   t=~800ms: findExpressionsViewables() returns (Python eval)
 *   t=~900ms: retrieveInformation() returns (Python eval)
 *   t=900ms:  tree populated
 *
 * With streaming:
 *   t=500ms:  debounce fires, _update() starts
 *   t=~600ms: variable names shown immediately (DAP round-trip only)
 *   t=~800ms: type eval done, placeholder labels updated
 *   t=~900ms: info eval done, final labels shown
 *
 * The user sees SOMETHING within 100ms of the debounce firing, not 400ms.
 *
 * ─── Edge cases ──────────────────────────────────────────────────────────────
 *
 * 1. User clicks on a placeholder item
 *    If the user tries to open an image while the item is still "evaluating…",
 *    we should show a loading indicator or disable the command until ready.
 *
 * 2. Two rapid stops (e.g., breakpoint in a loop)
 *    The 2000ms throttle on _update() serialises calls.  A second stop that
 *    fires within 2s will wait for the first update to complete.  Streaming
 *    doesn't change this behaviour.
 *
 * 3. Error items replacing valid items
 *    If a variable was viewable at the last stop but got an error this stop,
 *    it shows an error state immediately.  This is correct.
 *
 * 4. onDidChangeTreeItem vs full tree refresh
 *    VS Code's tree view API supports firing onDidChangeTreeData with a specific
 *    TreeItem to refresh just that item.  This avoids the entire tree collapsing
 *    on each update, which is important for large watch trees.
 *    The current provider always fires with undefined (full refresh).
 *    Targeted refresh requires the TreeItem instance to be stable, which is
 *    guaranteed by reusing the Map entries.
 *
 * 5. Watched expressions
 *    Watched expressions are evaluated separately (one per expression) with
 *    syntax error isolation.  They can each be updated individually as results
 *    arrive, further improving responsiveness.
 *
 * ─── Implementation cost ─────────────────────────────────────────────────────
 *
 * Medium.  Requires refactoring WatchTreeProvider to support targeted item
 * refresh.  The CurrentPythonObjectsListData clearing pattern needs to change
 * (currently clears on start; needs to preserve existing items and update
 * in-place).  Pure UX improvement — no risk of correctness regression.
 */
