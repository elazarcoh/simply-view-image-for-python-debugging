import Container, { Service } from "typedi";
import * as vscode from "vscode";
import { activeDebugSessionData } from "../debugger-utils/DebugSessionsHolder";
import { DebugVariablesTracker } from "../debugger-utils/DebugVariablesTracker";
import { logDebug, logError } from "../Logging";
import {
  combineMultiEvalCodePython,
  constructRunSameExpressionWithMultipleEvaluatorsCode,
} from "../python-communication/BuildPythonCode";
import { evaluateInPython } from "../python-communication/RunPythonCode";
import {
  findExpressionsViewables,
  findExpressionViewables,
} from "../PythonObjectInfo";
import { arrayUniqueByKey, notEmptyArray, zip } from "../utils/Utils";
import { Viewable } from "../viewable/Viewable";
import { Err, Ok, Result, errorMessage, isOkay } from "../utils/Result";

// ExpressionsList is global to all debug sessions
@Service()
class ExpressionsList {
  readonly expressions: string[] = [];
}

export const globalExpressionsList: ReadonlyArray<string> =
  Container.get(ExpressionsList).expressions;

export type InfoOrError = Result<
  [NonEmptyArray<Viewable>, PythonObjectInformation]
>;
type ExpressingWithInfo = [string, InfoOrError];

function removeSurroundingQuotesFromInfoObject(
  info: PythonObjectInformation,
): PythonObjectInformation {
  const removeSurroundingQuotes = (s: string): string =>
    s.startsWith('"') && s.endsWith('"') && s.length > 1
      ? s.slice(1, s.length - 1)
      : s;
  return Object.fromEntries(
    Object.entries(info).map(([k, v]) => [k, removeSurroundingQuotes(v)]),
  );
}

export class CurrentPythonObjectsList {
  private readonly _variablesList: ExpressingWithInfo[] = [];
  private _expressionsInfo: InfoOrError[] = [];

  constructor(
    private readonly debugVariablesTracker: DebugVariablesTracker,
    private readonly debugSession: vscode.DebugSession,
  ) {}

  private async retrieveVariables(): Promise<string[]> {
    const { locals, globals } =
      await this.debugVariablesTracker.currentFrameVariables();
    if (globals.length === 0 && locals.length === 0) {
      return [];
    }
    const allUniqueVariables = arrayUniqueByKey(
      [...globals, ...locals],
      (v) => v.evaluateName,
    );

    return allUniqueVariables.map((v) => v.evaluateName);
  }

  private async retrieveInformation(): Promise<{
    variables: {
      [index: number]: InfoOrError;
    };
    expressions: {
      [index: number]: InfoOrError;
    };
  }> {
    const variables = this._variablesList.map((v) => v[0]);
    const variablesViewables = await findExpressionsViewables(
      variables,
      this.debugSession,
    ).then((r) =>
      r.err
        ? Array<typeof r>(variables.length).fill(r)
        : r.safeUnwrap().map((v) => Ok(v)),
    );

    // expressions are evaluated separately, to avoid case of syntax error in one expression
    const expressionsViewables = await Promise.allSettled(
      globalExpressionsList.map((exp) =>
        findExpressionViewables(exp, this.debugSession),
      ),
    ).then((r) =>
      r.map((v) => (v.status === "fulfilled" ? v.value : Err(v.reason))),
    );

    const allViewables = [...variablesViewables, ...expressionsViewables].map(
      (evs) =>
        evs.ok
          ? evs.safeUnwrap().length > 0
            ? evs
            : Err("Not viewable")
          : evs,
    );

    const informationEvalCode = allViewables.map((evs) =>
      evs.map((vs) => vs.map((v) => v.infoPythonCode)),
    );

    const allExpressions = [...variables, ...globalExpressionsList];

    const codeOrErrors = zip(allExpressions, informationEvalCode).map(
      ([exp, infoEvalCodes]) =>
        infoEvalCodes.map((codes) =>
          constructRunSameExpressionWithMultipleEvaluatorsCode(exp, codes),
        ),
    );
    const codesWithIndices = codeOrErrors.map((c, i) => [i, c] as const);
    const codes = codesWithIndices
      .map(([, c]) => c)
      .filter(isOkay)
      .map((e) => e.safeUnwrap());
    const validIndices = codesWithIndices
      .filter(([, c]) => c.ok)
      .map(([i]) => i);
    const code = combineMultiEvalCodePython(codes);
    const res = await evaluateInPython(code, this.debugSession);

    if (res.err) {
      logError(
        `Error while retrieving information for variables and expressions: ${errorMessage(
          res,
        )}`,
      );
      return {
        variables: [],
        expressions: [],
      };
    } else {
      const validExpressionsInformation = Object.fromEntries(
        zip(validIndices, res.safeUnwrap().map(combineValidInfoErrorIfNone)),
      );
      const allExpressionsInformation = codesWithIndices.map(([i]) =>
        codeOrErrors[i].ok ? validExpressionsInformation[i] : codeOrErrors[i],
      );

      const sanitize = ([maybeViewables, info]: [
        Result<Viewable[]>,
        Result<PythonObjectInformation>,
      ]): InfoOrError => {
        if (maybeViewables.err) {
          return maybeViewables;
        } else if (info.err) {
          return info;
        } else {
          const viewables = maybeViewables.safeUnwrap();
          if (notEmptyArray(viewables)) {
            return Ok([
              viewables,
              removeSurroundingQuotesFromInfoObject(info.safeUnwrap()),
            ]);
          } else {
            return Err("Not viewable");
          }
        }
      };

      const allExpressionsViewablesAndInformation = zip(
        allViewables,
        allExpressionsInformation,
      ).map(sanitize);

      const variablesInformation = allExpressionsViewablesAndInformation.slice(
        0,
        this._variablesList.length,
      );
      const expressionsInformation =
        allExpressionsViewablesAndInformation.slice(this._variablesList.length);

      return {
        variables: variablesInformation,
        expressions: expressionsInformation,
      };
    }
  }

  public async update(): Promise<void> {
    const debugSessionData = activeDebugSessionData(this.debugSession);
    if (
      debugSessionData.isStopped === false ||
      debugSessionData.setupOkay === false
    ) {
      return;
    }
    this._variablesList.length = 0;
    const variables = await this.retrieveVariables();
    logDebug(`Got ${variables.length} variables: ${variables}`);
    this._variablesList.push(
      ...variables.map((v) => [v, Err("Not ready")] as ExpressingWithInfo),
    );

    const information = await this.retrieveInformation();
    const validVariables: { [index: number]: [string, InfoOrError] } = {};
    for (let i = 0; i < this._variablesList.length; i++) {
      const variable = this._variablesList[i];
      const name = variable[0];
      const info = information.variables[i];
      if (!info.err) {
        logDebug(
          `Got information for variable '${name}': ${JSON.stringify(
            info.safeUnwrap()[1],
          )}`,
        );
        validVariables[i] = variable;
        validVariables[i][1] = info;
      } else {
        logDebug(
          `Error while getting information for variable '${name}': ${errorMessage(
            info,
          )}`,
        );
      }
    }
    // filter variables that are not viewable
    this._variablesList.length = 0;
    this._variablesList.push(...Object.values(validVariables));

    // we do not filter expressions, length should be the same
    const numExpressionsReturned = Object.keys(information.expressions).length;
    if (numExpressionsReturned !== globalExpressionsList.length) {
      logError(
        `Unexpected number of expressions: ${numExpressionsReturned} (expected ${globalExpressionsList.length})`,
      );
      return;
    }
    this._expressionsInfo = Object.values(information.expressions);
  }

  public clear(): void {
    this._variablesList.length = 0;
    this._expressionsInfo.length = 0;
  }

  public get variablesList(): ReadonlyArray<ExpressingWithInfo> {
    return this._variablesList;
  }

  public get expressionsInfo(): ReadonlyArray<InfoOrError> | undefined {
    return this._expressionsInfo.length === 0
      ? undefined // return undefined, so in case the debugger is stopping it won't use the empty array here
      : this._expressionsInfo;
  }

  public find(expression: string):
    | {
        type: "variable" | "expression";
        InfoOrError: InfoOrError;
      }
    | undefined {
    const variable = this._variablesList.find((v) => v[0] === expression);
    if (variable !== undefined) {
      return {
        type: "variable",
        InfoOrError: variable[1],
      };
    } else {
      const index = globalExpressionsList.findIndex((e) => e === expression);
      if (index >= 0) {
        return {
          type: "expression",
          InfoOrError: this._expressionsInfo[index],
        };
      } else {
        return undefined;
      }
    }
  }

  public addExpression(expression: string): Promise<void> {
    Container.get(ExpressionsList).expressions.push(expression);
    return this.update();
  }

  public expressionsList({
    skipInvalid,
  }: {
    skipInvalid: boolean;
  }): ReadonlyArray<ExpressingWithInfo> {
    const expressionsInfoOrNotReady =
      this.expressionsInfo ??
      (Array(globalExpressionsList.length).fill(
        Err("Not ready") as InfoOrError,
      ) as InfoOrError[]);

    let expressions = zip(globalExpressionsList, expressionsInfoOrNotReady).map(
      ([exp, info]) => [exp, info] as ExpressingWithInfo,
    );

    if (skipInvalid) {
      expressions = expressions.filter(([, info]) => !info.err);
    }

    return expressions;
  }
}

function combineValidInfoErrorIfNone(
  infoOrErrors: Result<unknown>[],
): Result<Record<string, string>> {
  const validRecords = infoOrErrors.filter(isOkay).map((p) => p.safeUnwrap());

  if (validRecords.length === 0) {
    return Err("Invalid expression");
  } else {
    const allEntries = validRecords
      .flatMap((o) =>
        typeof o === "object" && o !== null ? Object.entries(o) : [],
      )
      .map(([k, v]) => [k, JSON.stringify(v)] as const);
    const merged = Object.fromEntries(allEntries);
    return Ok(merged);
  }
}

export async function addExpression(): Promise<boolean> {
  const maybeExpression = await vscode.window.showInputBox({
    prompt: "Enter expression to watch",
    placeHolder: "e.g. images[0]",
    ignoreFocusOut: true,
  });
  if (maybeExpression !== undefined && maybeExpression !== "") {
    Container.get(ExpressionsList).expressions.push(maybeExpression);
    return true;
  }
  return false;
}

export async function editExpression(expression: string): Promise<boolean> {
  const expressions = Container.get(ExpressionsList).expressions;
  const idx = expressions.indexOf(expression);
  if (idx > -1) {
    const maybeExpression = await vscode.window.showInputBox({
      prompt: "Enter expression to watch",
      value: expression,
      placeHolder: "e.g. images[0]",
      ignoreFocusOut: true,
    });
    if (maybeExpression !== undefined) {
      expressions[idx] = maybeExpression;
      return true;
    }
  }
  return false;
}

export function removeExpression(expression: string): boolean {
  const expressions = Container.get(ExpressionsList).expressions;
  const idx = expressions.indexOf(expression);
  if (idx > -1) {
    expressions.splice(idx, 1);
    return true;
  }
  return false;
}

export function removeAllExpressions(): string[] {
  const expressions = Container.get(ExpressionsList).expressions;
  if (expressions.length > 0) {
    const removedExpressions = expressions.slice(0);
    expressions.length = 0;
    return removedExpressions;
  }
  return [];
}
