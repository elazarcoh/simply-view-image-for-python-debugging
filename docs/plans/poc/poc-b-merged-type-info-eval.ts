/**
 * POC B: Merge type-detection + info retrieval into a single Python eval
 *
 * Current flow (2 round-trips per stop):
 *   Round-trip 1: findExpressionsViewables() — run type tests for all variables
 *   Round-trip 2: retrieveInformation()       — run info for viewable variables
 *
 * Proposed flow (1 round-trip):
 *   Single call: probe_viewables_and_info() — type tests + info in one shot
 *
 * The key Python function lives in the injected module and takes a list of
 * (expression, [(test_fn, info_fn), ...]) pairs. For each expression it:
 *   1. Evaluates the expression once to get the value.
 *   2. Runs type tests sequentially, stopping at first match.
 *   3. For the matching type, immediately fetches info.
 *   4. Returns everything in one serialised structure.
 *
 * This cuts Python eval round-trips from 2 to 1.
 */

// ─── Python helper to add to common.py ───────────────────────────────────────
//
// paste into src/python/common.py (inside the module exec block):
const PROBE_PYTHON = `
def probe_viewables_and_info(expr_checkers):
    """
    expr_checkers: list of
        (get_val,  [(test_fn, info_fn), ...])
    where get_val is a zero-argument lambda that evaluates the target expression.

    Returns list of:
        (matched_index_or_minus1, info_value_or_None)
    for each entry in expr_checkers.

    Runs type tests in order; stops at the first match.
    """
    results = []
    for get_val, checker_pairs in expr_checkers:
        try:
            val = get_val()
        except Exception as e:
            results.append(eval_into_value(lambda: (_ for _ in ()).throw(e)))
            continue

        matched = -1
        info = None
        for idx, (test_fn, info_fn) in enumerate(checker_pairs):
            try:
                if test_fn(val):
                    matched = idx
                    info = eval_into_value(lambda: info_fn(val))
                    break
            except Exception:
                pass
        results.append((matched, info))
    return results
`;

// ─── TypeScript: new combined code builder ────────────────────────────────────

import type { Viewable } from '../../../src/viewable/Viewable';
import Container from 'typedi';
import { AllViewables } from '../../../src/AllViewables';
import { PYTHON_MODULE_NAME } from '../../../src/python-communication/BuildPythonCode';
import { evaluateInPython } from '../../../src/python-communication/RunPythonCode';
import type { Session } from '../../../src/session/Session';
import type { Result } from '../../../src/utils/Result';
import { Err, Ok } from '../../../src/utils/Result';

type ViewableWithInfo = { viewables: Viewable[]; info: PythonObjectInformation };

/**
 * Single eval that returns both the matching viewable types and the info dict
 * for each expression. Replaces the two-step findExpressionsViewables +
 * retrieveInformation pattern.
 *
 * Returns an array parallel to `expressions`.
 *   Ok([viewables, info]) → matched at least one viewable
 *   Err(reason)           → no match or eval error
 */
export async function probeExpressionsViewablesAndInfo(
  expressions: string[],
  session: Session,
): Promise<Result<Array<Result<ViewableWithInfo>>>> {
  const allViewables = Container.get(AllViewables).allViewables;

  // Build the Python list literal:
  //   [
  //     (lambda: expr0, [(test0_0, info0_0), (test0_1, info0_1)]),
  //     (lambda: expr1, [(test1_0, info1_0), ...]),
  //     ...
  //   ]
  const perExpr = expressions.map((expr) => {
    const checkerPairs = allViewables
      .map(v => {
        const testCode = v.testTypePythonCode.evalCode('_x');
        const infoCode = v.infoPythonCode.evalCode('_x');
        return `(lambda _x: ${testCode}, lambda _x: ${infoCode})`;
      })
      .join(', ');
    return `(lambda: ${expr}, [${checkerPairs}])`;
  });

  const pythonCode = `${PYTHON_MODULE_NAME}.probe_viewables_and_info([${perExpr.join(', ')}])`;

  const res = await evaluateInPython({ pythonCode } as EvalCodePython<unknown[]>, session);
  if (res.err) return res as Result<never>;

  const raw = res.safeUnwrap() as Array<[number, Result<PythonObjectInformation> | null]>;

  const results = raw.map((entry, i) => {
    const [matchedIndex, info] = entry;
    if (matchedIndex < 0 || info === null) {
      return Err('Not viewable') as Result<ViewableWithInfo>;
    }
    if (info.err) return info as Result<ViewableWithInfo>;

    const matchedViewable = allViewables[matchedIndex];
    return Ok({ viewables: [matchedViewable], info: info.safeUnwrap() }) as Result<ViewableWithInfo>;
  });

  return Ok(results);
}

/*
 * ─── Round-trip comparison ──────────────────────────────────────────────────
 *
 * BEFORE (current PythonObjectsList.retrieveInformation):
 *   1. findExpressionsViewables(variables)         → 1 DAP eval (type tests)
 *   2. findExpressionViewables(expr) × M           → M DAP evals (per-expression)
 *   3. evaluateInPython(combineMultiEvalCode(...))  → 1 DAP eval (info fetch)
 *   Total: 2 + M round-trips (M = # watched expressions, typically 0-5)
 *
 * AFTER:
 *   1. probeExpressionsViewablesAndInfo([...vars, ...exprs])  → 1 DAP eval
 *   Total: 1 round-trip
 *
 * ─── Edge cases ──────────────────────────────────────────────────────────────
 *
 * 1. Expression isolation: current code evaluates expressions separately so a
 *    syntax error in one doesn't block others. This POC evaluates them together.
 *    Mitigation: split watched expressions into separate probe calls and merge.
 *    Or: keep per-expression isolation only for the watched expressions.
 *
 * 2. "First match wins" semantics: the Python loop stops at the first matching
 *    viewable. Current code collects ALL matching viewables for a variable
 *    (e.g., an ndarray can be both NumpyImage and NumpyTensor). The probe_fn
 *    needs to collect all matches, not just the first.
 *    Fix: remove the `break` from the Python loop.
 *
 * 3. Code string length: generating all checker pairs inline for 10 variables ×
 *    6 viewable types produces a large Python string. DAP evaluate has practical
 *    limits (~64KB). For normal use (≤20 variables) this is fine.
 *
 * 4. setup_code dependency: the probe function uses eval_into_value which is
 *    defined in common.py (already injected). No new setup needed beyond
 *    adding the function definition to common.py.
 *
 * 5. Viewable ordering: `matchedIndex` into allViewables must be stable. Since
 *    allViewables is a singleton (Container.get(AllViewables)), this is safe.
 *
 * ─── Variant: keep 2-round-trip for watched expressions ─────────────────────
 *
 * The biggest win is for local VARIABLES (typically 5-20, evaluated every stop).
 * Watched EXPRESSIONS are fewer and already evaluated in parallel today.
 * A reasonable middle ground: merge only the variable evaluation path, keep
 * watched expressions separate to preserve their error isolation behaviour.
 */
