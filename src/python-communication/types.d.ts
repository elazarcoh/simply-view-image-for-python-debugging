
type SetupCode = {
    /**
     * Code that is run once, to set up the environment
     */
    setupCode: string;
    /**
     * Code that is run before the setup code, to avoid re-running the setup code
     */
    testSetupCode: string;
}

type EvalCode<T extends Array<unknown> = []> = {
    /**
     * Function that generates a python expression to evaluate.
     */
    evalCode: (expression: string, ...args: T) => string;
}

type RunInPythonOptions = {
    context: "watch" | "repl" | "hover";
    frameId?: number;
}