import { DebugProtocol } from "vscode-debugprotocol";
import { logDebug } from "../Logging";
import { PYTHON_MODULE_NAME } from "../python-communication/BuildPythonCode";

type TrackedVariable = {
    name: string;
    evaluateName: string;
    frameId: number;
    type: string;
};

const VARIABLES_TO_FILTER = new Set([
    PYTHON_MODULE_NAME,
    "special variables",
    "class variables",
    "function variables",
]);

const REGEX_TO_FILTER = [/__pydevd_ret_val_dict.*/];

const TYPES_TO_FILTER = new Set([
    "",
    "module",
    "function",
    "dict",
    "tuple",
    "set",
    "str",
    "bytes",
    "NoneType",
    "int",
    "float",
    "bool",
    "ZMQExitAutocall",
]);

function filterVariables(
    variables: DebugProtocol.Variable[]
): DebugProtocol.Variable[] {
    return variables.filter(
        (variable) =>
            !VARIABLES_TO_FILTER.has(variable.name) &&
            (variable.type === undefined || !TYPES_TO_FILTER.has(variable.type)) &&
            !REGEX_TO_FILTER.some((regex) => regex.test(variable.name))
    );
}

export class DebugVariablesTracker {
    readonly localVariables: TrackedVariable[] = [];
    readonly globalVariables: TrackedVariable[] = [];

    readonly scopesRequests: Map<
        number,
        {
            frameId: number;
        }
    > = new Map();
    readonly frameForVariableReference = new Map<
        number,
        {
            frameId: number;
            scope: "local" | "global";
        }
    >();
    readonly variablesRequests: Map<
        number,
        {
            frameId: number;
            variablesReference: number;
            scope: "local" | "global";
        }
    > = new Map();
    _currentFrameId: number | undefined;

    currentFrameId(): number | undefined {
        return this._currentFrameId;
    }

    setFrameId(frameId: number | undefined): void {
        this._currentFrameId = frameId;
    }

    onScopesRequest(request: DebugProtocol.ScopesRequest): void {
        const requestId = request.seq;
        const frameId = request.arguments.frameId;
        logDebug(
            `Captures scopes request ${requestId} with frameId ${frameId}`
        );
        this.scopesRequests.set(requestId, { frameId });
    }

    onScopesResponse(response: DebugProtocol.ScopesResponse): void {
        const request = this.scopesRequests.get(response.request_seq);
        if (request !== undefined) {
            logDebug(
                `Captured scopes response ${response.request_seq} for frameId ${request.frameId}`
            );
            const frameId = request.frameId;
            this._currentFrameId = frameId;
            this.scopesRequests.delete(response.request_seq);
            const [global, local] = response.body.scopes;
            logDebug(`Local scope reference ${local.variablesReference}`);
            this.frameForVariableReference.set(local.variablesReference, {
                frameId,
                scope: "local",
            });
            logDebug(`Global scope reference ${global.variablesReference}`);
            this.frameForVariableReference.set(global.variablesReference, {
                frameId,
                scope: "global",
            });
        }
    }

    onVariablesRequest(request: DebugProtocol.VariablesRequest): void {
        const frame = this.frameForVariableReference.get(
            request.arguments.variablesReference
        );
        if (frame !== undefined) {
            logDebug(
                `Captured variables request ${request.seq}, for variablesReference ${request.arguments.variablesReference}`
            );
            this.variablesRequests.set(request.seq, {
                variablesReference: request.arguments.variablesReference,
                ...frame,
            });
        }
    }

    onVariablesResponse(response: DebugProtocol.VariablesResponse): void {
        const request = this.variablesRequests.get(response.request_seq);
        if (request !== undefined) {
            logDebug(
                `Captured variable response ${response.request_seq} For ${request.scope}, with ${response.body.variables.length} variables`
            );
            const frameId = request.frameId;
            this.variablesRequests.delete(response.request_seq);
            if (request.scope === "local") {
                this.localVariables.length = 0;
            } else {
                this.globalVariables.length = 0;
            }
            const variablesForScope =
                request.scope === "local"
                    ? this.localVariables
                    : this.globalVariables;
            this._currentFrameId = frameId;
            for (const variable of filterVariables(response.body.variables)) {
                const evaluateName = variable.evaluateName ?? variable.name;
                logDebug(
                    `Got variable ${evaluateName} for frame ${frameId}, of type ${variable.type}.`
                );
                variablesForScope.push({
                    name: variable.name,
                    evaluateName,
                    frameId,
                    type: variable.type ?? "unknown",
                });
            }
        }
    }

    onContinued(): void {
        //
    }

    getVariable(name: string): TrackedVariable | undefined {
        return (
            this.localVariables.find((v) => v.evaluateName === name) ??
            this.globalVariables.find((v) => v.evaluateName === name)
        );
    }

    async currentFrameVariables(): Promise<{
        locals: TrackedVariable[];
        globals: TrackedVariable[];
    }> {
        return {
            locals: this.localVariables.filter(
                (v) => v.frameId === this._currentFrameId
            ),
            globals: this.globalVariables.filter(
                (v) => v.frameId === this._currentFrameId
            ),
        };
    }
}
