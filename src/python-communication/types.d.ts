interface SetupCode {
  /**
   * Code that is run once, to set up the environment
   */
  setupCode: () => string;
  /**
   * Code that is run before the setup code, to avoid re-running the setup code
   */
  testSetupCode: string;
  /**
   * Unique identifier for this setup code. Used to debug errors in the setup code.
   */
  id: string;
}

interface EvalCode<_ResultType, Args extends Array<unknown> = []> {
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
}

interface RunInPythonOptions {
  context: 'watch' | 'repl' | 'hover';
  frameId?: number;
}

interface EvalCodePython<_ResultType> {
  pythonCode: string;
}
