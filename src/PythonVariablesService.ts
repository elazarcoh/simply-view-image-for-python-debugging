import * as vscode from 'vscode';
import { ScopeVariables, UserSelection, Variable } from './PythonSelection';
import { allFulfilled } from './utils';


class PythonVariablesService {
    protected threadId: number = 0;
    protected frameId: number = 0;


    public setThreadId(threadId: number) {
        this.threadId = threadId;
    }
    public setFrameId(frameId: number) {
        this.frameId = frameId;
    }

    private get session() {
        return vscode.debug.activeDebugSession;
    }

    protected async variableNameOrExpression(session: vscode.DebugSession, document: vscode.TextDocument, range: vscode.Range): Promise<UserSelection | undefined> {
        const selected = document.getText(range);
        if (selected !== "") {
            return { range: selected };  // the user selection
        }

        // the user not selected a range. need to figure out which variable he's on
        const { locals, globals } = await this.viewableVariables(session) ?? {};

        const selectedVariable = document.getText(document.getWordRangeAtPosition(range.start));
        const targetVariable = locals?.find(v => v.name === selectedVariable) ?? globals?.find(v => v.name === selectedVariable);

        if (targetVariable !== undefined) {
            return { variable: targetVariable.evaluateName }; // var name 
        } else {
            return undefined;
        }
    }

    public async viewableVariables(session?: vscode.DebugSession): Promise<ScopeVariables | undefined> {
        session ?? (session = this.session);
        if(session === undefined) return;

        let res = await session.customRequest('scopes', { frameId: this.frameId });
        const scopes = res.scopes;
        const local = scopes[0];
        const global = scopes[1];

        const getVars = async (scope: any): Promise<Variable[]> => {
            const res = await session?.customRequest('variables', { variablesReference: scope.variablesReference });
            return res.variables;
        };

        const [localVariables, globalVariables] = await allFulfilled([
            local ? getVars(local) : Promise.resolve([]),
            global ? getVars(global) : Promise.resolve([]),
        ]);

        return { locals: localVariables ?? [], globals: globalVariables ?? [] };
    }

    async userSelection(document: vscode.TextDocument, range: vscode.Range): Promise<UserSelection | undefined> {
        const session = vscode.debug.activeDebugSession;
        if (session === undefined) {
            return;
        }
        const userSelection = await this.variableNameOrExpression(session, document, range);
        if (userSelection === undefined) {
            return;
        }
        return userSelection;
    }
}


let _pythonVariablesService: PythonVariablesService;
export function pythonVariablesService(): PythonVariablesService {
    _pythonVariablesService ?? (_pythonVariablesService = new PythonVariablesService);
    return _pythonVariablesService;
}