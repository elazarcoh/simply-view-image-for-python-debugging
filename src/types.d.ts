interface VariableSelection { variable: string }
interface ExpressionSelection { expression: string }

type PythonObjectRepresentation = VariableSelection | ExpressionSelection;

type PythonObjectInformation = Record<string, string>;
type EmptyObject = Record<string, never>;

type PythonObjectShape = number[] | Record<string, number | string>;
