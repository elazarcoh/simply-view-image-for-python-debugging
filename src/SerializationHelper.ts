import * as vscode from "vscode";
import * as fsp from "fs/promises";
import Container from "typedi";
import * as path from "path";
import { tmpdir } from "os";
import { EXTENSION_NAME } from "./globals";
import { getConfiguration } from "./config";
import { chmodSync, existsSync, mkdirSync } from "fs";
import { logDebug } from "./Logging";

export function defaultSaveDir(): string {
    return (
        Container.get("saveDir") ??
        path.join(tmpdir(), EXTENSION_NAME, "images")
    );
}

export function setSaveLocation(context: vscode.ExtensionContext): void {
    const saveLocation = getConfiguration("saveLocation") ?? "tmp";
    let saveDir: string;
    if (saveLocation === "custom") {
        logDebug("Using custom save location for saving files");
        saveDir = getConfiguration("customSavePath") ?? defaultSaveDir();
    } else if (saveLocation === "extensionStorage") {
        logDebug("Using extension storage for saving files");
        saveDir = path.join(
            context.globalStorageUri.fsPath,
            EXTENSION_NAME,
            "images"
        );
    } else {
        logDebug("Using tmp folder for saving files");
        saveDir = path.join(tmpdir(), EXTENSION_NAME, "images");
    }

    logDebug("saveDir: " + saveDir);

    // create output directory if it doesn't exist
    if (!existsSync(saveDir)) {
        logDebug("create save directory");
        mkdirSync(saveDir, { recursive: true });
        if (saveLocation === "tmp" || saveLocation === undefined) {
            chmodSync(saveDir, 0o777); // make the folder world writable for other users uses the extension
        }
    }

    Container.set("saveDir", saveDir);
}

function shortId(): string {
    return Math.random().toString(36).substring(2, 8);
}

export class SavePathHelper {
    public readonly saveDir: string;

    constructor(sessionId: string) {
        this.saveDir = path.join(defaultSaveDir(), sessionId);
        mkdirSync(this.saveDir, { recursive: true });
    }

    public deleteSaveDir(): Promise<void> {
        return fsp.rm(this.saveDir, { recursive: true, force: true });
    }

    public static normalizePath(p: string): string {
        return p.replace(/\\/g, "/");
    }

    public savePathFor(object: PythonObjectRepresentation): string {
        if ("expression" in object) {
            return SavePathHelper.normalizePath(
                path.join(this.saveDir, shortId() + ".png")
            );
        } else {
            return SavePathHelper.normalizePath(
                path.join(this.saveDir, `${object.variable}.png`)
            );
        }
    }
}
