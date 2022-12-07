import Container from "typedi";
import { AllViewables } from "../AllViewables";
import { inList } from "./BuildPythonCode";

export function pythonObjectTypeCode(expression: string) : string {
    const viewables = Container.get(AllViewables).allViewables;


}