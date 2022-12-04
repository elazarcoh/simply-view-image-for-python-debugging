import type { Trackable, } from "../types";
import { ExpressionWatchTreeItem } from "./WatchExpression";
import { VariableWatchTreeItem } from "./WatchVariable";

const tracked = new Map<string, Trackable>();

function randomId() {
    return Math.random().toString(36).slice(2);
}

export function track(o: Trackable): string {
    const id = randomId();
    tracked.set(id, o);
    return id;
}

export function untrack(id: string): void {
    tracked.delete(id);
}

export function saveTracked(): void {
    throw new Error("Not implemented");
}