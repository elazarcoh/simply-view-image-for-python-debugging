
export interface Viewable {
    group: string;
    type: string;
    setupPythonCode: SetupCode;
    testTypePythonCode: EvalCode;
    infoPythonCode: EvalCode;
}
