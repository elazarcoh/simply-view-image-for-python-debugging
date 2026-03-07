"""
Tests for common.py sanitize() fix — escape quotes instead of stripping (R6).

Bug: sanitize() strips quotes entirely, causing data loss.
Fix: escape " as \" and \\ as \\\\ to preserve data.

Run: python -m pytest tests/unit/python/test_sanitize.py -v
"""
import importlib.util
import os


def _import_module(name, filename):
    path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'src', 'python', filename)
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def get_sanitize():
    """Import sanitize and stringify from common.py via importlib."""
    common = _import_module('common', 'common.py')
    return common.sanitize, common.stringify


class TestSanitize:
    def test_no_quotes_unchanged(self):
        sanitize, _ = get_sanitize()
        assert sanitize("hello world") == "hello world"

    def test_double_quotes_escaped(self):
        sanitize, _ = get_sanitize()
        result = sanitize('hello "world"')
        assert '\\"' in result, f"Expected escaped double quote, got: {result}"
        assert result == 'hello \\"world\\"'

    def test_backslash_escaped(self):
        sanitize, _ = get_sanitize()
        result = sanitize("path\\to\\file")
        assert "\\\\" in result, f"Expected escaped backslash, got: {result}"
        assert result == "path\\\\to\\\\file"

    def test_single_quotes_preserved(self):
        """Single quotes don't need escaping since stringify wraps in double quotes."""
        sanitize, _ = get_sanitize()
        result = sanitize("it's nice")
        assert "'" in result, f"Expected single quote preserved, got: {result}"

    def test_empty_string(self):
        sanitize, _ = get_sanitize()
        assert sanitize("") == ""

    def test_backslash_and_double_quote_combined(self):
        sanitize, _ = get_sanitize()
        result = sanitize('C:\\path "to"')
        assert result == 'C:\\\\path \\"to\\"'


class TestStringify:
    def test_string_roundtrip(self):
        """stringify should produce parseable output for strings with quotes."""
        _, stringify = get_sanitize()
        result = stringify('hello "world"')
        # Should be wrapped in double quotes with escaped inner quotes
        assert result.startswith('"'), f"Expected double-quote wrapper, got: {result}"
        assert result.endswith('"'), f"Expected double-quote wrapper, got: {result}"

    def test_value_error_passthrough(self):
        """Value(...) and Error(...) strings pass through without wrapping."""
        _, stringify = get_sanitize()
        assert stringify("Value(42)") == "Value(42)"
        assert stringify('Error("oops")') == 'Error("oops")'

    def test_dict_stringify(self):
        _, stringify = get_sanitize()
        result = stringify({"key": 42})
        assert '"key"' in result
        assert "42" in result


class TestSanitizeEmbedding:
    """
    Verify that sanitize() survives being embedded inside exec(\"\"\"...\"\"\").

    This is the actual bug: when common.py is injected into the debugged process,
    its code is wrapped in exec(\"\"\"...\"\"\") by execInPython(). If sanitize()
    uses backslash escapes like \"\\\\\" or \"\\\"\", Python processes them a second
    time as escape sequences inside the triple-double-quoted string, breaking the code.

    The fix uses chr(92) / chr(34) instead of literal escape sequences.
    """

    def test_survives_exec_triple_double_quote_embedding(self):
        """
        Simulate exec(\"\"\"${COMMON}\"\"\") as done in execInPython() / BuildPythonCode.ts.
        This must not raise a SyntaxError.
        """
        common_path = os.path.join(
            os.path.dirname(__file__), '..', '..', '..', 'src', 'python', 'common.py'
        )
        with open(common_path) as f:
            common_src = f.read()

        scope = {}
        exec('exec("""' + common_src + '""")', scope)
        sanitize = scope['sanitize']

        # Basic sanity checks after the embedded exec
        assert sanitize('') == ''
        assert sanitize('hello "world"') == 'hello \\"world\\"'
        assert sanitize('path\\to') == 'path\\\\to'
