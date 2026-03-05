"""
Comprehensive test file for numpy arrays of various dtypes and shapes.
Tests that the extension handles different array formats correctly.
"""
import numpy as np


def main():
    # Standard uint8 RGB image
    rgb_image = np.zeros((64, 64, 3), dtype=np.uint8)
    rgb_image[:, :32, 0] = 255  # left half red
    rgb_image[:, 32:, 1] = 255  # right half green

    # Grayscale float32 image (0-1 range)
    float_image = np.random.rand(64, 64).astype(np.float32)

    # Single-channel uint8
    gray_uint8 = np.linspace(0, 255, 64 * 64, dtype=np.uint8).reshape(64, 64)

    # Large image
    large_image = np.random.randint(0, 256, (256, 256, 3), dtype=np.uint8)

    # Expression test variables
    x = np.array([
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [255, 255, 255]
    ], dtype=np.uint8).reshape(2, 2, 3)

    breakpoint()

    print("Numpy test completed")


if __name__ == "__main__":
    main()
