import Container from "typedi";
import { AllViewables } from "../AllViewables";
import {combineSetupCodes, sameValueMultipleEvalsPythonCode } from "./BuildPythonCode";

export function viewablesSetupCode() : string {
    const viewables = Container.get(AllViewables).allViewables;
    const code = combineSetupCodes(viewables.map(v => v.setupPythonCode));
    return code;
}

export function pythonObjectTypeCode(expression: string) : string {
    const viewables = Container.get(AllViewables).allViewables;
    const code = sameValueMultipleEvalsPythonCode(expression, viewables.map(v => v.infoPythonCode));
    return code;
}