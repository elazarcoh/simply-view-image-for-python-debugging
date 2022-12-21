import * as crypto from "node:crypto";

export class TrackedPythonObjects {
    private readonly tracked = new Map<string, PythonExpression>();

    private genTrackingId(o: PythonExpression): TrackingId {
        return {
            id: crypto
                .createHash("md5")
                .update(o.expression)
                .digest("hex")
                .toString(),
        };
    }

    public track(o: PythonExpression, id?: TrackingId): TrackingId {
        if (id === undefined) {
            id = this.genTrackingId(o);
        }
        this.tracked.set(id.id, o);
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
