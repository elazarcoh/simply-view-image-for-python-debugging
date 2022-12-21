import * as crypto from "node:crypto";
import { Viewable } from "../viewable/Viewable";

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

    public changeViewable(
        trackingId: TrackingId,
        viewable: Viewable
    ): void {
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
}
