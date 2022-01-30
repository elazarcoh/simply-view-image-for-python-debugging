import { join } from "path";
import {
  isVariableSelection,
  UserSelection,
  VariableSelection,
} from "./PythonSelection";
import { pythonInContextExecutor } from "./PythonInContextExecutor";
import * as tmp from "tmp";

export type VariableInformation = {
  name: string;
  more: Record<string, string>;
};

export abstract class ViewerService {
  protected currentIdx: number = 0;

  public constructor(
    protected readonly workingDir: string,
    protected readonly inContextExecutor = pythonInContextExecutor()
  ) { }

  protected get currentImgIdx(): number {
    this.currentIdx = (this.currentIdx + 1) % 10;
    return this.currentIdx;
  }

  abstract variableInformation(
    userSelection: VariableSelection,
    type?: string
  ): Promise<VariableInformation | undefined>;

  abstract save(
    userSelection: UserSelection,
    path?: string,
  ): Promise<string | undefined>;

  public pathForSelection(userSelection: UserSelection): string {
    if (isVariableSelection(userSelection)) {
      return join(
        this.workingDir,
        `${userSelection.variable}(${this.currentImgIdx}).png`
      );
    } else {
      const options = { postfix: ".png", dir: this.workingDir };
      return tmp.tmpNameSync(options);
    }
  }

  protected readonly evaluate = this.inContextExecutor.evaluate;

}
