import * as vscode from "vscode";
import {
  AddExpressionWatchTreeItem,
  ExpressionWatchTreeItem,
} from "./WatchExpression";
import { Service } from "typedi";
import { VariableWatchTreeItem } from "./WatchVariable";
import {
  ErrorWatchTreeItem,
  PythonObjectInfoLineTreeItem,
  PythonObjectTreeItem,
} from "./WatchTreeItem";
import { activeDebugSessionData } from "../session/debugger/DebugSessionsHolder";
import { globalExpressionsList, InfoOrError } from "./PythonObjectsList";
import { isOf, zip } from "../utils/Utils";
import { Err, errorMessage } from "../utils/Result";
import { DiagnosticsTreeItem } from "./DiagnosticsItem";
import { getConfiguration } from "../config";

class ItemsRootTreeItem extends vscode.TreeItem {
  private _items: TreeItem[] | (() => Promise<TreeItem[]>);

  constructor(
    public readonly label: string,
    items: TreeItem[] | (() => Promise<TreeItem[]>),
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.Expanded,
    contextValue: string | undefined = undefined,
  ) {
    super(label, collapsibleState);
    this._items = items;
    this.contextValue = contextValue;
  }

  async items(): Promise<TreeItem[]> {
    return typeof this._items === "function" ? this._items() : this._items;
  }
}

type TreeItem =
  | VariableWatchTreeItem
  | ExpressionWatchTreeItem
  | ErrorWatchTreeItem
  | typeof AddExpressionWatchTreeItem
  | PythonObjectInfoLineTreeItem
  | ItemsRootTreeItem
  | DiagnosticsTreeItem;

@Service() // This is a service, the actual items are retrieved using the DebugSessionData
export class WatchTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    TreeItem | undefined
  >();

  public showDiagnosticsTemporarily: boolean = false;

  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(item?: TreeItem): void {
    this._onDidChangeTreeData.fire(item);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (element === undefined) {
      // root
      const debugSessionData = activeDebugSessionData();
      const variableItems =
        debugSessionData?.currentPythonObjectsList.variablesList.map(
          ([exp, info]) =>
            info.err
              ? new ErrorWatchTreeItem(exp, errorMessage(info), "variable")
              : new VariableWatchTreeItem(
                  exp,
                  info.safeUnwrap()[0],
                  info.safeUnwrap()[1],
                ),
        ) ?? [];

      const expressionsInfoOrNotReady =
        debugSessionData?.currentPythonObjectsList.expressionsInfo ??
        (Array(globalExpressionsList.length).fill(
          Err("Not ready") as InfoOrError,
        ) as InfoOrError[]);

      const expressionsItems = zip(
        globalExpressionsList,
        expressionsInfoOrNotReady,
      ).map(([exp, info]) =>
        info.err
          ? new ErrorWatchTreeItem(exp, errorMessage(info), "expression")
          : new ExpressionWatchTreeItem(
              exp,
              info.safeUnwrap()[0],
              info.safeUnwrap()[1],
            ),
      );

      // Set the tracking state if was tracked before
      const trackedPythonObjects =
        activeDebugSessionData()?.trackedPythonObjects;
      if (trackedPythonObjects !== undefined) {
        const nonErrorItems = [...variableItems, ...expressionsItems].filter(
          isOf(VariableWatchTreeItem, ExpressionWatchTreeItem),
        );
        for (const item of nonErrorItems) {
          const maybeTrackingId = trackedPythonObjects.trackingIdIfTracked({
            expression: item.expression,
          });
          if (maybeTrackingId !== undefined) {
            item.setTracked(maybeTrackingId);
          }
        }
      }

      const items = [
        new ItemsRootTreeItem("Variables", variableItems),
        new ItemsRootTreeItem("Expressions", [
          ...expressionsItems,
          AddExpressionWatchTreeItem,
        ]),
      ];

      if (
        this.showDiagnosticsTemporarily ||
        (getConfiguration("showDiagnosticInfoInTreeView", null, false) ?? false)
      ) {
        const getter = async () => {
          const diagnostics =
            debugSessionData?.diagnostics.getDiagnosticsItems();
          return diagnostics ?? [];
        };
        const item = new ItemsRootTreeItem(
          "Extension Diagnostics",
          getter,
          vscode.TreeItemCollapsibleState.Expanded,
          "svifpd:diagnosticsRoot",
        );
        debugSessionData?.diagnostics.onDidChange(() => this.refresh(item));
        items.push(item);
      }

      return items;
    } else if (element instanceof ItemsRootTreeItem) {
      return element.items();
    } else if (element instanceof PythonObjectTreeItem) {
      const infoItems = Object.entries(element.info).map(
        ([name, value]) => new PythonObjectInfoLineTreeItem(name, value),
      );
      return infoItems;
    } else if (element === AddExpressionWatchTreeItem) {
      return [];
    } else {
      return [];
    }
  }
}
