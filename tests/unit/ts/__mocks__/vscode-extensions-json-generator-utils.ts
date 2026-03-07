// Stub for vscode-extensions-json-generator/utils in unit tests (no vscode host available).
export const configUtils = {
  ConfigurationGetter: (_section: string) => (_key: string, _scope: unknown, defaultValue?: unknown) => defaultValue,
  ConfigurationSetter: (_section: string) => (_key: string, _value: unknown) => Promise.resolve(),
  ConfigurationInspector: (_section: string) => (_key: string) => undefined,
  VSCodeConfigurations: {},
};
