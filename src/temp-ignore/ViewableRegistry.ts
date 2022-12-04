import { Service } from "typedi";
import { combineSetupCodes } from "./python-communication/SetupCode";
import { Viewable } from "./viewable/Viewable";

@Service()
export class ViewableRegistry {

    private readonly _registry = new Map<string, Map<string, Viewable>>();

    private _setupCodeParts: SetupCode[] = [];
    private _setupCode = "";

    public addViewable(viewable: Viewable): void {
        let groupMap = this._registry.get(viewable.group);
        if (!groupMap) {
            groupMap = new Map();
            this._registry.set(viewable.group, groupMap);
        }
        if (!groupMap.has(viewable.type)) {
            groupMap.set(viewable.type, viewable);
        }

        this._setupCodeParts.push(viewable.setupPythonCode());
        this._updateSetupCode();
    }

    private _updateSetupCode(): void {
        this._setupCode = combineSetupCodes(this._setupCodeParts);
    }
}
