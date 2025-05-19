import { CurrentPythonObjectsListData } from "../image-watch-tree/PythonObjectsList";
import { activeDebugSessionData } from "./debugger/DebugSessionsHolder";
import { jupyterSessionData } from "./jupyter/JupyterSessionRegistry";
import type { DebugSessionData } from "./debugger/DebugSessionData";
import type { JupyterSessionData } from "./jupyter/JupyterSessionData";
import {
  isDebugSession,
  isJupyterSession,
  type DebugSession,
  type JupyterSession,
  type Session,
} from "./Session";

export interface SessionData {
  isValid: boolean;
  setupOkay: boolean;

  currentPythonObjectsList: CurrentPythonObjectsListData;
}

export function getSessionData(session: DebugSession): DebugSessionData;
export function getSessionData(session: JupyterSession): JupyterSessionData;
export function getSessionData(session: Session): SessionData;
export function getSessionData(session: Session): SessionData {
  if (isJupyterSession(session)) {
    return jupyterSessionData(session.uri);
  } else if (isDebugSession(session)) {
    return activeDebugSessionData(session.session);
  } else {
    throw new Error("Unknown session type");
  }
}
