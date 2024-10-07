export interface Viewable<T = unknown> {
    group: string;
    type: string;
    title: string;
    setupPythonCode: SetupCode;
    testTypePythonCode: EvalCode<boolean>;
    infoPythonCode: EvalCode<T>;
    serializeObjectPythonCode: EvalCode<null, [string]>;
    suffix: string;
    onShow?: (path: string) => void | Promise<void>;
    supportsImageViewer: boolean | Initializer<boolean>;
}

export interface PluginViewable<T = unknown> extends Viewable<T> {
    extensionId: string;
}
