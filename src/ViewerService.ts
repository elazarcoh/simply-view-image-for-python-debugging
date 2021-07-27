import * as vscode from 'vscode';
import { join } from 'path';
import { isVariableSelection, UserSelection } from "./PythonSelection";

export class ViewerService {

    protected threadId: number = 0;
    protected frameId: number = 0;

    protected currentIdx: number = 0;

    public constructor(
        protected readonly workingDir: string,
    ) { }

    public setThreadId(threadId: number) {
        this.threadId = threadId;
    }
    public setFrameId(frameId: number) {
        this.frameId = frameId;
    }

    protected get currentImgIdx(): number {
        this.currentIdx = (this.currentIdx + 1) % 10;
        return this.currentIdx;
    }

    protected pathForSelection(userSelection: UserSelection) {
        if (isVariableSelection(userSelection)) {
            return join(this.workingDir, `${userSelection.variable}(${this.currentImgIdx}).png`);
        } else {
            const tmp = require('tmp');
            const options = { postfix: ".png", dir: this.workingDir };
            return tmp.tmpNameSync(options);
        }
    }

    protected evaluate(session: vscode.DebugSession, expression: string) {
        return session.customRequest("evaluate", { expression: expression, frameId: this.frameId, context: 'hover' });
    }
}