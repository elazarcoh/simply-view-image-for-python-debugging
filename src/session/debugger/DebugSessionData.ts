import type * as vscode from 'vscode';
import type { SessionData } from '../SessionData';
import { ExtensionDiagnostics } from '../../image-watch-tree/DiagnosticsItem';
import { CurrentPythonObjectsList } from '../../image-watch-tree/PythonObjectsList';
import { TrackedPythonObjects } from '../../image-watch-tree/TrackedPythonObjects';
import { SavePathHelper } from '../../SerializationHelper';
import { DebugVariablesTracker } from './DebugVariablesTracker';

export class DebugSessionData implements SessionData {
  public readonly session: vscode.DebugSession;
  public readonly savePathHelper: SavePathHelper;
  public readonly debugVariablesTracker: DebugVariablesTracker
    = new DebugVariablesTracker();

  public readonly trackedPythonObjects: TrackedPythonObjects
    = new TrackedPythonObjects();

  public readonly currentPythonObjectsList: CurrentPythonObjectsList;
  public readonly diagnostics: ExtensionDiagnostics;
  public setupOkay: boolean = false;
  public isStopped: boolean = false;
  public isDebuggerAttached: boolean = true;
  public customState: Record<string, unknown | undefined> = {};

  constructor(session: vscode.DebugSession) {
    this.session = session;
    this.savePathHelper = new SavePathHelper(session.id);
    this.currentPythonObjectsList = new CurrentPythonObjectsList(
      this.debugVariablesTracker,
      session,
    );
    this.diagnostics = new ExtensionDiagnostics(session);
  }

  get isValid(): boolean {
    return this.isDebuggerAttached;
  }

  get canExecute(): boolean {
    return this.isDebuggerAttached && this.isValid && this.isStopped;
  }
}

export function isDebugSessionData(
  data: SessionData,
): data is DebugSessionData {
  return data instanceof DebugSessionData;
}
