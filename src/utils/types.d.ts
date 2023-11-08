type BodyOf<T extends { body: unknown }> = T["body"];
type ExceptError = {
    error: Error | string;
    errorMessage: string;
    isError: true;
};
type ExceptResult<T> = { result: T; isError: false };
type Except<T> = ExceptResult<T> | ExceptError;

type Constructor<T> = new (...args: any[]) => T;
type ExtractConstructorClass<Constructors extends unknown[]> = {
    [K in keyof Constructors]: Constructors[K] extends Constructor<infer R>
        ? R
        : never;
};
type TupleToUnion<T extends unknown[]> = T[number];
type NonEmptyArray<T> = [T, ...T[]];
type MessageEvent<T> = {data: T}
