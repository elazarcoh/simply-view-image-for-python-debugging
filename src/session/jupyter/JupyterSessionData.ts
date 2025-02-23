import { SavePathHelper } from "../../SerializationHelper";
import _ from "lodash";
import { SessionData } from "../Session";

export class JupyterSessionData implements SessionData {
  public readonly savePathHelper: SavePathHelper;
  public setupOkay: boolean = false;
  public isValid: boolean = true;

  constructor(private readonly id: string) {
    this.savePathHelper = new SavePathHelper(this.id);
  }
}
