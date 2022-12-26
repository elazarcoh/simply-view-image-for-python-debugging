
type VariableSelection = { variable: string };
type ExpressionSelection = { expression: string };

type PythonObjectRepresentation = VariableSelection | ExpressionSelection;

type PythonObjectInformation = Record<string, string>;
type EmptyObject = Record<string, never>;

// type WrapTupleWithEvalCode<
//     T extends unknown[],
// > = { [K in keyof T]: EvalCodePython<T[K]> };

