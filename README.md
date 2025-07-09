# Simply View Image for Python Debugging

This extension offers a powerful and versatile solution for visualizing images, plots, and tensors during Python debugging. It is designed to enhance your debugging workflow with a rich set of features.

## Features

### Image Viewer

A built-in, enhanced image viewer with the following capabilities:

- **Image Values**: Display pixel values directly on the image. ![Image Values](readme-assets/values-example.png | width=400)
- **Heatmap**: Visualize images as heatmaps with customizable color maps. ![Heatmap](readme-assets/heatmap-example.png | width=400)
- **Segmentation**: View label images with color mapping (e.g., 0=black, 1=red, etc.). ![Segmentation](readme-assets/segmentation-example.png | width=400)

### Jupyter Notebook Support

Seamlessly view images directly within Jupyter notebooks.

### Expression Viewer

Evaluate and display images from Python expressions.

- **Note**: Executing expressions may have side effects.

### Plot Viewer

Visualize plots from various sources, including:

- `matplotlib.pyplot.Figure`
- `matplotlib.pyplot.Axis`
- Plotly Figures (requires saving backend, see [here](https://plotly.com/python/static-image-export)).

### Tensor Viewer

Inspect tensors from PyTorch and NumPy.

- `numpy.ndarray` is treated as a tensor if it has 4 channels or 3 channels but does not qualify as a single image. Requires `scikit-image`.

### Watch View

Monitor image, plot, or tensor variables and refresh the view at each breakpoint.

- Supports custom Python expressions (use with caution to avoid side effects).

### Additional Features

- Hover over image variables to view their shape.
- Open local image files (supports PNG, JPG, BMP, TIFF) in the viewer.
- Add colorbars to heatmap images with adjustable value clipping.
- Interactive Python cell support: Use the **Variables** tab and click the arrow next to a variable name to view the image.

## Settings

| Setting                  | Description                                                                                                                                                                                                                                                                                    | Default Value |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `svifpd.autoFetchImages` | Controls whether images are automatically fetched. <ul> <li><code>true</code>: Automatically fetch images at each step.</li> <li><code>false</code>: Fetch images only when the "Fetch Image" button is clicked.</li> <li><code>"pinned"</code>: Automatically fetch pinned images.</li> </ul> | `true`        |

## Q&A

### Memory Issues

**Problem**: Memory usage increases significantly when using the extension.

**Solution**: Enable the `restrictImageTypes` setting (default: `true`).

---

## Extension Links

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=elazarcoh.simply-view-image-for-python-debugging)
- [Open VSX Registry](https://open-vsx.org/extension/elazarcoh/simply-view-image-for-python-debugging)

## Acknowledgment

This extension builds upon the foundational work of [john-guo](https://github.com/john-guo/simply-view-image-for-python-opencv-debugging). While none of the original code remains, his project served as a valuable inspiration for this extension. Thank you, John!

## Development

### Prerequisites

- **Node.js**: Ensure you have Node.js installed.
- **Yarn**: Install Yarn as the package manager.
- **Rust**: Required for building the Rust components.

### Build Instructions

1. Install dependencies:
   ```bash
   yarn install
   ```
2. Build the project:
   ```bash
   yarn build
   ```
