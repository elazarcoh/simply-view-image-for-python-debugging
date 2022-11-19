import { pythonInformationResolver } from "../InformationResolver";
import IMAGE_SAVE from "./python/image_save.py?raw";

const informationResolver = pythonInformationResolver();


export class ViewableObject {
    constructor(
        public readonly expression: string,
        public readonly type: string,
    ) { }

}
