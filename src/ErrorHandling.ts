import * as vscode from 'vscode';
import { logError } from './utils/Logging';

export function handleError(error: Error | string): void {
    if (typeof error === 'string') {
        logError(error);
        vscode.window.showErrorMessage(error);
    } else {
        logError(error.message);
        vscode.window.showErrorMessage(error.message);
    }
}
