"""
Tests for P5 — reuse min/max from array_stats in 64→32bit conversion.

check_can_fit_in_32bit() recomputes np.min/np.max even though
array_stats() already computed them. For large arrays this doubles
the number of full-array scans.

Run: python -m pytest tests/unit/python/test_redundant_minmax.py -v
"""
import os
import sys
import struct
import numpy as np
import pytest

SOCKET_CLIENT_PATH = os.path.join(
    os.path.dirname(__file__), '..', '..', '..', 'src', 'python', 'socket_client.py'
)


def load_module():
    """Load socket_client.py into a namespace."""
    with open(SOCKET_CLIENT_PATH) as f:
        source = f.read()
    namespace = {}
    exec(compile(source, SOCKET_CLIENT_PATH, 'exec'), namespace)
    return namespace


@pytest.fixture
def mod():
    return load_module()


def test_check_can_fit_accepts_precomputed_minmax(mod):
    """check_can_fit_in_32bit should accept optional pre-computed min/max."""
    fn = mod['check_can_fit_in_32bit']
    arr = np.array([1, 2, 3], dtype=np.int64)
    # Should work with pre-computed values
    result = fn(arr, array_min=1, array_max=3)
    assert result is True


def test_check_can_fit_still_works_without_precomputed(mod):
    """check_can_fit_in_32bit should still work without pre-computed values."""
    fn = mod['check_can_fit_in_32bit']
    arr = np.array([1, 2, 3], dtype=np.int64)
    result = fn(arr)
    assert result == True


def test_check_can_fit_rejects_overflow(mod):
    """Values outside 32-bit range should be rejected."""
    fn = mod['check_can_fit_in_32bit']
    arr = np.array([2**40], dtype=np.int64)
    result = fn(arr)
    assert result == False


def test_check_can_fit_with_precomputed_overflow(mod):
    """Pre-computed values outside range should be rejected."""
    fn = mod['check_can_fit_in_32bit']
    arr = np.array([2**40], dtype=np.int64)
    result = fn(arr, array_min=0, array_max=2**40)
    assert result is False
