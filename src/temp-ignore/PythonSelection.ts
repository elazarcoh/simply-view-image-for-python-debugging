import { UserSelection, VariableSelection } from "./types";

export function isVariableSelection(
  selection: UserSelection
): selection is VariableSelection {
  return (selection as VariableSelection).variable !== undefined;
}
