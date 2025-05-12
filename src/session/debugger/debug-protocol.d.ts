import { DebugProtocol } from "vscode-debugprotocol";

type DebugProtocolVariable = Required<
  Pick<DebugProtocol.Variable, "name" | "evaluateName" | "type">
>;

type ScopeVariables = {
  locals: DebugProtocolVariable[];
  globals: DebugProtocolVariable[];
};
