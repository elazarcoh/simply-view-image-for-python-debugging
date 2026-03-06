# P7: Cache Viewable Info Between Debug Stops — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce Python evaluation overhead per debug stop by caching viewable type detection and metadata info results.

**Architecture:** Add a per-session cache layer in `DebugSessionData` that stores viewable type mappings and object metadata. Cache keys include variable names and Python `id()` references. The cache is invalidated on frame change, session end, or when object identity changes.

**Tech Stack:** TypeScript, VS Code Debug Adapter Protocol, existing `ts-results` pattern.

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
