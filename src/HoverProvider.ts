import * as vscode from 'vscode';
import { constructObjectShapeCode } from './python-communication/BuildPythonCode';
import { evaluateInPython } from './python-communication/RunPythonCode';
import { activeDebugSessionData } from './session/debugger/DebugSessionsHolder';
import { debugSession } from './session/Session';
import { joinResult } from './utils/Result';

function shapeToString(shape: PythonObjectShape): string {
  if (Array.isArray(shape)) {
    return `shape: (${shape.join(', ')})`;
  }
  else {
    return (
      `(${
        Object.entries(shape)
          .map(([key, value]) => `${key}=${value}`)
          .join(', ')
      })`
    );
  }
}

export class HoverProvider implements vscode.HoverProvider {
  public async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    // token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    const session = vscode.debug.activeDebugSession;
    if (
      session === undefined
      || activeDebugSessionData(session).isStopped === false
    ) {
      return undefined;
    }

    const range = document.getWordRangeAtPosition(position);
    const selectedVariable = document.getText(range);
    if (selectedVariable === '') {
      return undefined;
    }

    const code = constructObjectShapeCode(selectedVariable);
    const shape = joinResult(
      await evaluateInPython(code, debugSession(session)),
    );
    if (shape.err) {
      // We don't want to show an error message, just don't show a hover
      return undefined;
    }

    const shapeString = shapeToString(shape.safeUnwrap());
    return new vscode.Hover(new vscode.MarkdownString(shapeString), range);
  }
}
