import * as tsResult from 'ts-results';

export { Err, Ok } from 'ts-results';

type ErrorType = Error | string;
export type Result<T> = tsResult.Result<T, ErrorType>;
export function errorFromUnknown(error: unknown): tsResult.Err<ErrorType> {
  if (error instanceof Error) {
    return tsResult.Err(error);
  }
  return tsResult.Err(JSON.stringify(error));
}
export function joinResult<T>(result: Result<Result<T>>): Result<T> {
  if (result.ok) {
    return result.safeUnwrap();
  }
  return result;
}
export function errorMessage(err: tsResult.Err<ErrorType>): string {
  return typeof err.val === 'string' ? err.val : err.val.message;
}
export function isOkay<T>(result: Result<T>): result is tsResult.Ok<T> {
  return result.ok;
}
