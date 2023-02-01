import { atModule as atModule_ } from "./python-communication/BuildPythonCode";
import { registerPlugin } from "./plugins";

function atModule(name: string) {
    return atModule_(name);
}

function catchErrorsIntoPromise<T, Args extends unknown[]>(
    func: (...args: Args) => T
): (...args: Args) => Promise<T> {
    return async (...args: Args) => {
        try {
            return Promise.resolve(await func(...args));
        } catch (err) {
            return Promise.reject(err);
        }
    };
}

export const api = {
    registerView: catchErrorsIntoPromise(registerPlugin),
    atModule,
};
