type BodyOf<T extends { body: unknown }> = T["body"];

type Constructor<T> = new (...args: any[]) => T;
type ExtractConstructorClass<Constructors extends unknown[]> = {
  [K in keyof Constructors]: Constructors[K] extends Constructor<infer R>
    ? R
    : never;
};
type TupleToUnion<T extends unknown[]> = T[number];
type NonEmptyArray<T> = [T, ...T[]];
type MessageEvent<T> = { data: T };

type FlattenedPromise<T> = unknown extends T
  ? Promise<T>
  : T extends Promise<infer _>
    ? T
    : Promise<T>;

type Initializer<T> = T extends any ? T | (() => T) : never;
