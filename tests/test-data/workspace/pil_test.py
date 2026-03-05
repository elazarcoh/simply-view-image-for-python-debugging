"""
Test file for PIL/Pillow image viewing.
Creates several PIL Image objects in different modes for testing.
"""
from PIL import Image
import numpy as np


def main():
    # Create a simple RGB PIL Image from numpy array
    rgb_array = np.zeros((64, 64, 3), dtype=np.uint8)
    rgb_array[:32, :, 0] = 255  # top half red
    rgb_array[32:, :, 2] = 255  # bottom half blue
    pil_rgb = Image.fromarray(rgb_array, mode="RGB")

    # Create a grayscale PIL Image
    gray_array = np.tile(np.linspace(0, 255, 64, dtype=np.uint8), (64, 1))
    pil_gray = Image.fromarray(gray_array, mode="L")

    # Create an RGBA PIL Image with alpha channel
    rgba_array = np.zeros((64, 64, 4), dtype=np.uint8)
    rgba_array[:, :, 0] = 200
    rgba_array[:, :, 1] = 100
    rgba_array[:, :, 3] = 128  # semi-transparent
    pil_rgba = Image.fromarray(rgba_array, mode="RGBA")

    breakpoint()

    print("PIL test completed")


if __name__ == "__main__":
    main()
