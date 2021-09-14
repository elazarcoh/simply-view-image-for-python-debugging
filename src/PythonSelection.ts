export interface Variable {
  name: string;
  evaluateName: string;
}

export type ScopeVariables = {
  locals: Variable[];
  globals: Variable[];
};

export type VariableSelection = { variable: string };
export type RangeSelection = { range: string };
export type UserSelection = VariableSelection | RangeSelection;

export function isVariableSelection(
  selection: UserSelection
): selection is VariableSelection {
  return (selection as VariableSelection).variable !== undefined;
}
