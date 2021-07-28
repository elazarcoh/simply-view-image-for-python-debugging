import * as vscode from 'vscode';
import { join } from 'path';
import { isVariableSelection, UserSelection, VariableSelection } from "./PythonSelection";
import { pythonInContextExecutor } from './PythonInContextExecutor';

export type VariableInformation = {
    name: string
    // watchCommand: vscode.Command
    more: Record<string, string>
}

export abstract class ViewerService {

    protected currentIdx: number = 0;

    public constructor(
        protected readonly workingDir: string,
        protected readonly inContextExecutor = pythonInContextExecutor()
    ) { }

    protected get currentImgIdx(): number {
        this.currentIdx = (this.currentIdx + 1) % 10;
        return this.currentIdx;
    }

    abstract variableInformation(userSelection: VariableSelection) : Promise<VariableInformation | undefined>;
    abstract save(userSelection : UserSelection) : Promise<string | undefined>;

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
        return this.inContextExecutor.evaluate(session, expression);
    }
}