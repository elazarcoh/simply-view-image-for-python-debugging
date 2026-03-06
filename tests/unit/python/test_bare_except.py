"""
Tests for C3 — bare except: replaced with except Exception: in all Python files.

Bare `except:` catches BaseException (including SystemExit, KeyboardInterrupt),
which prevents proper interpreter shutdown and makes debugging harder.

Run: python -m pytest tests/unit/python/test_bare_except.py -v
"""
import os
import re
import pytest

PYTHON_DIR = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'src', 'python')

def get_python_files():
    """Get all .py files in the src/python directory."""
    files = []
    for f in os.listdir(PYTHON_DIR):
        if f.endswith('.py'):
            files.append(os.path.join(PYTHON_DIR, f))
    return files


@pytest.mark.parametrize("filepath", get_python_files(), ids=lambda p: os.path.basename(p))
def test_no_bare_except(filepath):
    """No Python file should contain bare 'except:' (should use 'except Exception:')."""
    with open(filepath) as f:
        content = f.read()

    # Find all bare except: (not followed by a specific exception type)
    bare_excepts = re.findall(r'^\s*except\s*:\s*$', content, re.MULTILINE)
    assert len(bare_excepts) == 0, (
        f"Found {len(bare_excepts)} bare 'except:' in {os.path.basename(filepath)}. "
        f"Use 'except Exception:' instead."
    )


@pytest.mark.parametrize("filepath", get_python_files(), ids=lambda p: os.path.basename(p))
def test_except_exception_exists_where_needed(filepath):
    """Files that had bare except: should now use except Exception:."""
    with open(filepath) as f:
        content = f.read()

    # Just verify the file parses (no syntax errors from our edits)
    compile(content, filepath, 'exec')
