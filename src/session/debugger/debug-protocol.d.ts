import type { DebugProtocol } from 'vscode-debugprotocol';

type DebugProtocolVariable = Required<
  Pick<DebugProtocol.Variable, 'name' | 'evaluateName' | 'type'>
>;

interface ScopeVariables {
  locals: DebugProtocolVariable[];
  globals: DebugProtocolVariable[];
}
