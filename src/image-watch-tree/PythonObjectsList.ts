import type { DebugVariablesTracker } from '../session/debugger/DebugVariablesTracker';
import type { Result } from '../utils/Result';
import type { Viewable } from '../viewable/Viewable';
import _ from 'lodash';
import Container, { Service } from 'typedi';
import * as vscode from 'vscode';
import { logDebug, logError } from '../Logging';
import {
  combineMultiEvalCodePython,
  constructRunSameExpressionWithMultipleEvaluatorsCode,
} from '../python-communication/BuildPythonCode';
import { evaluateInPython } from '../python-communication/RunPythonCode';
import {
  findExpressionsViewables,
  findExpressionViewables,
} from '../PythonObjectInfo';
import { activeDebugSessionData } from '../session/debugger/DebugSessionsHolder';
import { debugSession } from '../session/Session';
import { Err, errorMessage, isOkay, Ok } from '../utils/Result';
import { arrayUniqueByKey, notEmptyArray, zip } from '../utils/Utils';

// ExpressionsList is global to all debug sessions
@Service()
class ExpressionsList {
  readonly expressions: string[] = [];
}

export const globalExpressionsList: ReadonlyArray<string>
  = Container.get(ExpressionsList).expressions;

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

export class CurrentPythonObjectsListData {
  protected readonly _variablesList: ExpressingWithInfo[] = [];
  protected _expressionsInfo: InfoOrError[] = [];

  public clear(): void {
    this._variablesList.length = 0;
    this._expressionsInfo.length = 0;
  }

  public manuallyAddVariable(variable: string, infoOrError: InfoOrError): void {
    if (this._variablesList.find(v => v[0] === variable) === undefined) {
      this._variablesList.push([variable, infoOrError]);
    }
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
      type: 'variable' | 'expression';
      InfoOrError: InfoOrError;
    }
    | undefined {
    const variable = this._variablesList.find(v => v[0] === expression);
    if (variable !== undefined) {
      return {
        type: 'variable',
        InfoOrError: variable[1],
      };
    }
    else {
      const index = globalExpressionsList.findIndex(e => e === expression);
      if (index >= 0) {
        return {
          type: 'expression',
          InfoOrError: this._expressionsInfo[index],
        };
      }
      else {
        return undefined;
      }
    }
  }

  public expressionsList({
    skipInvalid,
  }: {
    skipInvalid: boolean;
  }): ReadonlyArray<ExpressingWithInfo> {
    const expressionsInfoOrNotReady
      = this.expressionsInfo
        ?? (Array.from({ length: globalExpressionsList.length }).fill(
          Err('Not ready') as InfoOrError,
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

export class CurrentPythonObjectsList extends CurrentPythonObjectsListData {
  constructor(
    private readonly debugVariablesTracker: DebugVariablesTracker,
    private readonly debugSession: vscode.DebugSession,
  ) {
    super();
  }

  private async retrieveVariables(): Promise<string[]> {
    const { locals, globals }
      = await this.debugVariablesTracker.currentFrameVariables();
    if (globals.length === 0 && locals.length === 0) {
      return [];
    }
    const allUniqueVariables = arrayUniqueByKey(
      [...globals, ...locals],
      v => v.evaluateName,
    );

    return allUniqueVariables.map(v => v.evaluateName);
  }

  private async retrieveInformation({
    variables,
    expressions,
  }: {
    variables: string[];
    expressions: string[];
  }): Promise<{
    variables: {
      [index: number]: InfoOrError;
    };
    expressions: {
      [index: number]: InfoOrError;
    };
  }> {
    const variablesViewables = await findExpressionsViewables(
      variables,
      debugSession(this.debugSession),
    ).then(r =>
      r.err
        ? Array.from<typeof r>({ length: variables.length }).fill(r)
        : r.safeUnwrap().map(v => Ok(v)),
    );

    // expressions are evaluated separately, to avoid case of syntax error in one expression
    const expressionsViewables = await Promise.allSettled(
      expressions.map(exp =>
        findExpressionViewables(exp, debugSession(this.debugSession)),
      ),
    ).then(r =>
      r.map(v => (v.status === 'fulfilled' ? v.value : Err(v.reason))),
    );

    const allViewables = [...variablesViewables, ...expressionsViewables].map(
      evs =>
        evs.ok
          ? evs.safeUnwrap().length > 0
            ? evs
            : Err('Not viewable')
          : evs,
    );

    const informationEvalCode = allViewables.map(evs =>
      evs.map(vs => vs.map(v => v.infoPythonCode)),
    );

    const allExpressions = [...variables, ...expressions];

    const codeOrErrors = zip(allExpressions, informationEvalCode).map(
      ([exp, infoEvalCodes]) =>
        infoEvalCodes.map(codes =>
          constructRunSameExpressionWithMultipleEvaluatorsCode(exp, codes),
        ),
    );
    const codesWithIndices = codeOrErrors.map((c, i) => [i, c] as const);
    const codes = codesWithIndices
      .map(([, c]) => c)
      .filter(isOkay)
      .map(e => e.safeUnwrap());
    const validIndices = codesWithIndices
      .filter(([, c]) => c.ok)
      .map(([i]) => i);
    const code = combineMultiEvalCodePython(codes);
    const res = await evaluateInPython(code, debugSession(this.debugSession));

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
    }

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
      }
      else if (info.err) {
        return info;
      }
      else {
        const viewables = maybeViewables.safeUnwrap();
        if (notEmptyArray(viewables)) {
          return Ok([
            viewables,
            removeSurroundingQuotesFromInfoObject(info.safeUnwrap()),
          ]);
        }
        else {
          return Err('Not viewable');
        }
      }
    };

    const allExpressionsViewablesAndInformation = zip(
      allViewables,
      allExpressionsInformation,
    ).map(sanitize);

    const variablesInformation = allExpressionsViewablesAndInformation.slice(
      0,
      variables.length,
    );
    const expressionsInformation = allExpressionsViewablesAndInformation.slice(
      variables.length,
    );

    return {
      variables: variablesInformation,
      expressions: expressionsInformation,
    };
  }

  private async _update(): Promise<void> {
    this._variablesList.length = 0;
    const debugSessionData = activeDebugSessionData(this.debugSession);
    if (
      debugSessionData.isStopped === false
      || debugSessionData.setupOkay === false
    ) {
      return;
    }

    const variableNames = await this.retrieveVariables();
    logDebug(`Got ${variableNames.length} variables: ${variableNames}`);
    // this._variablesList.push(
    //   ...variables.map((v) => [v, Err("Not ready")] as ExpressingWithInfo),
    // );

    const information = await this.retrieveInformation({
      variables: variableNames,
      expressions: globalExpressionsList.slice(),
    });
    const validVariables: [string, InfoOrError][] = variableNames.map(
      v => [v, Err('Not ready')] as ExpressingWithInfo,
    );
    for (let i = 0; i < validVariables.length; i++) {
      const variable = validVariables[i];
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
      }
      else {
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

  public update = _.throttle(this._update.bind(this), 2000, {
    leading: true,
  });

  public addExpression(expression: string): Promise<void> {
    Container.get(ExpressionsList).expressions.push(expression);
    return this._update();
  }
}

function combineValidInfoErrorIfNone(
  infoOrErrors: Result<unknown>[],
): Result<Record<string, string>> {
  const validRecords = infoOrErrors.filter(isOkay).map(p => p.safeUnwrap());

  if (validRecords.length === 0) {
    return Err('Invalid expression');
  }
  else {
    const allEntries = validRecords
      .flatMap(o =>
        typeof o === 'object' && o !== null ? Object.entries(o) : [],
      )
      .map(([k, v]) => [k, JSON.stringify(v)] as const);
    const merged = Object.fromEntries(allEntries);
    return Ok(merged);
  }
}

export async function addExpression(): Promise<boolean> {
  const maybeExpression = await vscode.window.showInputBox({
    prompt: 'Enter expression to watch',
    placeHolder: 'e.g. images[0]',
    ignoreFocusOut: true,
  });
  if (maybeExpression !== undefined && maybeExpression !== '') {
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
      prompt: 'Enter expression to watch',
      value: expression,
      placeHolder: 'e.g. images[0]',
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
