"""
POC F: Python-side MRO (Method Resolution Order) type index

Key insight
===========
Python's `type.__mro__` is a property of the CLASS, not the instance.
If we've already determined that class `JpegImageFile` maps to PillowImage,
we know every future `JpegImageFile` instance is also PillowImage — no test needed.

This is stronger than the DAP type name fast-path (POC A) because:
  - It handles all subclasses automatically without a hardcoded list.
  - The index is populated lazily on first encounter, then reused forever.
  - It lives inside the Python module (no round-trip to TypeScript).

Architecture
============
A dict `_class_viewable_cache` maps class objects → list of matching viewable names.
When a new class is first seen, we run the type tests once and cache the result.
On subsequent encounters of the same class (including subclasses), we return the
cached list immediately.

Key difference from POC C (Python-side object cache)
=====================================================
- POC C caches per *object instance* (keyed on id(obj)) — handles in-place mutation.
- POC F caches per *class* — handles all instances of the same class permanently.

These are complementary:
  POC F: "What viewable types match class ndarray?" → permanent, never invalidated
  POC C: "What is the current info for this specific ndarray?" → invalidated on resume

Combined: type detection is never re-run for a known class; info is re-run only
when the object changes (POC C) or on every stop (conservative mode).
"""

from typing import Any, Callable

# ──────────────────────────────────────────────────────────────────────────────
# Class-level type index (permanent)
# ──────────────────────────────────────────────────────────────────────────────

# Maps class object → tuple of (viewable_type_name, info_fn) for matching viewables
_class_viewable_index: "dict[type, list[tuple[str, Callable]]]" = {}


def _index_class(
    cls: type,
    checker_triples: list,  # [(type_name, test_fn, info_fn), ...]
) -> "list[tuple[str, Callable]]":
    """
    Run type tests for a class once and store the result permanently.
    Creates a fake instance-like object via cls.__new__ if possible, or
    tests using a sentinel approach.

    This is called only on first encounter of a class.
    """
    matching = []
    for type_name, test_fn, info_fn in checker_triples:
        try:
            if test_fn(cls):  # Pass the CLASS, not an instance — works for isinstance checks!
                # Actually: isinstance(cls(), SomeType) wouldn't work here.
                # We need a different approach: test_fn checks isinstance(obj, SomeType).
                # We can check: issubclass(cls, SomeType) instead.
                # This requires the type test to be refactored OR we use a canary instance.
                matching.append((type_name, info_fn))
        except Exception:
            pass
    return matching


def probe_with_class_index(expr_checkers: list) -> list:
    """
    Like probe_cached, but uses the class-level index for type detection.
    info_fn is still called per-object (info can vary per instance).

    expr_checkers: [(get_val, [(type_name, is_subclass_fn, info_fn), ...]), ...]
    where is_subclass_fn(cls) checks issubclass(cls, TargetClass) instead of
    isinstance(obj, TargetClass).
    """
    results = []
    for get_val, checker_triples in expr_checkers:
        try:
            val = get_val()
        except Exception as e:
            results.append({"matches": [], "error": repr(e)})
            continue

        cls = type(val)

        # Check class-level cache
        if cls not in _class_viewable_index:
            # First time seeing this class — run type tests via subclass check
            matching = []
            for type_name, is_subclass_fn, info_fn in checker_triples:
                try:
                    if is_subclass_fn(cls):
                        matching.append((type_name, info_fn))
                except Exception:
                    pass
            _class_viewable_index[cls] = matching

        class_matches = _class_viewable_index[cls]

        # For matching viewable types, fetch instance-specific info
        instance_results = []
        for type_name, info_fn in class_matches:
            try:
                info = info_fn(val)
                instance_results.append({"type": type_name, "info": info})
            except Exception as e:
                instance_results.append({"type": type_name, "info": None, "error": repr(e)})

        results.append({"matches": instance_results})

    return results


# ──────────────────────────────────────────────────────────────────────────────
# Adapting test functions from isinstance to issubclass
# ──────────────────────────────────────────────────────────────────────────────
#
# Current test functions use isinstance(obj, SomeClass).
# For the class index, we need issubclass(cls, SomeClass).
#
# Example transformation for is_numpy_image:
#
#   # Current:
#   def is_numpy_image(obj, restrict_types):
#       return isinstance(obj, np.ndarray)
#
#   # For class index:
#   def is_numpy_image_class(cls, restrict_types):
#       import numpy as np
#       return issubclass(cls, np.ndarray)
#
# This transformation is mechanical and can be automated for each viewable.
# However, some type tests have instance-level checks (shape, ndim) that
# require an actual object.  Those cannot use issubclass alone.
# Solution: two-phase test:
#   Phase 1 (class): issubclass check — determines if class is a CANDIDATE
#   Phase 2 (instance): original isinstance + shape checks — still needed for
#                        NumpyImage vs NumpyTensor disambiguation
#
# This means the class index gives us: "this class is never NumpyImage" (negative)
# but not "this class is always NumpyImage" (positive) without shape checks.
# For disambiguation, Phase 2 is still needed per-instance.

# ──────────────────────────────────────────────────────────────────────────────
# What the class index CAN determine permanently
# ──────────────────────────────────────────────────────────────────────────────
#
# Class               → Can determine             → Cannot determine
# ─────────────────────────────────────────────────────────────────
# np.ndarray          → NOT TorchTensor, NOT PIL  → NumpyImage vs NumpyTensor
# torch.Tensor        → NOT ndarray, NOT PIL       → Is it image-shaped?
# PIL.Image.Image     → NOT ndarray, NOT torch     → Always PillowImage ✓
# plt.Figure          → NOT ndarray, NOT torch     → Always PyplotFigure ✓
# plt.Axes            → NOT ndarray, NOT torch     → Always PyplotAxes ✓
# plotly.Figure       → NOT ndarray, NOT torch     → Always PlotlyFigure ✓
#
# For PIL.Image.Image subclasses, the class index alone is definitive.
# For ndarray and Tensor, shape checks still needed (but only 1-2 viewables
# to check instead of 6).
#
# ──────────────────────────────────────────────────────────────────────────────
# Edge cases
# ──────────────────────────────────────────────────────────────────────────────
#
# 1. Dynamic classes
#    Python allows creating classes at runtime.  These would get new entries in
#    _class_viewable_index normally — no issue.
#
# 2. Patching / monkey-patching base classes
#    If someone patches np.ndarray after setup, the cached result for ndarray
#    could be stale.  Virtually never happens in practice.
#
# 3. Memory: _class_viewable_index grows over time
#    In a typical debug session, only a handful of unique types are encountered.
#    Even in extreme cases, 1000 types × (viewable list overhead) is negligible.
#    No LRU needed.
#
# 4. Import order: checking issubclass(cls, np.ndarray) requires numpy to be
#    importable.  Already guaranteed by the viewable setup code.
#
# ──────────────────────────────────────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────────────────────────────────────
#
# POC F is best combined with POC C:
#   - POC F: never re-run type tests for a known class (permanent)
#   - POC C: don't re-run info fetch for an unchanged instance (session-scoped)
#
# Together they form a two-level cache:
#   L1 (class): type detection — permanent, never invalidated
#   L2 (instance): info fetch  — cleared on continued event
"""
