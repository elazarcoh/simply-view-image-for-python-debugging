import { Service } from "typedi";
import { Viewable } from "./viewable/Viewable";

@Service()
export class AllViewables {
    private _allViewables: Viewable[] = [];

    public get allViewables(): Viewable[] {
        return this._allViewables;
    }
}