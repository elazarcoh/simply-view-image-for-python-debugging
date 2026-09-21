import type { DebugVariablesTracker, TrackedVariable } from '../session/debugger/DebugVariablesTracker';
import type { Result } from '../utils/Result';
import type { Viewable } from '../viewable/Viewable';
import _ from 'lodash';
import Container, { Service } from 'typedi';
import * as vscode from 'vscode';
import { AllViewables } from '../AllViewables';
import { logDebug, logError } from '../Logging';
import {
  combineMultiEvalCodePython,
  constructProbeViewablesAndInfoCode,
  constructRunSameExpressionWithMultipleEvaluatorsCode,
} from '../python-communication/BuildPythonCode';
import { evaluateInPython } from '../python-communication/RunPythonCode';
import {
  findExpressionViewables,
} from '../PythonObjectInfo';
import { activeDebugSessionData } from '../session/debugger/DebugSessionsHolder';
import { debugSession } from '../session/Session';
import { Err, errorMessage, isOkay, Ok } from '../utils/Result';
import { arrayUniqueByKey, notEmptyArray, zip } from '../utils/Utils';
import { WatchTreeProvider } from './WatchTreeProvider';

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

  private async retrieveVariables(): Promise<TrackedVariable[]> {
    const { locals, globals }
      = await this.debugVariablesTracker.currentFrameVariables();
    if (globals.length === 0 && locals.length === 0) {
      return [];
    }
    const allUniqueVariables = arrayUniqueByKey(
      [...globals, ...locals],
      v => v.evaluateName,
    );

    return allUniqueVariables;
  }

  private async retrieveInformation({
    variables,
    expressions,
  }: {
    variables: TrackedVariable[];
    expressions: string[];
  }): Promise<{
    variables: {
      [index: number]: InfoOrError;
    };
    expressions: {
      [index: number]: InfoOrError;
    };
  }> {
    const allViewables = Container.get(AllViewables).allViewables;

    // ===== Variables: single probe call with fastExclude filtering =====
    const variablesWithSubsets = variables.map(v => ({
      expression: v.evaluateName,
      viewableSubset: allViewables.filter(
        viewable => !viewable.fastExclude || !viewable.fastExclude(v.type),
      ),
    }));

    let variablesInformation: { [index: number]: InfoOrError } = {};

    if (variables.length > 0) {
      const probeCode = constructProbeViewablesAndInfoCode(variablesWithSubsets);
      const probeResult = await evaluateInPython<
        Array<Array<Result<PythonObjectInformation>>>
      >(probeCode, debugSession(this.debugSession));

      if (probeResult.err) {
        logError(
          `Error during probe eval: ${errorMessage(probeResult)}`,
        );
        variablesInformation = Object.fromEntries(
          variables.map((_, i) => [i, Err(errorMessage(probeResult))] as const),
        );
      }
      else {
        const probeResults = probeResult.safeUnwrap();
        variablesInformation = Object.fromEntries(
          variables.map((_, i) => {
            const matchingInfos = (probeResults[i] ?? []) as Result<PythonObjectInformation>[];
            return [i, parseProbeResult(matchingInfos, allViewables)] as const;
          }),
        );
      }
    }

    // ===== Expressions: per-expression evaluation (preserves error isolation) =====

    // expressions are evaluated separately, to avoid case of syntax error in one expression
    const expressionsViewables = await Promise.allSettled(
      expressions.map(exp =>
        findExpressionViewables(exp, debugSession(this.debugSession)),
      ),
    ).then(r =>
      r.map(v => (v.status === 'fulfilled' ? v.value : Err(v.reason))),
    );

    const expressionsWithViewables = expressionsViewables.map(evs =>
      evs.ok
        ? evs.safeUnwrap().length > 0
          ? evs
          : Err('Not viewable')
        : evs,
    );

    const expressionInfoEvalCodes = expressionsWithViewables.map(evs =>
      evs.map(vs => vs.map(v => v.infoPythonCode)),
    );

    const expressionCodeOrErrors = zip(
      expressions,
      expressionInfoEvalCodes,
    ).map(([exp, infoEvalCodes]) =>
      infoEvalCodes.map(codes =>
        constructRunSameExpressionWithMultipleEvaluatorsCode(exp, codes),
      ),
    );

    const expressionCodesWithIndices = expressionCodeOrErrors.map(
      (c, i) => [i, c] as const,
    );
    const validExpressionCodes = expressionCodesWithIndices.flatMap(([i, c]) =>
      c.ok ? [[i, c.safeUnwrap()] as const] : [],
    );

    const expressionsInformation: { [index: number]: InfoOrError } = {};

    if (validExpressionCodes.length > 0) {
      const expressionCode = combineMultiEvalCodePython(
        validExpressionCodes.map(([, c]) => c),
      );
      const expressionRes = await evaluateInPython(
        expressionCode,
        debugSession(this.debugSession),
      );

      if (expressionRes.err) {
        logError(
          `Error while retrieving information for expressions: ${errorMessage(expressionRes)}`,
        );
      }
      else {
        const validExpressionInfo = Object.fromEntries(
          zip(
            validExpressionCodes.map(([i]) => i),
            expressionRes.safeUnwrap().map(combineValidInfoErrorIfNone),
          ),
        );

        const sanitizeExpression = ([maybeViewables, info]: [
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

        for (const [i, c] of expressionCodesWithIndices) {
          const infoResult = validExpressionInfo[i];
          if (c.ok && infoResult !== undefined) {
            expressionsInformation[i] = sanitizeExpression([
              expressionsWithViewables[i],
              infoResult,
            ]);
          }
          else if (!c.ok) {
            expressionsInformation[i] = c;
          }
        }
      }
    }

    // Fill remaining (unevaluated due to outer errors or no valid codes)
    for (let i = 0; i < expressions.length; i++) {
      if (expressionsInformation[i] === undefined) {
        const code = expressionCodeOrErrors[i];
        expressionsInformation[i] = code.ok ? Err('Not viewable') : code;
      }
    }

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

    const trackedVariables = await this.retrieveVariables();
    logDebug(
      `Got ${trackedVariables.length} variables: ${trackedVariables.map(v => v.evaluateName)}`,
    );

    // Progressive rendering: show variable names immediately as placeholders
    // so the tree is populated before the Python eval completes.
    this._variablesList.push(
      ...trackedVariables.map(
        v => [v.evaluateName, Err('Evaluating\u2026')] as ExpressingWithInfo,
      ),
    );
    Container.get(WatchTreeProvider).refresh();

    const information = await this.retrieveInformation({
      variables: trackedVariables,
      expressions: globalExpressionsList.slice(),
    });

    const validVariables: [string, InfoOrError][] = trackedVariables.map(
      v => [v.evaluateName, Err('Not ready')] as ExpressingWithInfo,
    );
    for (let i = 0; i < validVariables.length; i++) {
      const name = validVariables[i][0];
      const info = information.variables[i];
      if (info !== undefined && !info.err) {
        logDebug(
          `Got information for variable '${name}': ${JSON.stringify(
            info.safeUnwrap()[1],
          )}`,
        );
        validVariables[i][1] = info;
      }
      else {
        logDebug(
          `Error/not viewable for variable '${name}': ${
            info !== undefined ? errorMessage(info) : 'no info'
          }`,
        );
      }
    }

    // Replace placeholders with real data (filter to viewable variables only)
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

/**
 * Parse the inner result list for a single variable from probe_viewables_and_info.
 * Each element corresponds to a viewable that passed the type test; its info dict
 * has an extra "viewable_type" key identifying which Viewable matched.
 */
function parseProbeResult(
  matchingInfos: Result<PythonObjectInformation>[],
  allViewables: ReadonlyArray<Viewable>,
): InfoOrError {
  const matches: [Viewable, PythonObjectInformation][] = [];

  for (const infoResult of matchingInfos) {
    if (infoResult.ok) {
      const info = infoResult.safeUnwrap();
      const viewableType = info.viewable_type;
      const viewable = allViewables.find(v => v.type === viewableType);
      if (viewable !== undefined) {
        const cleanInfo = Object.fromEntries(
          Object.entries(info).filter(([k]) => k !== 'viewable_type'),
        ) as PythonObjectInformation;
        matches.push([
          viewable,
          removeSurroundingQuotesFromInfoObject(cleanInfo),
        ]);
      }
    }
  }

  if (matches.length === 0) {
    return Err('Not viewable');
  }

  const viewables = matches.map(([v]) => v);
  const mergedInfo = Object.assign(
    {},
    ...matches.map(([, i]) => i),
  ) as PythonObjectInformation;

  if (!notEmptyArray(viewables)) {
    return Err('Not viewable');
  }

  return Ok([viewables, mergedInfo]);
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
