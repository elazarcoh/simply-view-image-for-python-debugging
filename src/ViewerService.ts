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

  static readonly catch_exception_decorator_name = `catch_exception_to_object`
  static readonly catch_exception_decorator = `
def ${ViewerService.catch_exception_decorator_name}(func):
    def warper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            return f"Error({type(e).__name__},'{e}')"
    return warper
`

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

  parsePythonError(error: string): { message?: string; type?: string } {
    const match = /"Error\((?<type>.*?),'(?<message>.*?)\)"/.exec(error);
    return { message: match?.groups?.message, type: match?.groups?.type };
  }

  resultOrError(result: string): [false, string] | [true, { message?: string; type?: string }] {
    if (result.startsWith("\"Error(")) {
      return [true, this.parsePythonError(result)];
    } else {
      return [false, result];
    }
  }

  protected readonly evaluate = this.inContextExecutor.evaluate;

}
