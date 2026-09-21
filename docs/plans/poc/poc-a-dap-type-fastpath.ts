/**
 * POC A: DAP type-field fast-path
 *
 * The DAP VariablesResponse already includes `type: variable.type` which is
 * `type(obj).__name__` from Python — for free, before any Python eval.
 *
 * DebugVariablesTracker already stores this in TrackedVariable.type.
 * TYPES_TO_FILTER already uses it to exclude primitives.
 *
 * This POC shows how to use the positive direction:
 *   - Each Viewable declares which Python class names it *might* match.
 *   - Before building the Python eval payload, exclude viewable types that
 *     cannot possibly match, reducing the number of lambda arguments.
 *   - If ALL viewables are excluded for a variable → skip Python eval entirely.
 *
 * Zero Python evaluations needed for the filtering itself.
 */

// ─── Viewable interface extension ────────────────────────────────────────────

// Add to src/viewable/Viewable.ts:
interface ViewableWithFastPath<T = unknown> {
  // ... existing fields ...

  /**
   * Optional. Python class names (type(obj).__name__) that are known to be
   * candidates for this viewable. The viewable will only be tested in Python
   * if the DAP-reported type name is in this set (or set is absent).
   *
   * Use for INCLUSION only — if the class name is in the set, Python eval
   * still runs and can return false. If absent (undefined), all variables are
   * tested regardless of type name.
   *
   * Convention: list base class names (e.g., 'ndarray'), NOT every subclass.
   */
  candidateTypeNames?: ReadonlySet<string>;

  /**
   * Optional. Provides a TypeScript-side check using only the DAP type name.
   * Return true  → this viewable MIGHT match; run Python eval.
   * Return false → this viewable CANNOT match; skip Python eval for it.
   * Return undefined → unknown; run Python eval.
   *
   * Supersedes candidateTypeNames when present.
   */
  fastExclude?: (dacTypeName: string) => boolean;
}

// ─── Concrete viewable declarations ──────────────────────────────────────────
//
// NumpyImage (image_numpy.py): isinstance(obj, np.ndarray)
//   DAP type for np.ndarray is always "ndarray"
const NumpyImageFastPath: ViewableWithFastPath = {
  candidateTypeNames: new Set(['ndarray']),
};

// NumpyTensor (numpy_tensor.py): same base type
const NumpyTensorFastPath: ViewableWithFastPath = {
  candidateTypeNames: new Set(['ndarray']),
};

// TorchTensor (torch_tensor.py): isinstance(obj, torch.Tensor)
//   DAP type for torch tensors is "Tensor"
const TorchTensorFastPath: ViewableWithFastPath = {
  candidateTypeNames: new Set(['Tensor']),
};

// PillowImage (image_pillow.py): isinstance(obj, PIL.Image.Image)
//   PIL subclasses: JpegImageFile, PngImageFile, BmpImageFile, RGBImageFile, …
//   Cannot enumerate all subclasses; use fastExclude instead.
const PillowImageFastPath: ViewableWithFastPath = {
  fastExclude: (typeName) => !typeName.endsWith('ImageFile') && typeName !== 'Image',
};

// PlotlyFigure (plot_plotly.py): isinstance(obj, BaseFigure)
//   DAP type: "Figure" (plotly.graph_objs.Figure)
const PlotlyFigureFastPath: ViewableWithFastPath = {
  candidateTypeNames: new Set(['Figure', 'FigureWidget']),
};

// PyplotFigure (plot_pyplot.py): isinstance(obj, plt.Figure)
//   DAP type: "Figure"
const PyplotFigureFastPath: ViewableWithFastPath = {
  candidateTypeNames: new Set(['Figure']),
};

// PyplotAxes (plot_pyplot.py): isinstance(obj, plt.Axes)
//   DAP type for Axes subplots: "Axes", "AxesSubplot" (deprecated in mpl 3.8+), "Axes3D"
const PyplotAxesFastPath: ViewableWithFastPath = {
  fastExclude: (typeName) =>
    typeName !== 'Axes' && !typeName.startsWith('Axes'),
};

// ─── Modified findExpressionsViewables ───────────────────────────────────────
//
// This shows how PythonObjectsList.retrieveInformation would call the new code.

import type { Viewable } from '../../../src/viewable/Viewable';
import Container from 'typedi';
import { AllViewables } from '../../../src/AllViewables';
import {
  combineMultiEvalCodePython,
  constructRunSameExpressionWithMultipleEvaluatorsCode,
} from '../../../src/python-communication/BuildPythonCode';
import { evaluateInPython } from '../../../src/python-communication/RunPythonCode';
import type { Session } from '../../../src/session/Session';
import type { Result } from '../../../src/utils/Result';
import { Err, Ok } from '../../../src/utils/Result';

interface TrackedVariableWithType {
  evaluateName: string;
  /** Python type(obj).__name__ from DAP variables response. Empty string if absent. */
  typeName: string;
}

function viewablesCandidateForType(
  viewable: ViewableWithFastPath,
  typeName: string,
): boolean {
  if (!typeName) return true; // no type info → assume candidate

  if (viewable.fastExclude !== undefined) {
    return !viewable.fastExclude(typeName);
  }
  if (viewable.candidateTypeNames !== undefined) {
    return viewable.candidateTypeNames.has(typeName);
  }
  return true; // no fast-path declared → always candidate
}

export async function findExpressionsViewablesFastPath(
  variables: TrackedVariableWithType[],
  session: Session,
): Promise<Result<Viewable[][]>> {
  const allViewables = Container.get(AllViewables).allViewables as (Viewable & ViewableWithFastPath)[];

  // For each variable, compute the subset of viewables that could match.
  const viewableSubsets = variables.map(v =>
    allViewables.filter(viewable => viewablesCandidateForType(viewable, v.typeName)),
  );

  // Variables where ALL viewables are excluded can be short-circuited.
  const skippedIndices = new Set<number>();
  viewableSubsets.forEach((subset, i) => {
    if (subset.length === 0) skippedIndices.add(i);
  });

  // Only evaluate variables that have at least one candidate viewable.
  const toEvaluate = variables
    .map((v, i) => ({ v, i }))
    .filter(({ i }) => !skippedIndices.has(i));

  if (toEvaluate.length === 0) {
    return Ok(variables.map(() => []));
  }

  // Build one batched eval: only include candidate viewable lambdas per variable.
  const codes = toEvaluate.map(({ v, i }) =>
    constructRunSameExpressionWithMultipleEvaluatorsCode(
      v.evaluateName,
      viewableSubsets[i].map(vv => vv.testTypePythonCode),
    ),
  );
  const combined = combineMultiEvalCodePython(codes);
  const res = await evaluateInPython(combined, session);

  if (res.err) return res;

  // Reconstruct full result, inserting empty arrays for skipped variables.
  const evaluated = res.safeUnwrap() as Result<boolean>[][];
  const evalResults: Viewable[][] = [];
  let evalIdx = 0;

  for (let i = 0; i < variables.length; i++) {
    if (skippedIndices.has(i)) {
      evalResults.push([]);
    } else {
      const isOfType = evaluated[evalIdx++];
      const subset = viewableSubsets[i];
      const matched = isOfType
        .map((r, j) => ({ r, j }))
        .filter(({ r }) => !r.err && (r as Ok<boolean>).val)
        .map(({ j }) => subset[j]);
      evalResults.push(matched);
    }
  }

  return Ok(evalResults);
}

/*
 * ─── Expected impact ────────────────────────────────────────────────────────
 *
 * Scenario: 10 local variables, 6 viewable types (NumpyImage, NumpyTensor,
 *           TorchTensor, PillowImage, PlotlyFigure, PyplotFigure).
 *
 * BEFORE: one eval call with 10 × 6 = 60 lambda expressions
 *
 * AFTER (typical step through a function with one ndarray called "img"):
 *   - 8 non-array variables → skipped entirely (0 lambdas each)
 *   - 1 ndarray → only NumpyImage + NumpyTensor lambdas (2 lambdas)
 *   - 1 Tensor → only TorchTensor lambdas (1 lambda)
 *   Total: 3 lambdas, 1 eval call  (was: 60 lambdas, 1 eval call)
 *
 * The Python string passed to DAP is ~20x smaller → faster to serialize,
 * transmit, and execute.
 *
 * ─── Edge cases ──────────────────────────────────────────────────────────────
 *
 * 1. restrict_types=false (NumpyImage): is_numpy_image accepts any object that
 *    np.asarray() can handle (lists, etc.). With candidateTypeNames=['ndarray'],
 *    we'd miss list variables. Mitigation: only apply fast-path when
 *    restrict_types=true, OR widen candidateTypeNames for NumpyImage.
 *    Alternatively, use fastExclude to only exclude clearly irrelevant types.
 *
 * 2. PIL subclasses: many PIL image types end in "ImageFile" but not all.
 *    The fastExclude implementation above is conservative (any endsWith match
 *    passes through). Fine as a filter — Python test still verifies.
 *
 * 3. DAP type might be absent: some debug adapters don't populate type.
 *    When typeName === '' or undefined, fast-path returns true (no exclusion).
 *
 * 4. User subclassing: a user class named 'Tensor' that isn't PyTorch.
 *    TorchTensorFastPath would let it through → Python eval runs → returns false.
 *    No harm, just loses the optimization for that variable.
 *
 * 5. NumpyImage vs NumpyTensor both claim 'ndarray': both get tested in Python.
 *    The Python test itself correctly disambiguates (shape/dim checks differ).
 */
