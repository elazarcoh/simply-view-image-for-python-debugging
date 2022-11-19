export type VariableSelection = { variable: string };
export type ExpressionSelection = { expression: string };
export type UserSelection = VariableSelection | ExpressionSelection;

export function isVariableSelection(
  selection: UserSelection
): selection is VariableSelection {
  return (selection as VariableSelection).variable !== undefined;
}
