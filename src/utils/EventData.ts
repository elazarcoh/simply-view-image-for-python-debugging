

export interface EventData<T> extends MessageEvent<T> {
  command: string;
  payload: T;
}