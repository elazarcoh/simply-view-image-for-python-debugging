import { handleError } from "./ErrorHandling";
import { Python } from "./SavePythonObject";
import type { ObjectType, PythonObjectRepresentation } from "./types";
import { openImageToTheSide } from "./utils/VSCodeUtils";

export async function viewObject(
    obj: PythonObjectRepresentation,
    asType?: ObjectType,
): Promise<void> {
    const path = await Python.PythonObject.save(obj, asType);
    if (path.isError) {
        return handleError(path.error);
    }
    await openImageToTheSide(path.result, true);
}

export const commands: [string, (...args: any[]) => Promise<unknown>][] = [
    ["svifpd._internal_view-object", viewObject],
];