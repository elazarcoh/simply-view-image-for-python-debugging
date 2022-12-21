type Body<T extends { body: unknown }> = T["body"];
type Except<T> =
    | { result: T; isError: false }
    | { error: Error | string; isError: true };

type Constructor<T> = new (...args: any[]) => T;
type ExtractConstructorClass<Constructors extends unknown[]> = {
    [K in keyof Constructors]: Constructors[K] extends Constructor<infer R>
        ? R
        : never;
};
type TupleToUnion<T extends unknown[]> = T[number];
type NonEmptyArray<T> = [T, ...T[]];