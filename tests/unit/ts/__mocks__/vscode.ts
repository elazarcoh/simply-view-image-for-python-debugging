// Minimal vscode stub for unit tests running outside VS Code host.
export const window = {
  createOutputChannel: () => ({
    appendLine: () => {},
    dispose: () => {},
    show: () => {},
    append: () => {},
  }),
};
export const workspace = {
  getConfiguration: () => ({
    get: (_key: string, defaultValue?: unknown) => defaultValue,
    has: () => false,
    inspect: () => undefined,
    update: () => Promise.resolve(),
  }),
};
export const Uri = {
  file: (p: string) => ({ fsPath: p, toString: () => p }),
  parse: (p: string) => ({ fsPath: p, toString: () => p }),
};
export const EventEmitter = class {
  event = () => {};
  fire = () => {};
  dispose = () => {};
};
export const Disposable = { from: () => ({ dispose: () => {} }) };
export const ExtensionMode = { Production: 1, Development: 2, Test: 3 };
export const commands = { registerCommand: () => ({ dispose: () => {} }) };
export const debug = { onDidStartDebugSession: () => ({ dispose: () => {} }) };
