"""
Test file for tracking variables across breakpoints.
Has two breakpoints: one creates initial image, second modifies it.
This tests the auto-update / tracking feature.
"""
import numpy as np


def main():
    # First breakpoint: initial image (red square)
    img = np.zeros((64, 64, 3), dtype=np.uint8)
    img[:, :, 0] = 255  # all red
    counter = 1

    breakpoint()  # First breakpoint: img is red

    # Modify image to blue
    img[:, :, 0] = 0
    img[:, :, 2] = 255  # now blue
    counter = 2

    breakpoint()  # Second breakpoint: img is blue

    print(f"Tracking test completed, counter={counter}")


if __name__ == "__main__":
    main()
