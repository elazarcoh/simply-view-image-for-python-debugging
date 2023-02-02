import * as vscode from 'vscode';
type SetupCode = {
    /**
     * Code that is run once, to set up the environment
     */
    setupCode: () => string;
    /**
     * Code that is run before the setup code, to avoid re-running the setup code
     */
    testSetupCode: string;
};

type EvalCode<_ResultType, Args extends Array<unknown> = []> = {
    /**
     * Function that generates a python expression to evaluate.
     *
     * @param expression The expression to be evaluated in Python.
     * @param args The arguments to be passed to the expression.
     * @returns A string representing the Python expression to be evaluated.
     *
     * @note The _ResultType type parameter is not used for any validation in this type.
     *  It is only used for TypeScript type inference, to indicate the expected type of
     *  the result of evaluating the expression passed to this method.
     */
    evalCode: (expression: string, ...args: Args) => string;
};


interface PluginViewable {
    extensionId: string;
    group: string;
    type: string;
    title: string;
    setupPythonCode: SetupCode;
    testTypePythonCode: EvalCode<boolean>;
    infoPythonCode: EvalCode<Record<string, string>>;
    serializeObjectPythonCode: EvalCode<null, [string]>;
    suffix: string;
    onShow?: (path: string) => void | Promise<void>;
}
type RegisterResult =
    | {
          success: true;
          disposable: vscode.Disposable;
      }
    | {
          success: false;
      };
declare function registerView(plug: PluginViewable): Promise<RegisterResult>;

declare function atModule(name: string): string;

export interface Api {
    registerView: typeof registerView;
    atModule: typeof atModule;
}
