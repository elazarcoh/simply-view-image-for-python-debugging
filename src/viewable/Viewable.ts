export type ObjectType = {
    group: string;
    type: string;
};

export interface Viewable {
    group: string;
    type: string;
    title: string;
    setupPythonCode: SetupCode;
    testTypePythonCode: EvalCode<boolean>;
    infoPythonCode: EvalCode<Record<string, string>>;
    serializeObjectPythonCode: EvalCode<null, [string]>;
}
