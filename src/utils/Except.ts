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
            errorMessage: typeof error === "string" ? error : error.message,
        };
    }
    export function errorFromUnknown<T = unknown>(
        error: unknown
    ): Except<T> {
        if (error instanceof Error) {
            return Except.error(error.message);
        }
        return Except.error(JSON.stringify(error));
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

    export function isError<T>(except: Except<T>): except is ExceptError {
        return except.isError;
    }

    export function join<T>(except: Except<Except<T>>): Except<T> {
        if (except.isError) {
            return except;
        }
        return except.result;
    }
}
