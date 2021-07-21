import * as vscode from 'vscode';
import { join } from 'path';
import { isVariableSelection, ScopeVariables, UserSelection, Variable } from "./PythonSelection";

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

    protected async viewableVariables(session: vscode.DebugSession): Promise<ScopeVariables> {
        let res = await session.customRequest('scopes', { frameId: this.frameId });
        const scopes = res.scopes;
        const local = scopes[0];
        const global = scopes[1];

        const getVars = async (scope: any): Promise<Variable[]> => {
            const res = await session.customRequest('variables', { variablesReference: scope.variablesReference });
            const variables: any[] = res.variables;
            return variables;
        };

        const [localVariables, globalVariables] = await Promise.all([
            local ? getVars(local) : [],
            global ? getVars(global) : [],
        ]);

        return { locals: localVariables, globals: globalVariables };
    }

    protected async variableNameOrExpression(session: vscode.DebugSession, document: vscode.TextDocument, range: vscode.Range): Promise<UserSelection | undefined> {
        const selected = document.getText(range);
        if (selected !== "") {
            return { range: selected };  // the user selection
        }

        // the user not selected a range. need to figure out which variable he's on
        const { locals, globals } = await this.viewableVariables(session);

        const selectedVariable = document.getText(document.getWordRangeAtPosition(range.start));
        const targetVariable = locals.find(v => v.name === selectedVariable) ?? globals.find(v => v.name === selectedVariable);

        if (targetVariable !== undefined) {
            return { variable: targetVariable.evaluateName }; // var name 
        } else {
            return undefined;
        }
    }

    protected evaluate(session: vscode.DebugSession, expression: string) {
        return session.customRequest("evaluate", { expression: expression, frameId: this.frameId, context: 'hover' });
    }
}