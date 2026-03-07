"""
Tests for R1 — torchvision ImportError handling in torch_tensor.py save().

The save() function does `import torchvision` without error handling.
If torchvision is not installed, the user gets a cryptic ImportError.

Run: python -m pytest tests/unit/python/test_torchvision_import.py -v
"""
import os
import re
import sys
import textwrap
import types
import pytest

TORCH_TENSOR_PATH = os.path.join(
    os.path.dirname(__file__), '..', '..', '..', 'src', 'python', 'torch_tensor.py'
)


def get_save_function_source():
    """Extract the save() function from torch_tensor.py."""
    with open(TORCH_TENSOR_PATH) as f:
        source = f.read()
    # Extract the save function
    match = re.search(
        r'(    def save\(.*?\n)(?=    return )',
        source,
        re.DOTALL,
    )
    assert match is not None, "Could not find save() function"
    return textwrap.dedent(match.group(0))


def test_save_has_torchvision_import_guard():
    """The save function should handle torchvision ImportError gracefully."""
    source = get_save_function_source()
    # Check that there's an except clause related to the torchvision import
    assert 'ImportError' in source or 'ModuleNotFoundError' in source, (
        "save() should handle ImportError for torchvision. "
        "Current source:\n" + source
    )


def test_save_raises_clear_error_without_torchvision():
    """When torchvision is not available, save() should raise a clear RuntimeError."""
    source = get_save_function_source()

    # Create a namespace without torchvision
    namespace = {}
    exec(compile(source, '<test>', 'exec'), namespace)
    save_fn = namespace['save']

    # Mock: temporarily make torchvision unimportable
    original_import = __builtins__.__import__ if hasattr(__builtins__, '__import__') else __import__

    def mock_import(name, *args, **kwargs):
        if name == 'torchvision':
            raise ImportError("No module named 'torchvision'")
        return original_import(name, *args, **kwargs)

    import builtins
    old = builtins.__import__
    builtins.__import__ = mock_import
    try:
        with pytest.raises(RuntimeError, match="torchvision"):
            save_fn("/tmp/test.png", None)
    finally:
        builtins.__import__ = old
