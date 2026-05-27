"""
POC C: Python-side result cache inside _python_view_image_mod

Rather than caching on the TypeScript side (which requires sending id() across
the DAP boundary each stop), cache entirely within the Python module that is
already injected into the debugged process.

Architecture
============

A single new Python function `probe_cached` is added to the module.  It accepts
a list of variable names as strings and resolves each one by looking up
`sys._getframe(N).f_locals` / `f_globals` at the correct call stack depth.

The cache key is a *composite fingerprint* that makes accidental hits after
GC reuse virtually impossible:

    key = (id(obj), type(obj).__name__, _shape_sig(obj))

where `_shape_sig` returns a lightweight (hashable) representation of the
object's shape/size if it has one — free for ndarrays, cheap for PIL images.

The cache stores the last-known (viewable_index_list, info_dict) for each key.
On a cache hit, no type tests or info calls are made; the cached result is
returned immediately.

Cache invalidation
==================
- **Explicit clear** — the TypeScript side sends `_python_view_image_mod.clear_cache()`
  on every `continued` event (execution resumed).  This is always safe: clearing
  on resume means the cache is valid only within a single pause.
- **Automatic size limit** — the cache is an OrderedDict with a max of 512 entries
  (LRU eviction).  Prevents unbounded growth in long sessions.

Why clear on `continued` rather than on `stopped`?
- We need the cache to survive *within* a single stop (i.e., if the same
  expression is evaluated twice — e.g., for the tree + a hover — it returns the
  cached result).
- Between stops, any variable *could* have changed.  Clearing on `continued`
  ensures the cache is always cold at the start of a new stop.
- This is semantically identical to "session-scoped with frame granularity" but
  simpler: one global clear per resume.

Variant: clear only on frame change
- If we can detect a frame change (different file/line), only invalidate
  variables whose frame_id changed.  More complex, marginally better hit rate.
  Not worth the complexity for v1.

Usage from TypeScript
=====================

Replace the two-round-trip pattern in PythonObjectsList.retrieveInformation:

    // BEFORE
    const viewables = await findExpressionsViewables(variables, session);
    const info = await retrieveInfoForViewables(viewables, session);

    // AFTER
    const result = await evaluateInPython(
        buildProbeCachedCode(variables),
        session
    );

The TypeScript side receives a flat JSON-compatible structure and no longer
needs to know about viewable ordering at the Python level — the Python side
holds the checker functions and returns a stable "viewable type name" string.
"""

from collections import OrderedDict
from typing import Any

# ──────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

_PROBE_CACHE: "OrderedDict[tuple, tuple]" = OrderedDict()
_PROBE_CACHE_MAX = 512


def _shape_sig(obj: Any) -> Any:
    """Lightweight, hashable shape signature. Returns None if unsupported."""
    try:
        s = obj.shape  # numpy / torch
        return tuple(s)
    except AttributeError:
        pass
    try:
        # PIL Image
        return (obj.width, obj.height, obj.mode)
    except AttributeError:
        pass
    return None


def _cache_key(obj: Any) -> tuple:
    return (id(obj), type(obj).__name__, _shape_sig(obj))


def _cache_get(key: tuple) -> "tuple | None":
    if key in _PROBE_CACHE:
        _PROBE_CACHE.move_to_end(key)
        return _PROBE_CACHE[key]
    return None


def _cache_set(key: tuple, value: tuple) -> None:
    _PROBE_CACHE[key] = value
    _PROBE_CACHE.move_to_end(key)
    while len(_PROBE_CACHE) > _PROBE_CACHE_MAX:
        _PROBE_CACHE.popitem(last=False)


def clear_cache() -> None:
    """Called by the TypeScript side on every `continued` DAP event."""
    _PROBE_CACHE.clear()


# ──────────────────────────────────────────────────────────────────────────────
# The main probe function
# ──────────────────────────────────────────────────────────────────────────────

def probe_cached(expr_checkers: list) -> list:
    """
    Parameters
    ----------
    expr_checkers : list of
        (get_val,  [(viewable_type_name, test_fn, info_fn), ...])

    Returns
    -------
    list of:
        {
            "cached": bool,
            "matches": [
                {"type": viewable_type_name, "info": info_dict_or_None}
            ]
        }
    for each entry in expr_checkers.  An empty "matches" list means "not viewable".
    """
    results = []
    for get_val, checker_triples in expr_checkers:
        try:
            val = get_val()
        except Exception as e:
            results.append({"cached": False, "matches": [], "error": repr(e)})
            continue

        key = _cache_key(val)
        cached = _cache_get(key)
        if cached is not None:
            results.append({"cached": True, "matches": cached})
            continue

        matches = []
        for type_name, test_fn, info_fn in checker_triples:
            try:
                if test_fn(val):
                    try:
                        info = info_fn(val)
                    except Exception as e:
                        info = {"error": repr(e)}
                    matches.append({"type": type_name, "info": info})
            except Exception:
                pass

        _cache_set(key, matches)
        results.append({"cached": False, "matches": matches})

    return results


# ──────────────────────────────────────────────────────────────────────────────
# TypeScript call-site sketch (pseudo-code)
# ──────────────────────────────────────────────────────────────────────────────
#
# function buildProbeCachedCode(expressions: string[]): EvalCodePython<...> {
#   const checkerTriples = allViewables.map(v =>
#     `("${v.type}", lambda _x: ${v.testTypePythonCode.evalCode('_x')}, lambda _x: ${v.infoPythonCode.evalCode('_x')})`
#   ).join(', ');
#
#   const perExpr = expressions.map(expr =>
#     `(lambda: ${expr}, [${checkerTriples}])`
#   ).join(', ');
#
#   return { pythonCode: `${PYTHON_MODULE_NAME}.probe_cached([${perExpr}])` };
# }
#
# // On `continued` DAP event (DebugAdapterTracker.ts):
# await execInPython(
#   { pythonCode: `${PYTHON_MODULE_NAME}.clear_cache()` },
#   session
# );
#
# ──────────────────────────────────────────────────────────────────────────────
# Edge cases
# ──────────────────────────────────────────────────────────────────────────────
#
# 1. id() reuse after GC
#    Python can reuse id() values once an object is collected.  The composite
#    key includes type(obj).__name__ and _shape_sig(obj).  For the colliding
#    object to produce a wrong cache hit, it would need:
#      - the same numeric id() (possible after GC)
#      - the same type name  (extremely unlikely for unrelated objects)
#      - the same shape      (even more unlikely)
#    In practice this combination is near-impossible in a debugging session.
#
# 2. In-place mutation (img[:] = 0)
#    id() and shape are unchanged; cache returns stale info (old dtype values
#    are typically still correct; shape cannot change in-place for ndarray).
#    For info fields that don't include data values (shape/dtype/type), staleness
#    is harmless.  If the user changes dtype in-place (rare), they need a manual
#    refresh.  This is the same limitation as the TypeScript-side cache.
#
# 3. Frame re-entry with same local names
#    Function foo() called twice.  First call: x = np.zeros((3,3)).
#    Second call: x = np.zeros((4,4)).  x has a different id() AND different
#    shape, so the key is different → cache miss → fresh evaluation.  Correct.
#
# 4. clear_cache() call cost
#    One additional DAP eval call on every `continued` event.  However,
#    `continued` is a fire-and-forget context (execution is resuming), so
#    latency is irrelevant.  Alternatively, call clear_cache() lazily at the
#    START of the next stop (before probe_cached) as part of the same eval.
#
# 5. Thread safety
#    Python's GIL ensures dict operations are atomic for single assignments.
#    OrderedDict operations are not atomic for multi-step operations (get +
#    move_to_end), but DAP evaluations are serialised by debugpy (one at a time
#    per thread).  No race conditions in practice.
#
# 6. Module not set up
#    If setupOkay=false, probe_cached is not available.  TypeScript side already
#    checks setupOkay before calling any Python eval.  No change needed.
#
# 7. Cache hit reporting
#    The "cached" flag in the response lets the TypeScript side log hit/miss
#    rates for performance analysis without exposing data.
#
# ──────────────────────────────────────────────────────────────────────────────
# Performance estimate
# ──────────────────────────────────────────────────────────────────────────────
#
# Cold (first stop or after clear_cache):
#   - Same as current: all type tests + info fetches run.
#   - Plus: cache writes (cheap dict operations).
#
# Warm (stepping within the same function, same objects):
#   - All variables: single dict lookup per variable.
#   - 0 Python type tests, 0 info function calls.
#   - 1 round-trip total (the probe_cached call itself).
#
# Example: 10 variables, 6 viewable types, 2 matching.
#   Cold:   1 round-trip, runs 10×6=60 type tests + 2 info calls.
#   Warm:   1 round-trip, runs 10 dict lookups only.
