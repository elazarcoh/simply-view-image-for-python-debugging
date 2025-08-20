import type { CurrentPythonObjectsListData } from '../image-watch-tree/PythonObjectsList';
import type { DebugSessionData } from './debugger/DebugSessionData';
import type { JupyterSessionData } from './jupyter/JupyterSessionData';
import type { DebugSession, JupyterSession, Session } from './Session';
import { activeDebugSessionData } from './debugger/DebugSessionsHolder';
import { jupyterSessionData } from './jupyter/JupyterSessionRegistry';
import {

  isDebugSession,
  isJupyterSession,

} from './Session';

export interface SessionData {
  isValid: boolean;
  setupOkay: boolean;
  canExecute: boolean;

  currentPythonObjectsList: CurrentPythonObjectsListData;
}

export function getSessionData(session: DebugSession): DebugSessionData;
export function getSessionData(
  session: JupyterSession,
): JupyterSessionData | undefined;
export function getSessionData(session: Session): SessionData | undefined;
export function getSessionData(session: Session): SessionData | undefined {
  if (isJupyterSession(session)) {
    return jupyterSessionData(session.uri);
  }
  else if (isDebugSession(session)) {
    return activeDebugSessionData(session.session);
  }
  else {
    throw new Error('Unknown session type');
  }
}
