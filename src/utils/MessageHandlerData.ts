import { EventData } from './EventData';

export interface MessageHandlerData<T> extends EventData<T> {
  requestId?: string;
  error?: unknown;
}