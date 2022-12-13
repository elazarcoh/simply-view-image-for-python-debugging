import Container from "typedi";
import * as fsp from "path";
import { tmpdir } from "os";
import { EXTENSION_NAME } from "./globals";

export function defaultSaveDir(): string {
    return (
        Container.get("saveDir") ?? fsp.join(tmpdir(), EXTENSION_NAME, "images")
    );
}

function shortId(): string {
    return Math.random().toString(36).substring(2, 8);
}

export class SavePathHelper {
    private readonly _saveCounter = new Map<string, number>();

    constructor(readonly saveDir: string) {}

    public savePathFor(object: PythonObjectRepresentation): string {
        if ("expression" in object) {
            return fsp.join(this.saveDir, shortId() + ".png");
        } else {
            let counter = this._saveCounter.get(object.variable) ?? 0;
            if (counter >= 5) counter = 0;
            this._saveCounter.set(object.variable, counter + 1);
            return fsp.join(this.saveDir, `${object.variable}_${counter}.png`);
        }
    }
}
