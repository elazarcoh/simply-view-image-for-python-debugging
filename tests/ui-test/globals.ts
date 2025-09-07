import * as path from 'node:path';
import { TitleBar, VSBrowser } from 'vscode-extension-tester';
import { openWorkspaceFile } from './test-utils';

export const WORKSPACE_DIR = path.join(__dirname, '../../..', 'tests/test-data/workspace');
const WORKSPACE_FILE = path.join(WORKSPACE_DIR, '.vscode', 'tests.code-workspace');

export async function openWorkspace(workspaceFile: string = WORKSPACE_FILE) {
  await openWorkspaceFile(workspaceFile);
  await VSBrowser.instance.driver.sleep(2000); // Wait for workspace to load
  // ensure the workspace is opened
  const workspaceName = path.basename(WORKSPACE_FILE, '.code-workspace');
  const titleBar = new TitleBar();
  const title = await titleBar.getTitle();
  if (!title.startsWith(workspaceName)) {
    throw new Error(`Expected workspace title to start with "${workspaceName}", but got "${title}"`);
  }
}

export function fileInWorkspace(filePath: string) {
  return path.join(WORKSPACE_DIR, filePath);
}
