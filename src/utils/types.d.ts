type Body<T extends { body: unknown }> = T["body"];
type Except<T> =
    | { result: T; isError: false }
    | { error: Error | string; isError: true };
