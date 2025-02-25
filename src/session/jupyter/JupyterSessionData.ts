import { SavePathHelper } from "../../SerializationHelper";
import _ from "lodash";
import { SessionData } from "../SessionData";
import { CurrentPythonObjectsListData } from "../../image-watch-tree/PythonObjectsList";

export class JupyterSessionData implements SessionData {
  public readonly savePathHelper: SavePathHelper;
  public setupOkay: boolean = false;
  public isValid: boolean = true;
  public readonly currentPythonObjectsList: CurrentPythonObjectsListData;

  constructor(private readonly id: string) {
    this.savePathHelper = new SavePathHelper(this.id);
    this.currentPythonObjectsList = new CurrentPythonObjectsListData();
  }
}

export function isJupyterSessionData(
  data: SessionData,
): data is JupyterSessionData {
  return data instanceof JupyterSessionData;
}
