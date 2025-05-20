import * as vscode from "vscode";
import { refreshAllDataViews } from "../globalActions";
import { maybeDebugSession } from "../session/Session";
import { getSessionData } from "../session/SessionData";
import { Viewable } from "../viewable/Viewable";
import {
  addExpression,
  editExpression,
  removeAllExpressions,
  removeExpression,
} from "./PythonObjectsList";
import { PythonObjectTreeItem } from "./WatchTreeItem";

// singleton object that used to add expression when user click on it
class _AddExpressionWatchTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string = "Add Expression",
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.None,
  ) {
    super(label, collapsibleState);
  }

  readonly command: vscode.Command = {
    command: `svifpd.add-expression`,
    title: "Add Expression",
    tooltip: "Add Expression",
  };
}
export const AddExpressionWatchTreeItem = new _AddExpressionWatchTreeItem();

export class ExpressionWatchTreeItem extends PythonObjectTreeItem {
  constructor(
    public readonly expression: string,
    viewables: Readonly<NonEmptyArray<Viewable>>,
    info: Readonly<PythonObjectInformation>,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.Collapsed,
  ) {
    super(
      "expression",
      expression,
      expression,
      viewables,
      info,
      collapsibleState,
    );
    this.updateContext();
  }
}

export async function addExpressionTreeItem(): Promise<void> {
  const added = await addExpression();
  if (added) {
    const session = maybeDebugSession(vscode.debug.activeDebugSession);
    await refreshAllDataViews(session);
  }
}

export async function removeExpressionTreeItem(
  item: ExpressionWatchTreeItem,
): Promise<void> {
  const expression = item.expression;
  const removed = await removeExpression(expression);
  if (removed) {
    const session = maybeDebugSession(vscode.debug.activeDebugSession);
    if (session.some && item.trackingId) {
      getSessionData(session.val).trackedPythonObjects.untrack(item.trackingId);
    }
    await refreshAllDataViews(session);
  }
}

export async function editExpressionTreeItem(
  item: ExpressionWatchTreeItem,
): Promise<void> {
  const expression = item.expression;
  const changed = await editExpression(expression);
  if (changed) {
    const session = maybeDebugSession(vscode.debug.activeDebugSession);
    await refreshAllDataViews(session);
  }
}

export async function removeAllExpressionsTree(): Promise<void> {
  const removed = removeAllExpressions();
  if (removed.length > 0) {
    const session = maybeDebugSession(vscode.debug.activeDebugSession);
    if (session.some) {
      const trackedPythonObjects = getSessionData(
        session.val,
      ).trackedPythonObjects;

      if (trackedPythonObjects !== undefined) {
        removed.forEach((expression) => {
          const trackingId = trackedPythonObjects.trackingIdIfTracked({
            expression,
          });
          if (trackingId !== undefined) {
            trackedPythonObjects.untrack(trackingId);
          }
        });
      }
    }
    await refreshAllDataViews(session);
  }
}
