import Container from "typedi";
import { AllViewables } from "./AllViewables";
import { logError } from "./Logging";
import {
  combineMultiEvalCodePython,
  constructRunSameExpressionWithMultipleEvaluatorsCode,
} from "./python-communication/BuildPythonCode";
import { evaluateInPython } from "./python-communication/RunPythonCode";
import { Viewable } from "./viewable/Viewable";
import { Err, Ok, Result, errorMessage } from "./utils/Result";
import { Session } from "./session/Session";

function listOfValidViewables(
  viewables: ReadonlyArray<Viewable>,
  isOfType: Result<boolean>[],
) {
  return isOfType
    .map((isOfType, i) => ({ isOfType, i }))
    .filter(({ isOfType }) => !isOfType.err && isOfType.safeUnwrap())
    .map(({ i }) => viewables[i]);
}

export async function findExpressionViewables(
  expression: string,
  session: Session,
): Promise<Result<Viewable[]>> {
  const viewables = Container.get(AllViewables).allViewables;
  const code = constructRunSameExpressionWithMultipleEvaluatorsCode(
    expression,
    viewables.map((v) => v.testTypePythonCode),
  );
  const isOfType = await evaluateInPython(code, session);

  if (isOfType.err) {
    logError(
      `Error finding viewables for expression \`${expression}\`. Error: ${errorMessage(
        isOfType,
      )}`,
    );
    return Err(errorMessage(isOfType));
  } else {
    const objectViewables = listOfValidViewables(
      viewables,
      isOfType.safeUnwrap(),
    );

    return Ok(objectViewables);
  }
}

export async function findExpressionsViewables(
  expressions: string[],
  session: Session,
): Promise<Result<Viewable[][]>> {
  const viewables = Container.get(AllViewables).allViewables;
  const codes = expressions.map((expression) =>
    constructRunSameExpressionWithMultipleEvaluatorsCode(
      expression,
      viewables.map((v) => v.testTypePythonCode),
    ),
  );
  const code = combineMultiEvalCodePython(codes);
  const isOfType = await evaluateInPython(code, session);

  if (isOfType.err) {
    const message = `Error finding viewables for expressions \`${expressions.join(
      ", ",
    )}\`. Error: ${errorMessage(isOfType)}`;
    logError(message);
    return Err(errorMessage(isOfType));
  } else {
    const objectsViewables = isOfType
      .safeUnwrap()
      .map((isOfType: Result<boolean>[]) =>
        listOfValidViewables(viewables, isOfType),
      );
    return Ok(objectsViewables);
  }
}
