import { Viewable } from "./viewable/Viewable";

const _registry = new Map<string, Map<string, Viewable>>();

export function registerViewable(viewable: Viewable): void {
    let groupMap = _registry.get(viewable.group);
    if (!groupMap) {
        groupMap = new Map();
        _registry.set(viewable.group, groupMap);
    }
    groupMap.set(viewable.type, viewable);
}
