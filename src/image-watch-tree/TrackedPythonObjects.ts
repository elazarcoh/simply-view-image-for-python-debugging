
export class TrackedPythonObjects {
    readonly tracked = new Map<string, PythonObjectRepresentation>();

    private randomId() {
        return Math.random().toString(36).substring(2, 8);
    }

    public track(o: PythonObjectRepresentation, id?: string): string {
        if (id === undefined) {
            id = this.randomId();
        }
        this.tracked.set(id, o);
        return id;
    }

    public untrack(id: string): void {
        this.tracked.delete(id);
    }

    public async saveTracked(): Promise<void> {
        throw new Error("Not implemented");
    }

}