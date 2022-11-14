    
export type ValueOrError<T> = { result: T, isError: false } | { error: string, isError: true };

export function mapValueOrError<T, U>(valueOrError: ValueOrError<T>, map: (value: T) => U): ValueOrError<U> {
    if (valueOrError.isError) {
        return valueOrError;
    } else {
        return { result: map(valueOrError.result), isError: false };
    }
}


