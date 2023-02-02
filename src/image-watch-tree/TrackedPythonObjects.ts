import * as vscode from "vscode";
import * as crypto from "node:crypto";
import {
    combineMultiEvalCodePython,
    constructValueWrappedExpressionFromEvalCode,
} from "../python-communication/BuildPythonCode";
import { evaluateInPython } from "../python-communication/RunPythonCode";
import { Viewable } from "../viewable/Viewable";
import { openImageToTheSide } from "../utils/VSCodeUtils";
import { allFulfilled } from "../utils/Utils";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
import { logError } from "../Logging";
import { Except } from "../utils/Except";

type TrackedObject = {
    expression: PythonExpression;
    viewable: Viewable;
    savePath: string;
};

export class TrackedPythonObjects {
    private readonly tracked = new Map<string, TrackedObject>();

    private genTrackingId(o: PythonExpression): TrackingId {
        return {
            id: crypto
                .createHash("md5")
                .update(o.expression)
                .digest("hex")
                .toString(),
        };
    }

    public changeViewable(trackingId: TrackingId, viewable: Viewable): void {
        const data = this.tracked.get(trackingId.id);
        if (data !== undefined) {
            this.tracked.set(trackingId.id, {
                ...data,
                viewable,
            });
        }
    }

    public track(
        expression: PythonExpression,
        viewable: Viewable,
        savePath: string,
        id?: TrackingId
    ): TrackingId {
        if (id === undefined) {
            id = this.genTrackingId(expression);
        }
        this.tracked.set(id.id, {
            expression,
            viewable,
            savePath,
        });
        return id;
    }

    public untrack(id: TrackingId): void {
        this.tracked.delete(id.id);
    }

    public trackingIdIfTracked(o: PythonExpression): TrackingId | undefined {
        const trackingId = this.genTrackingId(o);
        return this.tracked.has(trackingId.id) ? trackingId : undefined;
    }

    public savePath(trackingId: TrackingId): string | undefined {
        const data = this.tracked.get(trackingId.id);
        return data?.savePath;
    }

    public clear(): void {
        this.tracked.clear();
    }

    public get allTracked(): ReadonlyArray<TrackedObject> {
        return [...this.tracked.values()];
    }
}

export async function saveAllTrackedObjects(
    trackedObjects: ReadonlyArray<TrackedObject>,
    session: vscode.DebugSession
): Promise<void> {
    const codes = trackedObjects.map(({ expression, viewable, savePath }) => {
        return constructValueWrappedExpressionFromEvalCode(
            viewable.serializeObjectPythonCode,
            expression.expression,
            `${savePath}${viewable.suffix}`
        );
    });
    const saveObjectsCode = combineMultiEvalCodePython(codes);

    const debugSessionData = activeDebugSessionData(session);
    const mkdirRes = debugSessionData.savePathHelper.mkdir();
    if (mkdirRes.isError) {
        logError(
            `Failed to create directory for saving tracked objects: ${mkdirRes.errorMessage}`
        );
        return;
    }

    const saveResult = await evaluateInPython(saveObjectsCode, session);
    if (Except.isError(saveResult)) {
        logError(`Failed to save tracked objects: ${saveResult.errorMessage}`);
        return;
    } else {
        await allFulfilled(
            trackedObjects.map(async (v) => {
                const pathWithSuffix = `${v.savePath}${v.viewable.suffix}`;
                if (v.viewable.onShow !== undefined) {
                    await v.viewable.onShow(pathWithSuffix);
                } else {
                    await openImageToTheSide(pathWithSuffix, false);
                }
            })
        );
    }
}
