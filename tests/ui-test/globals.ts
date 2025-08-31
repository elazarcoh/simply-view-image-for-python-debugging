import * as path from 'node:path';
import { VSBrowser } from 'vscode-extension-tester';
import { openWorkspaceFile } from './test-utils';

export const WORKSPACE_DIR = path.join(__dirname, '../../..', 'python_test');
const WORKSPACE_FILE = path.join(WORKSPACE_DIR, '.vscode', 'workspace.code-workspace');

export async function openWorkspace(workspaceFile: string = WORKSPACE_FILE) {
  await openWorkspaceFile(workspaceFile);
  await VSBrowser.instance.driver.sleep(2000); // Wait for workspace to load
}

export function fileInWorkspace(filePath: string) {
  return path.join(WORKSPACE_DIR, filePath);
}
