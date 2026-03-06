"""Unit tests for image_numpy.py prepare_image() function.

Bug C1: When all pixels have the same value, `img - img.min()` produces
all zeros, then `img / img.max()` divides by zero. Numpy produces NaN
and a RuntimeWarning. The astype(uint8) silently converts NaN to 0.
"""
import numpy as np
import pytest
import os
import re
import textwrap
import warnings

_src_path = os.path.join(
    os.path.dirname(__file__), '..', '..', '..', 'src', 'python', 'image_numpy.py'
)


def _load_prepare_image():
    """Extract and compile the prepare_image function from source."""
    with open(_src_path) as f:
        source = f.read()
    match = re.search(
        r'(    def prepare_image\(.*?\n)(?=    def [a-z]|\n    options)',
        source,
        re.DOTALL,
    )
    assert match, "Could not find prepare_image in source"
    func_source = textwrap.dedent(match.group(0))
    ns = {}
    exec(func_source, ns)
    return ns['prepare_image']


class TestPrepareImageFixed:
    """Tests that must pass after the fix."""

    @pytest.fixture(autouse=True)
    def load_function(self):
        self.prepare_image = _load_prepare_image()

    def test_uniform_image_no_warning(self):
        """Uniform image should not produce RuntimeWarning."""
        img = np.full((10, 10, 3), 128, dtype=np.float32)
        with warnings.catch_warnings():
            warnings.simplefilter("error")
            result = self.prepare_image(img, "normalize")
        assert result.dtype == np.uint8
        assert np.all(result == 0)

    def test_zero_image_no_warning(self):
        """All-zero image should not produce RuntimeWarning."""
        img = np.zeros((10, 10), dtype=np.float32)
        with warnings.catch_warnings():
            warnings.simplefilter("error")
            result = self.prepare_image(img, "normalize")
        assert result.dtype == np.uint8
        assert np.all(result == 0)

    def test_single_value_grayscale_no_warning(self):
        """Single-value grayscale image should not warn."""
        img = np.full((20, 20), 42, dtype=np.float64)
        with warnings.catch_warnings():
            warnings.simplefilter("error")
            result = self.prepare_image(img, "normalize")
        assert result.dtype == np.uint8

    def test_normal_image_normalizes_correctly(self):
        """Normal image with varying values normalizes to [0, 255]."""
        img = np.array([[[0, 128, 255]]], dtype=np.float32)
        result = self.prepare_image(img, "normalize")
        assert result.dtype == np.uint8
        assert result.min() == 0
        assert result.max() == 255

    def test_two_value_image(self):
        """Image with exactly two values should normalize correctly."""
        img = np.zeros((10, 10), dtype=np.float32)
        img[5:, :] = 1.0
        result = self.prepare_image(img, "normalize")
        assert result.dtype == np.uint8
        assert result.min() == 0
        assert result.max() == 255

    def test_boolean_image(self):
        """Boolean images convert and normalize without warning."""
        img = np.array([[True, False], [False, True]])
        with warnings.catch_warnings():
            warnings.simplefilter("error")
            result = self.prepare_image(img, "normalize")
        assert result.dtype == np.uint8

    def test_channel_first_transposed(self):
        """CHW image should be transposed to HWC."""
        img = np.random.rand(3, 100, 200).astype(np.float32)
        result = self.prepare_image(img, "normalize")
        assert result.shape == (100, 200, 3)
        assert result.dtype == np.uint8

    def test_passthrough_mode(self):
        """Non-normalize mode returns image as-is."""
        img = np.full((10, 10), 42, dtype=np.uint8)
        result = self.prepare_image(img, "other_method")
        np.testing.assert_array_equal(result, img)

    def test_negative_values_normalize(self):
        """Image with negative values normalizes correctly."""
        img = np.array([[-1.0, 0.0, 1.0]], dtype=np.float32).reshape(1, 3, 1)
        result = self.prepare_image(img, "normalize")
        assert result.dtype == np.uint8
        assert result.min() == 0
        assert result.max() == 255
