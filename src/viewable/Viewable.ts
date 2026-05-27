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
  /**
   * Optional DAP-type fast-path exclusion.
   * Called with `type(obj).__name__` as reported by the DAP VariablesResponse.
   * Return `true` to skip Python type-testing for this viewable when the variable
   * has the given DAP type name. Return `false` (or omit the field entirely) to
   * always include this viewable in the Python eval.
   *
   * Use conservatively: only exclude when the type name makes it impossible for
   * the viewable to match. Unknown / empty type names must return `false`.
   */
  fastExclude?: (dacTypeName: string) => boolean;
}

export interface PluginViewable<T = unknown> extends Viewable<T> {
  extensionId: string;
}
