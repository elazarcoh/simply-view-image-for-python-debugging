import * as vscode from 'vscode';

class PythonInContextExecutor {

    protected threadId: number = 0;
    protected frameId: number = 0;

    public setThreadId(threadId: number) {
        this.threadId = threadId;
    }

    public setFrameId(frameId: number) {
        this.frameId = frameId;
    }

    public evaluate(session: vscode.DebugSession, expression: string) {
        return session.customRequest("evaluate", { expression: expression, frameId: this.frameId, context: 'hover' });
    }
}

let _pythonInContextExecutor: PythonInContextExecutor;
export function pythonInContextExecutor(): PythonInContextExecutor {
    _pythonInContextExecutor ?? (_pythonInContextExecutor = new PythonInContextExecutor);
    return _pythonInContextExecutor;
}