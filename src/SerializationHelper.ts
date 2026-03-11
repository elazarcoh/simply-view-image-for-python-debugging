import type * as vscode from 'vscode';
import type { Result } from './utils/Result';
import { chmodSync, existsSync, mkdirSync, statSync } from 'node:fs';
import * as fsp from 'node:fs/promises';
import { tmpdir, userInfo } from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import Container from 'typedi';
import { getConfiguration } from './config';
import { EXTENSION_NAME } from './globals';
import { logDebug, logWarn } from './Logging';
import { Err, Ok } from './utils/Result';

/**
 * Returns a user-specific temporary directory that is safe for multi-user systems.
 *
 * Tries in order:
 * 1. XDG_RUNTIME_DIR (Linux/modern systems) — already per-user with proper permissions
 * 2. User-specific /tmp directory (cross-platform fallback)
 *
 * This ensures each user gets an isolated directory where they can safely write without
 * interfering with other users' work.
 */
function getUserSpecificTempDir(): string {
  // Try XDG_RUNTIME_DIR first (Linux/modern systems, already per-user)
  const xdgRuntimeDir = process.env.XDG_RUNTIME_DIR;
  if (xdgRuntimeDir && existsSync(xdgRuntimeDir)) {
    logDebug(`Using XDG_RUNTIME_DIR: ${xdgRuntimeDir}`);
    return path.join(xdgRuntimeDir, EXTENSION_NAME, 'images');
  }

  // Fallback: create user-specific directory in /tmp (e.g., /tmp/svifpd-1000/images)
  const uid = process.getuid?.() ?? userInfo().uid;
  const userSpecificTmp = path.join(tmpdir(), `${EXTENSION_NAME}-${uid}`, 'images');
  logDebug(`Using user-specific temp: ${userSpecificTmp}`);
  return userSpecificTmp;
}

function defaultSaveDir(): string {
  return (
    Container.get('saveDir') ?? getUserSpecificTempDir()
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
    logDebug('Using tmp folder for saving files (multi-user safe)');
    saveDir = getUserSpecificTempDir();
  }

  logDebug(`saveDir: ${saveDir}`);

  // create output directory if it doesn't exist
  if (!existsSync(saveDir)) {
    logDebug('create save directory');
    mkdirSync(saveDir, { recursive: true });
    if (saveLocation === 'tmp' || saveLocation === undefined) {
      // Set restrictive permissions for temp directory (owner-only access)
      chmodSync(saveDir, 0o700);
    }
  }
  else if (saveLocation === 'tmp' || saveLocation === undefined) {
    // If directory already exists, verify it has safe permissions (owner-only)
    try {
      const stats = statSync(saveDir);
      const mode = stats.mode & 0o777;
      if (mode !== 0o700) {
        logWarn(`Temp directory has unexpected permissions ${mode.toString(8)}; fixing to 0o700`);
        chmodSync(saveDir, 0o700);
      }
    }
    catch (error) {
      logWarn(`Could not verify permissions on ${saveDir}: ${error}`);
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

  private static sanitizeForFilename(name: string): string {
    return name.replace(/[^\w\-]/g, '_');
  }

  public savePathFor(object: PythonObjectRepresentation): string {
    if ('expression' in object) {
      return SavePathHelper.normalizePath(path.join(this.saveDir, shortId()));
    }
    else {
      const safeName = SavePathHelper.sanitizeForFilename(object.variable);
      return SavePathHelper.normalizePath(
        path.join(this.saveDir, `${safeName}`),
      );
    }
  }
}
