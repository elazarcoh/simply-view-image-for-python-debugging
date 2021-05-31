
type Enum<T = any> = {
    [id: string]: T | string;
    [nu: number]: string;
}

export function stringToEnumValue<T extends Enum, K extends keyof T>(enumObj: T, value: string): T[keyof T] | undefined {
    // @ts-ignore toString(), we know it's an enum, so it must have toString
    return enumObj[Object.keys(enumObj).filter((k) => enumObj[k as K].toString() === value)[0] as keyof typeof enumObj];
}