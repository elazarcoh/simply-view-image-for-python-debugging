import _ from "lodash";
import { Option, None, Some } from "ts-results";
export { Some, None, Option } from "ts-results";

export type Optional<T> = T | Option<T> | undefined | null;

declare module "ts-results" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Option {
    export function wrap(value: undefined): None;
    export function wrap(value: null): None;
    export function wrap<T>(value: NonNullable<T>): Some<T>;
    export function wrap<T>(value: Optional<T>): Option<T>;

    export function or(option1: None, option2: None): None;
    export function or<T>(option1: Some<T>, option2: unknown): Some<T>;
    export function or<U>(option1: None, option2: Some<U>): Some<U>;
    export function or<U>(option1: None, option2: Option<U>): Option<U>;
    export function or<T, U>(
      option1: Option<T>,
      option2: Option<U>,
    ): Option<T> | Option<U>;
  }
}

Option.wrap = ((value: unknown) => {
  if (Option.isOption(value)) {
    return value;
  }
  if (value === undefined || value === null) {
    return None;
  }
  return Some(value);
}) as typeof Option.wrap;

Option.or = ((option1: Option<unknown>, option2: unknown) => {
  return option1.some ? option1 : option2;
}) as typeof Option.or;

export function joinResult<T>(option: Option<Option<T>>): Option<T> {
  return option.andThen((v) => v);
}
