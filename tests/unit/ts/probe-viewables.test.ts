/**
 * Unit tests for the probe-viewables optimization (P7 Tier 1+2).
 *
 * Covers:
 *  1. fastExclude — correct viewable filtering by DAP type name
 *  2. constructProbeViewablesAndInfoCode — valid Python string generation
 *  3. parseProbeResult equivalent — viewable_type key extraction + info merging
 */

import type { Result } from '../../../src/utils/Result';

import type { Viewable } from '../../../src/viewable/Viewable';
import { describe, expect, it, vi } from 'vitest';
// Import inline to avoid heavy DI setup (AllViewables container, etc.)
// We test the Python code string structure directly.
import { constructProbeViewablesAndInfoCode } from '../../../src/python-communication/BuildPythonCode';
import { Err, Ok } from '../../../src/utils/Result';

// ---------------------------------------------------------------------------
// constructProbeViewablesAndInfoCode — structural / no-triple-quotes tests
// ---------------------------------------------------------------------------

import { notEmptyArray } from '../../../src/utils/Utils';

// ---------------------------------------------------------------------------
// parseProbeResult equivalent — inline re-implementation to test the logic
// ---------------------------------------------------------------------------

import { NumpyImage, PillowImage } from '../../../src/viewable/Image';
import { PlotlyFigure, PyplotAxes, PyplotFigure } from '../../../src/viewable/Plot';
import { NumpyTensor, TorchTensor } from '../../../src/viewable/Tensor';

// Mocks must be declared before importing the modules under test so that
// vi.mock() hoisting takes effect when modules with @Service() decorators load.
vi.mock('typedi', () => ({
  default: { set: vi.fn(), get: vi.fn(), has: vi.fn() },
  Service: () => (c: unknown) => c,
  Inject: () => () => {},
}));

vi.mock('../../../src/AllViewables', () => ({
  AllViewables: class {
    allViewables = [];
  },
}));

// ---------------------------------------------------------------------------
// fastExclude tests
// ---------------------------------------------------------------------------

describe('fastExclude — NumpyImage', () => {
  it('includes ndarray (restrict_types defaults to false)', () => {
    expect(NumpyImage.fastExclude?.('ndarray')).toBeFalsy();
  });

  it('excludes Tensor regardless of restrict_types', () => {
    expect(NumpyImage.fastExclude?.('Tensor')).toBe(true);
  });

  it('excludes Figure', () => {
    expect(NumpyImage.fastExclude?.('Figure')).toBe(true);
  });

  it('excludes FigureWidget', () => {
    expect(NumpyImage.fastExclude?.('FigureWidget')).toBe(true);
  });

  it('excludes Axes types', () => {
    expect(NumpyImage.fastExclude?.('Axes')).toBe(true);
    expect(NumpyImage.fastExclude?.('AxesSubplot')).toBe(true);
    expect(NumpyImage.fastExclude?.('Axes3D')).toBe(true);
  });

  it('does NOT exclude empty/unknown type (safe fallback)', () => {
    expect(NumpyImage.fastExclude?.('')).toBeFalsy();
  });

  it('does NOT exclude PIL types (permissive mode: np.asarray handles PIL)', () => {
    expect(NumpyImage.fastExclude?.('Image')).toBeFalsy();
    expect(NumpyImage.fastExclude?.('JpegImageFile')).toBeFalsy();
    expect(NumpyImage.fastExclude?.('PngImageFile')).toBeFalsy();
  });
});

describe('fastExclude — NumpyTensor', () => {
  it('includes ndarray (strict default)', () => {
    expect(NumpyTensor.fastExclude?.('ndarray')).toBeFalsy();
  });

  it('excludes Tensor, Figure, Axes', () => {
    expect(NumpyTensor.fastExclude?.('Tensor')).toBe(true);
    expect(NumpyTensor.fastExclude?.('Figure')).toBe(true);
    expect(NumpyTensor.fastExclude?.('AxesSubplot')).toBe(true);
  });

  it('does NOT exclude empty/unknown type', () => {
    expect(NumpyTensor.fastExclude?.('')).toBeFalsy();
  });
});

describe('fastExclude — TorchTensor', () => {
  it('includes Tensor', () => {
    expect(TorchTensor.fastExclude?.('Tensor')).toBeFalsy();
  });

  it('excludes ndarray', () => {
    expect(TorchTensor.fastExclude?.('ndarray')).toBe(true);
  });

  it('excludes Figure, Axes, PIL types', () => {
    expect(TorchTensor.fastExclude?.('Figure')).toBe(true);
    expect(TorchTensor.fastExclude?.('Axes')).toBe(true);
    expect(TorchTensor.fastExclude?.('Image')).toBe(true);
  });

  it('does NOT exclude empty/unknown type', () => {
    expect(TorchTensor.fastExclude?.('')).toBeFalsy();
  });
});

describe('fastExclude — PillowImage', () => {
  it('includes "Image" (base PIL class)', () => {
    expect(PillowImage.fastExclude?.('Image')).toBeFalsy();
  });

  it('includes types ending with ImageFile', () => {
    expect(PillowImage.fastExclude?.('JpegImageFile')).toBeFalsy();
    expect(PillowImage.fastExclude?.('PngImageFile')).toBeFalsy();
    expect(PillowImage.fastExclude?.('BmpImageFile')).toBeFalsy();
    expect(PillowImage.fastExclude?.('WebPImageFile')).toBeFalsy();
  });

  it('excludes ndarray', () => {
    expect(PillowImage.fastExclude?.('ndarray')).toBe(true);
  });

  it('excludes Tensor, Figure', () => {
    expect(PillowImage.fastExclude?.('Tensor')).toBe(true);
    expect(PillowImage.fastExclude?.('Figure')).toBe(true);
  });

  it('does NOT exclude empty/unknown type', () => {
    expect(PillowImage.fastExclude?.('')).toBeFalsy();
  });
});

describe('fastExclude — PlotlyFigure', () => {
  it('includes Figure and FigureWidget', () => {
    expect(PlotlyFigure.fastExclude?.('Figure')).toBeFalsy();
    expect(PlotlyFigure.fastExclude?.('FigureWidget')).toBeFalsy();
  });

  it('excludes ndarray, Tensor, Axes, PIL types', () => {
    expect(PlotlyFigure.fastExclude?.('ndarray')).toBe(true);
    expect(PlotlyFigure.fastExclude?.('Tensor')).toBe(true);
    expect(PlotlyFigure.fastExclude?.('Axes')).toBe(true);
    expect(PlotlyFigure.fastExclude?.('Image')).toBe(true);
  });

  it('does NOT exclude empty/unknown type', () => {
    expect(PlotlyFigure.fastExclude?.('')).toBeFalsy();
  });
});

describe('fastExclude — PyplotFigure', () => {
  it('includes Figure (both mpl and plotly have this DAP type name)', () => {
    expect(PyplotFigure.fastExclude?.('Figure')).toBeFalsy();
  });

  it('excludes ndarray, Tensor, Axes, PIL types', () => {
    expect(PyplotFigure.fastExclude?.('ndarray')).toBe(true);
    expect(PyplotFigure.fastExclude?.('Tensor')).toBe(true);
    expect(PyplotFigure.fastExclude?.('Axes')).toBe(true);
    expect(PyplotFigure.fastExclude?.('JpegImageFile')).toBe(true);
  });

  it('does NOT exclude empty/unknown type', () => {
    expect(PyplotFigure.fastExclude?.('')).toBeFalsy();
  });
});

describe('fastExclude — PyplotAxes', () => {
  it('includes Axes, AxesSubplot, Axes3D', () => {
    expect(PyplotAxes.fastExclude?.('Axes')).toBeFalsy();
    expect(PyplotAxes.fastExclude?.('AxesSubplot')).toBeFalsy();
    expect(PyplotAxes.fastExclude?.('Axes3D')).toBeFalsy();
  });

  it('excludes ndarray, Tensor, Figure, PIL types', () => {
    expect(PyplotAxes.fastExclude?.('ndarray')).toBe(true);
    expect(PyplotAxes.fastExclude?.('Tensor')).toBe(true);
    expect(PyplotAxes.fastExclude?.('Figure')).toBe(true);
    expect(PyplotAxes.fastExclude?.('Image')).toBe(true);
  });

  it('does NOT exclude empty/unknown type', () => {
    expect(PyplotAxes.fastExclude?.('')).toBeFalsy();
  });
});

const MOCK_VIEWABLE: Viewable = {
  group: 'image',
  type: 'test_type',
  title: 'Test',
  setupPythonCode: { setupCode: () => '', testSetupCode: '', id: 'test' },
  testTypePythonCode: { evalCode: (expr: string) => `is_test(${expr})` },
  infoPythonCode: { evalCode: (expr: string) => `test_info(${expr})` },
  serializeObjectPythonCode: {
    evalCode: (expr: string, path: string) => `test_save("${path}", ${expr})`,
  },
  suffix: '.png',
  supportsImageViewer: false,
};

describe('constructProbeViewablesAndInfoCode', () => {
  it('returns an EvalCodePython with non-empty pythonCode', () => {
    const result = constructProbeViewablesAndInfoCode([
      { expression: 'my_var', viewableSubset: [MOCK_VIEWABLE] },
    ]);
    expect(result.pythonCode).toBeTruthy();
    expect(typeof result.pythonCode).toBe('string');
  });

  it('does NOT contain triple single quotes (exec embedding safety)', () => {
    const result = constructProbeViewablesAndInfoCode([
      { expression: 'my_var', viewableSubset: [MOCK_VIEWABLE] },
      { expression: 'another', viewableSubset: [MOCK_VIEWABLE] },
    ]);
    expect(result.pythonCode.includes('\'\'\'')).toBe(false);
  });

  it('embeds the Viewable.type string as the first element of each triple', () => {
    const result = constructProbeViewablesAndInfoCode([
      { expression: 'v', viewableSubset: [MOCK_VIEWABLE] },
    ]);
    // The generated code should contain ("test_type", ...) per checker
    expect(result.pythonCode).toContain('"test_type"');
  });

  it('uses lambda: expression for the get_val callable', () => {
    const result = constructProbeViewablesAndInfoCode([
      { expression: 'x.attr', viewableSubset: [MOCK_VIEWABLE] },
    ]);
    expect(result.pythonCode).toContain('lambda: x.attr');
  });

  it('uses lambda _x: for test_fn and info_fn', () => {
    const result = constructProbeViewablesAndInfoCode([
      { expression: 'v', viewableSubset: [MOCK_VIEWABLE] },
    ]);
    expect(result.pythonCode).toContain('lambda _x: is_test(_x)');
    expect(result.pythonCode).toContain('lambda _x: test_info(_x)');
  });

  it('wraps the call in stringify()', () => {
    const result = constructProbeViewablesAndInfoCode([
      { expression: 'v', viewableSubset: [MOCK_VIEWABLE] },
    ]);
    expect(result.pythonCode).toContain('.stringify(');
    expect(result.pythonCode).toContain('.probe_viewables_and_info(');
  });

  it('produces an empty list for empty variablesWithViewables', () => {
    const result = constructProbeViewablesAndInfoCode([]);
    expect(result.pythonCode).toContain('probe_viewables_and_info([])');
  });

  it('generates correct number of variable entries', () => {
    const result = constructProbeViewablesAndInfoCode([
      { expression: 'a', viewableSubset: [MOCK_VIEWABLE] },
      { expression: 'b', viewableSubset: [MOCK_VIEWABLE] },
      { expression: 'c', viewableSubset: [] },
    ]);
    // Three outer entries: (lambda: a, [...]), (lambda: b, [...]), (lambda: c, [])
    expect(result.pythonCode).toContain('lambda: a');
    expect(result.pythonCode).toContain('lambda: b');
    expect(result.pythonCode).toContain('lambda: c');
  });
});

type PythonObjectInformation = Record<string, string>;
type InfoOrError = Result<[NonEmptyArray<Viewable>, PythonObjectInformation]>;

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
        matches.push([viewable, cleanInfo]);
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

describe('parseProbeResult', () => {
  const VIEWABLE_A: Viewable = { ...MOCK_VIEWABLE, type: 'type_a' };
  const VIEWABLE_B: Viewable = { ...MOCK_VIEWABLE, type: 'type_b' };
  const ALL = [VIEWABLE_A, VIEWABLE_B];

  it('returns Err("Not viewable") for empty matchingInfos', () => {
    const result = parseProbeResult([], ALL);
    expect(result.err).toBe(true);
  });

  it('returns Err("Not viewable") when all inner results are Err', () => {
    const result = parseProbeResult([Err('some python error')], ALL);
    expect(result.err).toBe(true);
  });

  it('extracts viewable by viewable_type key', () => {
    const infoWithType: PythonObjectInformation = {
      viewable_type: 'type_a',
      shape: '(100, 100, 3)',
      dtype: 'float32',
    };
    const result = parseProbeResult([Ok(infoWithType)], ALL);
    expect(result.ok).toBe(true);
    const [viewables] = result.safeUnwrap();
    expect(viewables[0].type).toBe('type_a');
  });

  it('strips viewable_type from the returned info dict', () => {
    const infoWithType: PythonObjectInformation = {
      viewable_type: 'type_a',
      shape: '(100, 100)',
      dtype: 'uint8',
    };
    const result = parseProbeResult([Ok(infoWithType)], ALL);
    expect(result.ok).toBe(true);
    const [, info] = result.safeUnwrap();
    expect('viewable_type' in info).toBe(false);
    expect(info.shape).toBe('(100, 100)');
    expect(info.dtype).toBe('uint8');
  });

  it('merges info from multiple matching viewables', () => {
    const infoA: PythonObjectInformation = { viewable_type: 'type_a', shape: '(10, 10)' };
    const infoB: PythonObjectInformation = { viewable_type: 'type_b', extra: 'yes' };
    const result = parseProbeResult([Ok(infoA), Ok(infoB)], ALL);
    expect(result.ok).toBe(true);
    const [viewables, info] = result.safeUnwrap();
    expect(viewables).toHaveLength(2);
    expect(info.shape).toBe('(10, 10)');
    expect(info.extra).toBe('yes');
    expect('viewable_type' in info).toBe(false);
  });

  it('ignores unknown viewable_type values (no matching viewable)', () => {
    const infoUnknown: PythonObjectInformation = { viewable_type: 'not_a_real_type', x: '1' };
    const result = parseProbeResult([Ok(infoUnknown)], ALL);
    expect(result.err).toBe(true);
  });

  it('skips Err entries and succeeds if at least one Ok matches', () => {
    const infoA: PythonObjectInformation = { viewable_type: 'type_a', shape: '(5, 5)' };
    const result = parseProbeResult([Err('some error'), Ok(infoA)], ALL);
    expect(result.ok).toBe(true);
    const [viewables] = result.safeUnwrap();
    expect(viewables[0].type).toBe('type_a');
  });
});
