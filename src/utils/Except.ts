export namespace Except {
    export function result<T>(value: T): Except<T> {
        return {
            result: value,
            isError: false,
        };
    }
    export function error<T>(error: Error | string): Except<T> {
        return {
            error: error,
            isError: true,
        };
    }

    export function map<T, U>(value: Except<T>, f: (t: T) => U): Except<U> {
        if (value.isError) {
            return error(value.error);
        }
        return result(f(value.result));
    }

    export function isOkay<T>(
        except: Except<T>
    ): except is { result: T; isError: false } {
        return !except.isError;
    }

    export function isError<T>(
        except: Except<T>
    ): except is { error: Error | string; isError: true } {
        return except.isError;
    }
}
