import { Service } from "typedi";
import { Viewable } from "./viewable/Viewable";

@Service()
export class ViewableRegistry {

    private readonly _registry = new Map<string, Map<string, Viewable>>();

    public registerViewable(viewable: Viewable): void {
        let groupMap = this._registry.get(viewable.group);
        if (!groupMap) {
            groupMap = new Map();
            this._registry.set(viewable.group, groupMap);
        }
        if (!groupMap.has(viewable.type)) {
            groupMap.set(viewable.type, viewable);
        }
    }

}
