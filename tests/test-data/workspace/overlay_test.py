import numpy as np


def _circle_mask(size: int = 100, radius: int = 30) -> np.ndarray:
    """Boolean mask — True inside a circle centred at (size/2, size/2)."""
    cy, cx = size // 2, size // 2
    y, x = np.ogrid[:size, :size]
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2


def create_base_image() -> np.ndarray:
    """
    Single-channel (grayscale) 100×100 uint8 image.

    Background pixels have value 50; the interior of a circle of radius 30
    centred at (50, 50) has value 200.  The high-contrast boundary is what
    the Edges overlay mode is designed to highlight.

    Stored as a 2-D array so the viewer renders it as a grayscale image
    (R = G = B at every pixel).
    """
    img = np.full((100, 100), 50, dtype=np.uint8)
    img[_circle_mask()] = 200
    return img


def create_seg_mask() -> np.ndarray:
    """
    Binary segmentation derived from `base_image` by thresholding at 100.

    Label 0 = background (pixel value 50), label 1 = circle interior (200).
    The boundary between the two labels forms a clean circular edge that the
    "Edges" display option will render as a coloured ring.
    """
    base = create_base_image()
    return (base > 100).astype(np.uint8)


def main() -> None:
    base_image = create_base_image()
    seg_mask = create_seg_mask()

    # All variables are available at this breakpoint.
    breakpoint()

    print("Overlay test images created successfully")


if __name__ == "__main__":
    main()
