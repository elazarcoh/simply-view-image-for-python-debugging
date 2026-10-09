# P7: Cache Viewable Info Between Debug Stops — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce Python evaluation overhead per debug stop by caching viewable type detection and metadata info results.

**Architecture:** Add a per-session cache layer in `DebugSessionData` that stores viewable type mappings and object metadata. Cache keys include variable names and Python `id()` references. The cache is invalidated on frame change, session end, or when object identity changes.

**Tech Stack:** TypeScript, VS Code Debug Adapter Protocol, existing `ts-results` pattern.

> **Status (May 2026):** In plan/exploration phase. POC files for all alternatives are in [`docs/plans/poc/`](poc/).

---

## Current State Analysis

### Per-stop Python execution cost

When a debug stop occurs, the extension executes Python code in the target process:

1. **Type detection** — 1 batched call for local variables + 1 call per watched expression (1 + M)
2. **Info retrieval** — 1 combined call for all viewable objects
3. **Total:** 2 + M Python evaluations per debug stop

### Data flow

```
stopped event → 500ms debounce → refreshAllDataViews()
  → PythonObjectsList.update() [2000ms throttle]
    → retrieveVariables()           # DAP variables request (fast)
    → findExpressionsViewables()    # Python eval: type tests
    → retrieveInformation()         # Python eval: metadata
    → WatchTreeProvider.refresh()   # UI update
```

### Key files

| File                                                  | Role                                           |
| ----------------------------------------------------- | ---------------------------------------------- |
| `src/image-watch-tree/PythonObjectsList.ts:145-269`   | Main update loop: retrieve, detect, fetch info |
| `src/PythonObjectInfo.ts:24-82`                       | `findExpressionViewables()` — type detection   |
| `src/session/debugger/DebugAdapterTracker.ts:110-140` | Event handling: stopped, continued, variables  |
| `src/session/debugger/DebugSessionData.ts`            | Per-session state storage                      |
| `src/AllViewables.ts`                                 | Viewable type registry                         |

---

## What CAN Be Cached

### 1. Viewable type mapping (expression → Viewable[])

- **Key:** `(expression, frame_id)` — variable name + current stack frame
- **Value:** `Viewable[]` — list of matching viewable types
- **Hit condition:** Same variable name appears in the same function scope
- **Invalidation:** Frame change (different function), session end
- **Savings:** Eliminates type-test Python eval for known variables

### 2. Object metadata (expression → info dict)

- **Key:** `(expression, python_id)` — variable name + Python object identity
- **Value:** `T` — the info result (shape, dtype, etc.)
- **Hit condition:** Same object identity between stops (stepping within same function)
- **Invalidation:** Object identity changes (`id(obj)` differs), frame change, session end
- **Savings:** Eliminates info-retrieval Python eval for unchanged objects

### 3. Setup state (already cached)

- `DebugSessionData.setupOkay` flag prevents re-running module injection
- No changes needed here

## What MUST Be Re-evaluated

| Data                         | Why                                    | Frequency                                        |
| ---------------------------- | -------------------------------------- | ------------------------------------------------ |
| Variable names               | Different breakpoint = different scope | Every stop                                       |
| Object identity (`id()`)     | Need to detect mutations               | Every stop (but cheap via DAP)                   |
| Object values after mutation | User may modify variables              | Every stop if identity matches but we can't know |
| Type tests for NEW variables | Never seen this name before            | On first encounter                               |

---

## Risks and Consequences

### Risk 1: Stale cache shows wrong data

**Scenario:** Object is mutated in-place between stops (e.g., `img[:] = 0`). Python `id()` doesn't change, so cache thinks it's the same object.

**Mitigation options:**

- **A. Accept it** — show stale info until next type change. Most variables don't mutate in-place.
- **B. Hash check** — add a lightweight Python `hash(obj.tobytes()[:1024])` check. Expensive for large arrays.
- **C. Generation counter** — track a "stop count" and limit cache lifetime to N stops.
- **D. User refresh button** — add a "Refresh" button to the watch tree that forces full re-eval.

**Recommendation:** Option A + D. In-place mutation is rare in debugging. A manual refresh button handles the edge case without performance cost.

### Risk 2: Memory leak from unbounded cache

**Scenario:** Long debugging session accumulates thousands of cached entries.

**Mitigation:**

- Limit cache size (LRU with max entries, e.g., 500)
- Clear cache on frame change (covers most cases)
- Clear cache on session end (already handled by `DebugSessionData` lifecycle)

### Risk 3: Cache key collisions

**Scenario:** Variable `x` in function `foo()` is different from `x` in function `bar()`, but both map to the same cache key.

**Mitigation:** Include frame ID in cache key. DAP provides `frameId` with each stopped event.

### Risk 4: Race conditions with async evaluation

**Scenario:** Two debug stops happen quickly. First stop's cache write arrives after second stop's read.

**Mitigation:**

- Use the existing 2000ms throttle on `update()` — this serializes updates
- Add a generation/epoch counter that's incremented on each stop
- Discard cache writes from stale generations

### Risk 5: `id()` reuse after garbage collection

**Scenario:** Python reuses an `id()` for a new object after the old one was GC'd.

**Mitigation:**

- Always invalidate cache on frame change (new function = new variables = new ids)
- For within-function stepping, `id()` reuse is extremely unlikely between adjacent stops
- Combined with type checking (viewable type must match), false hits are near-impossible

---

## Implementation Plan

### Task 1: Add Python `id()` retrieval

**Files:**

- Modify: `src/PythonObjectInfo.ts:24-82`
- Modify: `src/image-watch-tree/PythonObjectsList.ts:186-207`

**What:** Extend the info retrieval to also fetch `id(obj)` alongside the metadata. This is nearly free since it's added to the same batch eval call.

**Python code addition:**

```python
# In the combined eval, add id() to the result
eval_into_value(lambda: {"info": info_func(val), "obj_id": id(val)})
```

**Consequence check:** This changes the shape of the info result. All consumers of `PythonObjectInformation` must be updated to unwrap the new structure.

### Task 2: Create ViewableCache class

**Files:**

- Create: `src/image-watch-tree/ViewableCache.ts`

**What:** A simple cache with:

```typescript
interface CacheEntry<T> {
  value: T;
  frameId: number;
  objectId: number; // Python id()
  generation: number; // stop counter
}

class ViewableCache {
  private typeCache: Map<string, CacheEntry<Viewable[]>>;
  private infoCache: Map<string, CacheEntry<unknown>>;

  getType(expression: string, frameId: number): Viewable[] | undefined;
  setType(expression: string, frameId: number, viewables: Viewable[]): void;

  getInfo(expression: string, objectId: number): unknown | undefined;
  setInfo(expression: string, objectId: number, info: unknown): void;

  invalidateFrame(): void; // Called on frame change
  clear(): void; // Called on session end
  nextGeneration(): void; // Called on each stop
}
```

**Consequence check:** Pure addition, no existing code changes. Can be unit tested independently.

### Task 3: Integrate type cache into PythonObjectsList

**Files:**

- Modify: `src/image-watch-tree/PythonObjectsList.ts:159-175`

**What:** Before calling `findExpressionsViewables()`, check the type cache. Only evaluate variables not found in cache.

```typescript
// Partition variables into cached and uncached
const cached = variables.filter(v => cache.getType(v, frameId));
const uncached = variables.filter(v => !cache.getType(v, frameId));

// Only evaluate uncached
const freshViewables = uncached.length > 0
  ? await findExpressionsViewables(uncached, session)
  : [];

// Merge cached + fresh results
// Store fresh results in cache
```

**Consequence check:** If cache hits are wrong, the variable shows the wrong type in the watch tree. Worst case: user sees "not viewable" for a viewable object or vice versa. Manual refresh fixes this.

### Task 4: Integrate info cache into PythonObjectsList

**Files:**

- Modify: `src/image-watch-tree/PythonObjectsList.ts:186-207`

**What:** Before calling `evaluateInPython()` for info retrieval, check the info cache using `(expression, objectId)` key. Skip evaluation for cache hits.

**Consequence check:** If cache hits are stale, the metadata (shape, dtype) shown in the tree may be wrong until next cache invalidation. This is the highest-risk change.

### Task 5: Add cache invalidation hooks

**Files:**

- Modify: `src/session/debugger/DebugAdapterTracker.ts:110-140`
- Modify: `src/session/debugger/DebugSessionData.ts`

**What:**

- On `continued` event: call `cache.invalidateFrame()`
- On `stopped` event: call `cache.nextGeneration()`
- On session end: `cache.clear()` (via existing cleanup)

**Consequence check:** Over-invalidation is safe (just reduces cache hits). Under-invalidation causes stale data. The `continued` event is the safest invalidation point since it means execution resumed.

### Task 6: Add "Refresh" tree item action

**Files:**

- Modify: `src/image-watch-tree/WatchTreeProvider.ts`
- Modify: `package.json` (contributes.commands, contributes.menus)

**What:** Add a refresh button to the Image Watch tree view toolbar that clears the cache and triggers a full re-evaluation.

**Consequence check:** Small UI addition. Users get a way to force fresh data without restarting the debug session.

### Task 7: Unit tests

**Files:**

- Create: `tests/unit/ts/test_viewable_cache.js`

**Tests:**

- Cache hit/miss for type and info
- Frame invalidation clears type cache
- Object ID change causes info cache miss
- Generation counter prevents stale writes
- LRU eviction at max size
- Clear empties everything

---

## Execution Order

```
Task 2 (ViewableCache class + tests)     ← pure addition, safe
  ↓
Task 7 (unit tests for cache)            ← verify before integrating
  ↓
Task 1 (add id() retrieval)              ← small change to existing flow
  ↓
Task 3 (integrate type cache)            ← first integration point
  ↓
Task 4 (integrate info cache)            ← second integration point
  ↓
Task 5 (cache invalidation hooks)        ← connect lifecycle
  ↓
Task 6 (refresh button)                  ← safety net for users
```

## Estimated Impact

| Scenario                       | Before      | After                                |
| ------------------------------ | ----------- | ------------------------------------ |
| First stop at breakpoint       | 2 + M evals | 2 + M evals (cold cache)             |
| Stepping within same function  | 2 + M evals | 0-1 evals (warm cache)               |
| Stepping to different function | 2 + M evals | 2 + M evals (cache invalidated)      |
| Same breakpoint hit again      | 2 + M evals | 0-1 evals (cache may still be valid) |

For the common case of stepping through code (F10/F11), this eliminates most Python evaluations since variables rarely change type between adjacent lines.

## Decision: Should We Implement This?

**Pros:**

- Significantly reduces debug stop latency for stepping
- No user-visible behavior change in normal cases
- Refresh button provides escape hatch

**Cons:**

- Adds complexity to the already-complex update flow
- Stale cache bugs are subtle and hard to reproduce
- The 2000ms throttle already mitigates most UX issues

**Recommendation:** Implement Tasks 2 + 7 first (ViewableCache + tests) as a standalone PR. Then implement the integration tasks one at a time, each as a separate PR, measuring the actual performance impact at each step. If the impact is marginal, stop early.

---

## Additional Alternatives Explored (May 2026)

> POC implementations for all alternatives below are in [`docs/plans/poc/`](poc/).
> Each POC file contains a runnable sketch, edge case analysis, and impact estimates.

The original plan focuses on a TypeScript-side cache keyed on `id(obj)`. During exploration, five additional approaches were identified. Several are strictly better than the original on specific dimensions.

---

### Alt-A: DAP type-field fast-path (`poc-a-dap-type-fastpath.ts`)

**Observation:** The DAP `VariablesResponse` already returns `type: variable.type` — the Python `type(obj).__name__` string — for every variable. `DebugVariablesTracker` already stores this field. `TYPES_TO_FILTER` already uses it to exclude primitives. The current code does not use it in the *positive* direction.

**Idea:** Add an optional `candidateTypeNames?: ReadonlySet<string>` or `fastExclude?: (typeName: string) => boolean` to the `Viewable` interface. Before building the Python eval payload, filter out viewable types that cannot possibly match based on the known DAP type name. If a variable's DAP type excludes all viewables, skip the Python eval entirely for that variable.

**Type mappings discovered from source:**
| Python class name (DAP type) | Viewable types to test |
|---|---|
| `ndarray` | NumpyImage, NumpyTensor only |
| `Tensor` | TorchTensor only |
| `Figure` | PyplotFigure, PlotlyFigure only |
| `Axes`, `AxesSubplot`, `Axes3D` | PyplotAxes only |
| PIL subclasses (`JpegImageFile`, etc.) | PillowImage only |
| anything else | check all (fallback) |

**Impact:** With 10 local variables and 6 viewable types:
- Current: 60 lambda expressions in the batched eval call
- With fast-path (1 ndarray, 1 Tensor, 8 others): 3 lambda expressions

The Python string transmitted via DAP shrinks ~20×. Python execution time per eval is proportionally reduced.

**Cost:** Purely TypeScript additions — no Python changes. Adds `candidateTypeNames` to each Viewable definition, plus filtering logic in `findExpressionsViewables`.

**Edge cases:**
1. `restrict_types=false` (NumpyImage) — `is_numpy_image` accepts any `np.asarray()`-able object (including lists). If `candidateTypeNames = ['ndarray']`, list variables are skipped. Use `fastExclude` conservatively: only exclude types where *no* viewable could possibly match.
2. `type` field absent — some DAP implementations don't populate it. When `typeName` is empty, fall back to checking all viewables.
3. PIL subclass names vary (`JpegImageFile`, `WebPImageFile`, etc.) — use `fastExclude: (t) => !t.endsWith('ImageFile') && t !== 'Image'` as a conservative filter.
4. User-defined class named `Tensor` — passes the fast-path filter, Python test returns false. No harm, just misses the optimisation for that variable.

**Assessment:** Highest ratio of benefit to implementation cost. Zero Python overhead. Should be implemented before any caching strategy.

---

### Alt-B: Merge type-detection + info retrieval into one eval (`poc-b-merged-type-info-eval.ts`)

**Observation:** `retrieveInformation()` currently makes two Python eval round-trips per stop:
1. `findExpressionsViewables()` — type tests for all variables
2. `evaluateInPython(combineMultiEvalCode(...))` — info fetch for matching variables

**Idea:** A single new Python helper `probe_viewables_and_info(expr_checkers)` accepts a list of `(get_val_lambda, [(test_fn, info_fn), ...])` pairs and returns both type matches and info dicts in one call. This halves the number of round-trips (2 + M → 1 + 0).

**Python sketch (add to `common.py`):**
```python
def probe_viewables_and_info(expr_checkers):
    results = []
    for get_val, checker_pairs in expr_checkers:
        try:
            val = get_val()
        except Exception as e:
            results.append({"matches": [], "error": repr(e)})
            continue
        matches = []
        for test_fn, info_fn in checker_pairs:
            try:
                if test_fn(val):
                    matches.append(eval_into_value(lambda: info_fn(val)))
            except Exception:
                pass
        results.append({"matches": matches})
    return results
```

**Impact:** Eliminates one DAP evaluate round-trip per stop. A single DAP round-trip costs ~50-150ms depending on process/network. For M=0 watched expressions this saves one entire round-trip every stop.

**Cost:** New Python function in `common.py` + new TypeScript code builder + refactor of `retrieveInformation` call site.

**Edge cases:**
1. **Expression error isolation:** Current code evaluates watched expressions individually via `Promise.allSettled` so a syntax error in one doesn't block others. With merged eval, a broken expression crashes the entire call. Fix: keep watched expressions separate; only merge the *variable* batch.
2. **"All matches" semantics:** The original collects ALL matching viewables per variable (e.g., an ndarray can be both NumpyImage and NumpyTensor). The Python loop must not `break` on first match.
3. **Code string size:** 10 variables × 6 viewables generates inline checker lambdas per variable. At ~100 chars per checker pair, this is ~6 KB — well within DAP limits (64 KB practical cap).
4. **Setup dependency:** `probe_viewables_and_info` uses `eval_into_value` from `common.py`. Already injected. No new setup step.

**Assessment:** Clean improvement with clear correctness. Combines well with Alt-A (fewer lambdas per variable) and Alt-C (hits the Python cache instead of running checkers).

---

### Alt-C: Python-side result cache in the injected module (`poc-c-python-side-cache.py`)

**Observation:** The original plan proposes a TypeScript-side cache that needs `id(obj)` fetched from Python on each stop. This requires an extra Python eval call just to populate the cache key. A Python-side cache avoids this: the cache lookup happens inside the same Python eval that was going to run anyway.

**Idea:** Add a `_probe_cache` dict and `probe_cached()` function to `_python_view_image_mod`. Cache key is a composite fingerprint:

```python
key = (id(obj), type(obj).__name__, _shape_sig(obj))
```

where `_shape_sig` returns `tuple(obj.shape)` for ndarray/tensor or `(width, height, mode)` for PIL images. Invalidated via `clear_cache()` called on every `continued` event.

**Why composite key is safer than plain `id()` alone:**

| Collision scenario | `id()` alone | Composite key |
|---|---|---|
| GC reuse of same id | ✗ false hit | Need same type + shape too |
| Same variable, different object (same shape) | ✗ false hit | Need same id too |
| In-place mutation (shape unchanged) | ✓ correct hit (stale data) | Same — see below |

**The in-place mutation problem (Risk 1 from the original plan):** Both `id()` alone and the composite key have this issue. `img[:] = 0` doesn't change `id`, type, or shape. The cached info is "correct" (shape/dtype unchanged) — only the *pixel values* changed, but those aren't in the info dict. So for the purpose of the watch tree display (shape, dtype, type), the cache is NOT stale after in-place mutation. This risk is lower than originally assessed.

**Invalidation strategy:** Clear on `continued` (execution resumes). This means:
- Cache is cold at the start of every stop ← conservative, always correct
- Cache is warm within a single stop (e.g., hover + tree both hit cache) ← useful

Alternative: clear only on frame change (not on every continue). This enables cross-stop caching for stepping within the same function, but requires tracking frame identity from the TypeScript side.

**LRU eviction:** `OrderedDict` with max 512 entries. Trivial to implement.

**Cost:** ~50 lines of Python added to `common.py` + one `clear_cache()` exec call in `DebugAdapterTracker.ts` on `continued` event.

**Edge cases:**
1. `id()` reuse after GC + same type + same shape — near-impossible collision. No realistic path to a wrong result.
2. `_shape_sig` failing — if `obj.shape` raises, the key degrades to `(id, type, None)`. Still includes type name, substantially better than bare `id()`.
3. `clear_cache()` on `continued` is a fire-and-forget exec (execution is already resuming) — no latency impact.
4. Thread safety — Python GIL ensures dict operations are atomic; DAP serialises eval calls per thread.

**Assessment:** Stronger cache than the TypeScript-side approach (no extra round-trip for `id()` retrieval, no Task 1 needed). Recommended over the original Task 1-5 plan. Combine with Alt-B (single merged probe call) for maximum effect.

---

### Alt-D: DAP value-string diff for TypeScript-side invalidation (`poc-d-dac-value-diff.ts`)

**Observation:** The DAP `VariablesResponse` includes a `value` field for every variable — a human-readable string representation (`"array([1, 2, 3], dtype=uint8)"`). `DebugVariablesTracker` records the variable `name`, `type`, and `evaluateName` but not `value`. This is already available at zero cost.

**Idea:** Store `dacValue: string` in `TrackedVariable`. Between stops, diff the `dacValue` per variable. If unchanged → serve cached result from the previous stop. If changed → re-evaluate.

**This gives change detection without any Python eval.**

**Reliability analysis:**

The `dacValue` diff is a *sufficient condition for change* (if it changed, re-eval) but not a *reliable indicator of stability* (if it didn't change, it *might* still be stale). Specifically:
- debugpy often truncates long arrays: `"array([...], shape=(1000, 1000), dtype=float32)"` — shape info is visible in the truncation, making it reasonably stable
- For PIL images, the repr includes mode and size: `"<PIL.JpegImageFile image mode=RGB size=640x480 at 0x...>"` — the address changes every time, breaking this approach for PIL
- For Tensors: `"tensor([[1., 2.], [3., 4.]])"` — truncated for large tensors

**Assessment:** Unreliable as a standalone cache. Useful as a *pre-filter*: if `dacValue` changed, proactively clear the Alt-C Python cache entry before calling `probe_cached`. If unchanged, use Alt-C's cache. This avoids one round-trip when the Python-side cache entry can't be trusted. The PIL address issue means this is opt-in per viewable type.

---

### Alt-E: Progressive / lazy UI rendering (`poc-e-progressive-rendering.ts`)

**Observation:** The tree is completely cleared at the start of each `_update()` call and stays empty until all Python evals complete. With the 500ms debounce + Python eval time, the user sees a blank tree for up to 500-900ms after every debug stop.

**Idea:** Decouple "show variable names" from "show variable info":
1. On stop: immediately show variable names with a ⏳ placeholder (only one DAP round-trip needed — the `variables` request)
2. As Python eval completes: update individual tree items using VS Code's targeted `onDidChangeTreeData(item)` API (not a full tree refresh)

**Impact on perceived performance:**
| Event | Current | With progressive rendering |
|---|---|---|
| Debug stop | tree cleared → blank | names appear in ~100ms |
| Type eval done | still blank | placeholder labels update |
| Info eval done | tree populated | final labels shown |

This doesn't change eval count but dramatically changes the UX. The tree is never blank.

**Implementation cost:** Medium. Requires refactoring `WatchTreeProvider` to support stable `TreeItem` objects and per-item refresh. `CurrentPythonObjectsListData.clear()` pattern needs to change.

**Edge cases:**
1. User clicks a placeholder item — command must check for "ready" state before proceeding
2. Item flickering if tree is rebuilt between the placeholder and final phases — use stable item identity (same Map key)
3. Two rapid stops within 2s throttle — second stop can update placeholders from the first stop's result

**Assessment:** Pure UX improvement, orthogonal to all other alternatives. Can be implemented independently. High user-facing value with no correctness risk.

---

### Alt-F: Python-side MRO class type index (`poc-f-mro-type-index.py`)

**Observation:** Python's `type.__mro__` (Method Resolution Order) is a property of the *class*, not the instance. If we know that class `JpegImageFile` maps to `PillowImage`, we know every future `JpegImageFile` instance maps to `PillowImage` — permanently, without any per-instance type test.

**Idea:** A `_class_viewable_index` dict in `_python_view_image_mod` maps `cls → [matching viewable names]`. On first encounter of a class, run `issubclass(cls, TargetClass)` tests (not `isinstance`). Cache the result permanently (never invalidated — class hierarchies don't change).

**Two-level cache combining Alt-C and Alt-F:**
- **L1 (class level, permanent):** "Can class `ndarray` ever be NumpyTensor?" → yes. "Can class `Tensor` ever be PillowImage?" → no.
- **L2 (instance level, per-stop):** "What is the shape/dtype of this specific ndarray?" → re-evaluated when object changes (Alt-C).

**What the class index can determine permanently:**

| DAP type class | Rules out | Needs instance checks |
|---|---|---|
| `PIL.Image.Image` subclasses | All non-PIL viewables | No — always PillowImage |
| `plt.Figure` | All non-plot viewables | No — always PyplotFigure |
| `plt.Axes` subclasses | All non-plot viewables | No — always PyplotAxes |
| `plotly.BaseFigure` subclasses | All non-plot viewables | No — always PlotlyFigure |
| `np.ndarray` | TorchTensor, PIL, plots | Yes — NumpyImage vs NumpyTensor |
| `torch.Tensor` | ndarray, PIL, plots | Yes — shape checks still needed |

For PIL, Matplotlib, and Plotly objects, the class index alone is definitive — zero instance-level type tests needed.

**Cost:** ~40 lines of Python. Requires adding `isSubclassPythonCode: EvalCode<boolean>` variants to each `Viewable` (alongside the existing `testTypePythonCode`). Alternatively, the existing `testTypePythonCode` can be re-used with `type(obj)` passed as `obj`.

**Edge cases:**
1. Dynamic classes (created at runtime) — indexed normally on first encounter
2. Monkey-patching base classes — stale class index. Virtually impossible in practice
3. Two viewables competing for same base class (`ndarray` → NumpyImage AND NumpyTensor) — both are stored in the index; instance checks still needed for disambiguation

**Assessment:** Powerful complement to Alt-C. For PIL/Matplotlib/Plotly objects, eliminates type-test Python code entirely (even `probe_cached` doesn't need to run checkers, just the info function). For ndarray/Tensor, reduces the number of checkers needed at the instance level.

---

## Cross-alternative comparison

| Alternative | Python eval savings | TS complexity | Python complexity | Stale data risk | Independence |
|---|---|---|---|---|---|
| Original (TS-side cache with `id()`) | High (warm) | High | None | Medium | Standalone |
| **Alt-A** DAP type fast-path | Medium (eval payload size) | Low | None | None | ✓ Standalone |
| **Alt-B** Merged type+info eval | 1 round-trip saved | Medium | Low | None | ✓ Standalone |
| **Alt-C** Python-side cache | High (warm) | Low | Medium | Low (composite key) | ✓ Standalone |
| **Alt-D** DAP value diff | Low (pre-filter) | Low | None | High (PIL addresses) | Supplement only |
| **Alt-E** Progressive rendering | None (UX only) | Medium | None | None | ✓ Standalone |
| **Alt-F** MRO class index | High (for PIL/mpl/plotly) | None | Medium | None | Supplement to C |

---

## Revised Recommendation

The original plan (TypeScript-side cache keyed on `id()`) is valid but requires fetching `id()` from Python first (Task 1), adding complexity. A superior combination emerged from the exploration:

### Tier 1 — High value, low risk (implement first)

**Alt-A + Alt-B together:**
1. Add `candidateTypeNames` / `fastExclude` to each `Viewable` — reduces eval payload from N×M to k×M lambdas
2. Add `probe_viewables_and_info()` to `common.py` — merges 2 round-trips into 1
3. Result: every debug stop costs exactly **1 Python eval** (down from 2 + M), with a much smaller payload

**Alt-E (progressive rendering)** — orthogonal, can be PRed independently. High user-facing value.

### Tier 2 — Additional cache layer (implement after Tier 1)

**Alt-C (Python-side cache):**
- Warm steps cost near zero
- Simpler than the original plan (no TypeScript-side cache class, no `id()` retrieval)
- Combine with Alt-F (MRO class index) for permanent type detection for PIL/Matplotlib

**Alt-F (MRO class index):**
- Only needed if profiling shows type tests are still bottlenecking after Tier 1
- Implement as an enhancement to Alt-C, not standalone

### Tier 3 — Defer

**Alt-D (DAP value diff):** Low reliability for PIL objects. Defer unless Alt-C proves insufficient.

**Original Task 1-5 plan:** Superseded by Alt-C. Skip unless Python-side changes are undesirable.

### Revised Execution Order

```
Alt-A (candidateTypeNames on Viewables)  ← pure addition, zero risk
  ↓
Alt-B (probe_viewables_and_info)         ← small Python + TypeScript addition
  ↓
Alt-E (progressive rendering)            ← UX improvement, parallel PR possible
  ↓
Alt-C (Python-side cache + clear_cache)  ← warm-step optimization
  ↓
Alt-F (MRO class index)                  ← optional enhancement to C
```
