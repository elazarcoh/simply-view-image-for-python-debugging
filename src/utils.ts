
type Enum<T = any> = {
    [id: string]: T | string;
    [nu: number]: string;
}

export function stringToEnumValue<T extends Enum, K extends keyof T>(enumObj: T, value: string): T[keyof T] | undefined {
    // @ts-ignore toString(), we know it's an enum, so it must have toString
    return enumObj[Object.keys(enumObj).filter((k) => enumObj[k as K].toString() === value)[0] as keyof typeof enumObj];
}

export function allFulfilled<T>(ps: Promise<T>[]): Promise<T[]> {
    const FAIL_TOKEN = {};
    const fulfilled = (t: any): t is T => { return t !== FAIL_TOKEN };
    const resolvedPromises: Promise<T[]> = Promise.all(
        ps.map(p => p.catch(_ => FAIL_TOKEN))
    ).then(
        values => values.filter(fulfilled)
    );
    return resolvedPromises;
}

export async function resolveSequentially<T>(ps: Promise<T>[]): Promise<T[]> {
    const resolved = []
    for (const p of ps) {
        resolved.push(await p);
    }
    return resolved;
}

export function notEmpty<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}
