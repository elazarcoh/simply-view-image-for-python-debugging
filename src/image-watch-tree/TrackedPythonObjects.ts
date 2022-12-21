import * as crypto from "node:crypto";
import { Viewable } from "../viewable/Viewable";

export class TrackedPythonObjects {
    private readonly tracked = new Map<string, [PythonExpression, Viewable]>();

    private genTrackingId(o: PythonExpression): TrackingId {
        return {
            id: crypto
                .createHash("md5")
                .update(o.expression)
                .digest("hex")
                .toString(),
        };
    }

    public track(
        expression: PythonExpression,
        viewable: Viewable,
        id?: TrackingId
    ): TrackingId {
        if (id === undefined) {
            id = this.genTrackingId(expression);
        }
        this.tracked.set(id.id, [expression, viewable]);
        return id;
    }

    public untrack(id: TrackingId): void {
        this.tracked.delete(id.id);
    }

    public trackingIdIfTracked(o: PythonExpression): TrackingId | undefined {
        const trackingId = this.genTrackingId(o);
        return this.tracked.has(trackingId.id) ? trackingId : undefined;
    }

    public clear(): void {
        this.tracked.clear();
    }
}
