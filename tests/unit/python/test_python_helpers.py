"""Comprehensive unit tests for Python helper functions (T3).

Tests common.py: sanitize, stringify, keyvalue, eval_into_value,
eval_or_return_exception, same_value_multiple_callables, object_shape_if_it_has_one.

Tests socket_client.py: chunk_header, message_chunks, generate_message_id,
is_64bit, check_can_fit_in_32bit, guess_image_dimensions, array_stats,
string_to_message, create_exception_message.
"""
import importlib.util
import os
import struct
import sys

import pytest

# -----------------------------------------------------------------------
# Import common.py and socket_client.py directly from source
# -----------------------------------------------------------------------

SRC = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'src', 'python')


def import_from_file(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


common = import_from_file('common', os.path.join(SRC, 'common.py'))


# ====================================================================
# common.py tests
# ====================================================================


class TestSanitize:
    def test_no_special_chars(self):
        assert common.sanitize('hello world') == 'hello world'

    def test_strips_single_quotes(self):
        assert common.sanitize("it's") == 'its'

    def test_strips_double_quotes(self):
        assert common.sanitize('say "hi"') == 'say hi'

    def test_strips_both_quotes(self):
        assert common.sanitize("""he said "it's fine" """) == 'he said its fine '

    def test_empty_string(self):
        assert common.sanitize('') == ''


class TestStringify:
    def test_integer(self):
        assert common.stringify(42) == '42'

    def test_float(self):
        assert common.stringify(3.14) == '3.14'

    def test_none(self):
        assert common.stringify(None) == 'None'

    def test_bool_true(self):
        assert common.stringify(True) == 'True'

    def test_bool_false(self):
        assert common.stringify(False) == 'False'

    def test_simple_string(self):
        assert common.stringify('hello') == '"hello"'

    def test_string_with_quotes_sanitized(self):
        result = common.stringify('say "hi"')
        assert result == '"say hi"'

    def test_empty_string(self):
        assert common.stringify('') == '""'

    def test_list(self):
        assert common.stringify([1, 2, 3]) == '[1,2,3]'

    def test_empty_list(self):
        assert common.stringify([]) == '[]'

    def test_nested_list(self):
        assert common.stringify([[1], [2]]) == '[[1],[2]]'

    def test_tuple(self):
        assert common.stringify((1, 2)) == '(1,2)'

    def test_empty_tuple(self):
        assert common.stringify(()) == '()'

    def test_dict(self):
        result = common.stringify({'a': 1})
        assert result == '{"a": 1}'

    def test_dict_with_string_value(self):
        result = common.stringify({'key': 'val'})
        assert result == '{"key": "val"}'

    def test_exception(self):
        result = common.stringify(ValueError('bad'))
        assert result == '"ValueError: bad"'

    def test_value_passthrough(self):
        assert common.stringify('Value(42)') == 'Value(42)'

    def test_error_passthrough(self):
        assert common.stringify('Error("fail")') == 'Error("fail")'

    def test_mixed_list(self):
        result = common.stringify([1, 'two', True, None])
        assert result == '[1,"two",True,None]'


class TestKeyvalue:
    def test_simple(self):
        result = common.keyvalue(('key', 'val'))
        assert result == '"key": "val"'

    def test_int_value(self):
        result = common.keyvalue(('x', 42))
        assert result == '"x": 42'


class TestEvalIntoValue:
    def test_success(self):
        result = common.eval_into_value(lambda: 42)
        assert result == 'Value(42)'

    def test_success_string(self):
        result = common.eval_into_value(lambda: 'hello')
        assert result == 'Value("hello")'

    def test_success_list(self):
        result = common.eval_into_value(lambda: [1, 2])
        assert result == 'Value([1,2])'

    def test_success_dict(self):
        result = common.eval_into_value(lambda: {'a': 1})
        assert result == 'Value({"a": 1})'

    def test_success_none(self):
        result = common.eval_into_value(lambda: None)
        assert result == 'Value(None)'

    def test_exception(self):
        def boom():
            raise ValueError('broke')
        result = common.eval_into_value(boom)
        assert result == 'Error("ValueError: broke")'


class TestEvalOrReturnException:
    def test_success(self):
        result = common.eval_or_return_exception(lambda: 42)
        assert result == 42

    def test_exception_returned(self):
        def boom():
            raise ValueError('bad')
        result = common.eval_or_return_exception(boom)
        assert isinstance(result, ValueError)
        assert str(result) == 'bad'


class TestSameValueMultipleCallables:
    def test_basic(self):
        results = common.same_value_multiple_callables(
            lambda: 10,
            [lambda v: v + 1, lambda v: v * 2],
        )
        assert results == ['Value(11)', 'Value(20)']

    def test_getter_fails(self):
        def bad_getter():
            raise RuntimeError('no')
        results = common.same_value_multiple_callables(
            bad_getter, [lambda v: v]
        )
        assert len(results) == 1
        assert results[0].startswith('Error(')

    def test_one_func_fails(self):
        def fail_func(v):
            raise ValueError('oops')
        results = common.same_value_multiple_callables(
            lambda: 10,
            [lambda v: v + 1, fail_func],
        )
        assert results[0] == 'Value(11)'
        assert results[1].startswith('Error(')


class TestObjectShapeIfItHasOne:
    def test_no_shape(self):
        assert common.object_shape_if_it_has_one(42) is None

    def test_with_shape_attribute(self):
        class Obj:
            shape = (3, 224, 224)
        result = common.object_shape_if_it_has_one(Obj())
        assert result == (3, 224, 224)

    def test_with_pillow_like(self):
        class FakeImage:
            width = 640
            height = 480
            def getbands(self):
                return ('R', 'G', 'B')
        result = common.object_shape_if_it_has_one(FakeImage())
        assert result == {'width': 640, 'height': 480, 'channels': 'RGB'}


# ====================================================================
# socket_client.py tests (functions that don't require numpy/torch)
# ====================================================================

# Only import if numpy is available
try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

# Import socket_client functions
if HAS_NUMPY:
    socket_client = import_from_file('socket_client', os.path.join(SRC, 'socket_client.py'))


@pytest.mark.skipif(not HAS_NUMPY, reason='numpy required')
class TestGenerateMessageId:
    def test_returns_int(self):
        mid = socket_client.generate_message_id()
        assert int(mid) == mid  # numpy uint32 is fine

    def test_within_range(self):
        for _ in range(100):
            mid = socket_client.generate_message_id()
            assert 0 <= mid < 2**32


@pytest.mark.skipif(not HAS_NUMPY, reason='numpy required')
class TestIs64bit:
    def test_float64(self):
        arr = np.zeros((2, 2), dtype=np.float64)
        assert socket_client.is_64bit(arr) is True

    def test_int64(self):
        arr = np.zeros((2, 2), dtype=np.int64)
        assert socket_client.is_64bit(arr) is True

    def test_float32(self):
        arr = np.zeros((2, 2), dtype=np.float32)
        assert socket_client.is_64bit(arr) is False

    def test_uint8(self):
        arr = np.zeros((2, 2), dtype=np.uint8)
        assert socket_client.is_64bit(arr) is False


@pytest.mark.skipif(not HAS_NUMPY, reason='numpy required')
class TestCheckCanFitIn32bit:
    def test_small_values_fit(self):
        arr = np.array([1.0, 2.0, 3.0], dtype=np.float64)
        assert bool(socket_client.check_can_fit_in_32bit(arr)) is True

    def test_large_values_dont_fit(self):
        arr = np.array([1e40], dtype=np.float64)
        assert bool(socket_client.check_can_fit_in_32bit(arr)) is False


@pytest.mark.skipif(not HAS_NUMPY, reason='numpy required')
class TestGuessImageDimensions:
    def test_hwc_3channel(self):
        img = np.zeros((480, 640, 3), dtype=np.uint8)
        result = socket_client.guess_image_dimensions(img)
        assert result['height'] == 480
        assert result['width'] == 640
        assert result['channels'] == 3

    def test_hw_grayscale(self):
        img = np.zeros((100, 200), dtype=np.uint8)
        result = socket_client.guess_image_dimensions(img)
        assert result['height'] == 100
        assert result['width'] == 200
        assert result['channels'] == 1


@pytest.mark.skipif(not HAS_NUMPY, reason='numpy required')
class TestArrayStats:
    def test_single_channel(self):
        arr = np.array([[0, 128, 255]], dtype=np.uint8)
        result = socket_client.array_stats(arr)
        assert isinstance(result, dict)
        assert 'min' in result
        assert 'max' in result


@pytest.mark.skipif(not HAS_NUMPY, reason='numpy required')
class TestStringToMessage:
    def test_returns_tuple(self):
        result = socket_client.string_to_message('hello')
        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_length_matches_string(self):
        result = socket_client.string_to_message('test')
        length, data = result
        assert int(length) == len('test')
        assert isinstance(data, bytes)


@pytest.mark.skipif(not HAS_NUMPY, reason='numpy required')
class TestCreateExceptionMessage:
    def test_returns_bytes(self):
        result = socket_client.create_exception_message(ValueError('test error'))
        assert isinstance(result, bytes)

    def test_contains_exception_marker(self):
        result = socket_client.create_exception_message(RuntimeError('boom'))
        assert result[0] == 0xFF  # ObjectType.Exception


@pytest.mark.skipif(not HAS_NUMPY, reason='numpy required')
class TestMessageChunks:
    def test_single_chunk_small_message(self):
        data = b'hello world'
        message_id = 42
        request_id = 100
        chunks = list(socket_client.message_chunks(len(data), message_id, request_id, data))
        assert len(chunks) >= 1
        # Each chunk should be bytes
        assert all(isinstance(c, bytes) for c in chunks)

    def test_large_message_produces_multiple_chunks(self):
        # CHUNK_SIZE is 4096 in socket_client.py
        data = b'x' * 10000
        message_id = 42
        request_id = 100
        chunks = list(socket_client.message_chunks(len(data), message_id, request_id, data))
        assert len(chunks) > 1, 'Large message should produce multiple chunks'

    def test_chunk_header_structure(self):
        """Each chunk starts with a 26-byte header."""
        data = b'test data'
        chunks = list(socket_client.message_chunks(len(data), 1, 1, data))
        for chunk in chunks:
            assert len(chunk) >= 26, 'Chunk must have at least header bytes'
