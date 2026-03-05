"""
Test file for display options feature testing.
Creates various types of images that are designed to make display option effects clearly visible.
"""
import numpy as np


def create_rgb_gradient():
    """
    Create an RGB image with distinct color regions.
    Left third is red, middle third is green, right third is blue.
    This makes it easy to verify R/G/B channel filtering.
    """
    img = np.zeros((100, 150, 3), dtype=np.uint8)
    # Red region (left)
    img[:, :50, 0] = 255
    # Green region (middle)
    img[:, 50:100, 1] = 255
    # Blue region (right)
    img[:, 100:, 2] = 255
    return img


def create_grayscale_gradient():
    """
    Create a grayscale gradient from black to white.
    Good for testing high contrast and invert options.
    """
    gradient = np.linspace(0, 255, 200, dtype=np.uint8)
    img = np.tile(gradient, (100, 1))
    return img


def create_segmentation_image():
    """
    Create a segmentation mask with distinct integer labels.
    Uses values 0-5 to represent different segments.
    """
    img = np.zeros((100, 150), dtype=np.uint8)
    # Create 6 horizontal bands with different labels
    for i in range(6):
        img[i * 16:(i + 1) * 16, :] = i
    # Add some variety with vertical sections
    img[:, 75:100] = img[:, 75:100] + 3
    img = img % 6  # Keep values in 0-5 range
    return img


def create_heatmap_image():
    """
    Create a float32 image suitable for heatmap visualization.
    Uses a 2D Gaussian-like pattern with values from 0 to 1.
    """
    x = np.linspace(-2, 2, 150)
    y = np.linspace(-2, 2, 100)
    X, Y = np.meshgrid(x, y)
    img = np.exp(-(X**2 + Y**2) / 2).astype(np.float32)
    return img


def create_rgba_image():
    """
    Create an RGBA image with a checkerboard alpha pattern.
    Good for testing ignore alpha option.
    """
    img = np.zeros((100, 100, 4), dtype=np.uint8)
    # Fill with a gradient color
    img[:, :, 0] = 200  # Red
    img[:, :, 1] = 100  # Green
    img[:, :, 2] = 50   # Blue
    # Create checkerboard alpha pattern
    for i in range(10):
        for j in range(10):
            if (i + j) % 2 == 0:
                img[i*10:(i+1)*10, j*10:(j+1)*10, 3] = 255
            else:
                img[i*10:(i+1)*10, j*10:(j+1)*10, 3] = 128
    return img


def create_bgr_test_image():
    """
    Create an image where BGR vs RGB swap is clearly visible.
    Creates cyan on one side (should become red-ish when swapped)
    and red on the other (should become cyan when swapped).
    """
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    # Left half: Cyan (G+B) - will become Yellow (R+G) when BGR swapped
    img[:, :50, 1] = 255
    img[:, :50, 2] = 255
    # Right half: Red - will become Blue when BGR swapped
    img[: , 50:, 0] = 255
    return img


def create_high_contrast_test():
    """
    Create a low contrast grayscale image.
    Values range from 100-155 to test high contrast enhancement.
    """
    gradient = np.linspace(100, 155, 200, dtype=np.uint8)
    img = np.tile(gradient, (100, 1))
    return img


def main():
    # Create all test images
    rgb_gradient = create_rgb_gradient()
    grayscale = create_grayscale_gradient()
    segmentation = create_segmentation_image()
    heatmap = create_heatmap_image()
    rgba = create_rgba_image()
    bgr_test = create_bgr_test_image()
    low_contrast = create_high_contrast_test()

    # Breakpoint for testing - all images are available here
    breakpoint()

    print("Display options test images created successfully")


if __name__ == "__main__":
    main()
