import type * as vscode from 'vscode';
import type { Result } from './utils/Result';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import * as fsp from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import Container from 'typedi';
import { getConfiguration } from './config';
import { EXTENSION_NAME } from './globals';
import { logDebug } from './Logging';
import { Err, Ok } from './utils/Result';

function defaultSaveDir(): string {
  return (
    Container.get('saveDir') ?? path.join(tmpdir(), EXTENSION_NAME, 'images')
  );
}

export function setSaveLocation(context: vscode.ExtensionContext): void {
  const saveLocation = getConfiguration('saveLocation') ?? 'tmp';
  let saveDir: string;
  if (saveLocation === 'custom') {
    logDebug('Using custom save location for saving files');
    saveDir = getConfiguration('customSavePath') ?? defaultSaveDir();
  }
  else if (saveLocation === 'extensionStorage') {
    logDebug('Using extension storage for saving files');
    saveDir = path.join(
      context.globalStorageUri.fsPath,
      EXTENSION_NAME,
      'images',
    );
  }
  else {
    logDebug('Using tmp folder for saving files');
    saveDir = path.join(tmpdir(), EXTENSION_NAME, 'images');
  }

  logDebug(`saveDir: ${saveDir}`);

  // create output directory if it doesn't exist
  if (!existsSync(saveDir)) {
    logDebug('create save directory');
    mkdirSync(saveDir, { recursive: true });
    if (saveLocation === 'tmp' || saveLocation === undefined) {
      chmodSync(saveDir, 0o777); // make the folder world writable for other users uses the extension
    }
  }

  Container.set('saveDir', saveDir);
}

function shortId(): string {
  return Math.random().toString(36).substring(2, 8);
}

export class SavePathHelper {
  public readonly saveDir: string;

  constructor(sessionId: string) {
    this.saveDir = path.join(defaultSaveDir(), sessionId);
    this.mkdir();
  }

  public mkdir(): Result<void> {
    try {
      mkdirSync(this.saveDir, { recursive: true });
      return Ok(undefined);
    }
    catch (error) {
      if (error instanceof Error) {
        return Err(error);
      }
      else {
        return Err(JSON.stringify(error));
      }
    }
  }

  public deleteSaveDir(): Promise<void> {
    return fsp.rm(this.saveDir, { recursive: true, force: true });
  }

  public static normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
  }

  public savePathFor(object: PythonObjectRepresentation): string {
    if ('expression' in object) {
      return SavePathHelper.normalizePath(path.join(this.saveDir, shortId()));
    }
    else {
      return SavePathHelper.normalizePath(
        path.join(this.saveDir, `${object.variable}`),
      );
    }
  }
}
