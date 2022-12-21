type Enum<T = string> = {
    [id: string]: T | string;
    [nu: number]: string;
};

export function stringToEnumValue<T extends Enum, K extends keyof T>(
    enumObj: T,
    value: string
): T[keyof T] | undefined {
    return enumObj[
        Object.keys(enumObj).filter(
            (k) => enumObj[k as K].toString() === value
        )[0] as keyof typeof enumObj
    ];
}

export function allFulfilled<T>(ps: Promise<T>[]): Promise<T[]> {
    const FAIL_TOKEN = {};
    const fulfilled = (t: T | typeof FAIL_TOKEN): t is T => {
        return t !== FAIL_TOKEN;
    };
    const resolvedPromises: Promise<T[]> = Promise.all(
        ps.map((p) => p.catch((_) => FAIL_TOKEN))
    ).then((values) => values.filter(fulfilled) as T[]);
    return resolvedPromises;
}

export async function resolveSequentially<T>(ps: Promise<T>[]): Promise<T[]> {
    const resolved = [];
    for (const p of ps) {
        resolved.push(await p);
    }
    return resolved;
}

export function indent(content: string, n: number): string {
    return content
        .split("\n")
        .map((line) => " ".repeat(n) + line)
        .join("\n");
}

export function arrayUnique<T>(array: T[]): T[] {
    return [...new Set(array)];
}

export function arrayUniqueByKey<T, V>(array: T[], key: (t: T) => V): T[] {
    return [...new Map(array.map((item) => [key(item), item])).values()];
}

export function debounce<
    F extends (...args: Args) => ReturnType<F>,
    Args extends unknown[] = Parameters<F>
>(func: F, waitFor: number): (...args: Args) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Args): void => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), waitFor);
    };
}

export function zip<Arrays extends ReadonlyArray<unknown>[]>(
    ...arrays: Arrays
): {
    [K in keyof Arrays]: Arrays[K] extends Array<infer R> ? R : never;
}[] {
    const minLength = Math.min(...arrays.map((a) => a.length));
    const res = [];
    for (let i = 0; i < minLength; i++) {
        res.push(arrays.map((a) => a[i]));
    }
    return res as {
        [K in keyof Arrays]: Arrays[K] extends Array<infer R> ? R : never;
    }[];
}

export function isOf<Constructors extends Constructor<unknown>[]>(
    ...types: Constructors
): (
    value: unknown
) => value is TupleToUnion<ExtractConstructorClass<Constructors>> {
    return (
        value: unknown
    ): value is TupleToUnion<ExtractConstructorClass<Constructors>> => {
        return types.some((type) => value instanceof type);
    };
}

export function hasValue<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}

export function notEmptyArray<T>(array: T[]): array is NonEmptyArray<T> {
    return array.length !== 0;
}
