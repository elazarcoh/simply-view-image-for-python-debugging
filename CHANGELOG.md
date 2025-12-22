# Change Log

## [4.1.0] - 2025-12-22

### Added
- Edges mode (colorize like segmentation but only show edges).
- Overlay one image on another.

## [4.0.20] - Release - 2026-05-25

### Added

- Support for saving images directly from the webview
- Setting to control auto-run setup on debug start (`svifpd.autoRunSetupOnDebugStart`) with toggle buttons in the Image Watch view
- Setting to control whether images are automatically fetched (`svifpd.autoFetchImages`: `true` / `false` / `"pinned"`)
- Support for "non-restricted types": when `svifpd.restrictImageTypes` is set to `false`, the viewer also supports everything convertible to a numpy array (e.g. `tensorflow.Tensor`)
- Support for Interactive Python cells

### Fixed

- Fixed indexed-color PNG interpretation (now uses Jimp-expanded channels)
- Fixed preprocessing for single-channel images in save functions
- Fixed bug with numpy tensors not being sent correctly to the viewer
- Fixed bug with font loading in the image viewer
- Fixed bug with pinned images not being kept when switching debug sessions

### Security

- Bumped `lodash` to 4.18.1 (fixes GHSA-r5fr-rjxr-66jc high severity: code injection via `_.template`; GHSA-f23m-r3pf-42rh moderate severity: prototype pollution)
- Replaced deprecated `vscode-debugprotocol` with its renamed successor `@vscode/debugprotocol`
- Bumped transitive `ws` to 8.21.0 (fixes HIGH severity remote DoS via malformed headers)
- Bumped transitive `postcss` to 8.5.15 (fixes XSS via unescaped `</style>` in source maps, introduced in 8.5.10)
- Bumped transitive `basic-ftp` to 5.3.1 (fixes GHSA-rpmf-866q-6p89, GHSA-rp42-5vxx-qpwr, GHSA-6v7q-wjvx-w8wg, GHSA-chqc-8p9q-pq6q: path traversal and DoS)
- Bumped transitive `brace-expansion` to 1.1.14 (fixes GHSA-7h2j-956f-4vf2, GHSA-f886-m6hf-6m8v)
- Bumped transitive `fast-uri` to 3.1.2 (fixes GHSA-v39h-62p7-jpjc, GHSA-q3j6-qgpj-74h6)
- Bumped transitive `qs` to 6.15.2 (bug fixes)
- Bumped transitive `@tootallnate/once` to 2.0.1 (bug fix)

## [4.0.19] - Pre-release

### Added
- Support for saving images directly from the webview
- Setting to control auto-run setup on debug start (`svifpd.autoRunSetupOnDebugStart`)
- Toggle buttons for auto-run setup in Image Watch view

### Fixed
- Fixed indexed-color PNG interpretation (now uses Jimp-expanded channels)
- Preprocessing for single-channel images in save functions

## [4.0.17] - Pre-release

### Fixed
- Fixed bug with numpy tensors not being sent correctly to the viewer.
- Fixed bug with font loading in the image viewer.

## [4.0.15] - Pre-release

### Added
- Support for "non-restricted types" in the viewer.
  - If `svifpd.restrictImageTypes` is set to `false`, the viewer will now also support everything that is convertible to a numpy array (e.g., `tensorflow.Tensor` which is not supported by default).

## [4.0.13] - Pre-release

### Added

- Setting to control whether images are automatically fetched:
  - `svifpd.autoFetchImages`
    - Default: `true`
    - Possible values: `true`, `false`, `"pinned"`
    - If set to `true`, images are fetched automatically at each step.
    - If set to `false`, images are fetched only when the user clicks the "Fetch Image"
      button in the image viewer.
    - If set to `"pinned"`, pinned images are fetched automatically.

### Fixed
- Fixed bug with pinned images not being kept when switching debug sessions.

## [4.0.11] - Pre-release

### Added

- Support for Interactive Python cells

This required major refactoring, so I keep it as a pre-release for now.

## [4.0.10] - Release

### Added

- Support for torch tensor that has `requires_grad=True`.

## [4.0.9] - Pre-release

### Added 

- Open local files in the image viewer.
  - Supports: png, jpg, bmp, tiff.


## [4.0.8] - Release

### Added

- Colorbar for heatmap images.
  - Can be toggled via the toolbar.
  - Handles for clipping values.

## [4.0.6] - Release

### Added

- Support for value clipping via manual input.

## [4.0.5] - Pre-release

### Added 

- Support for tensors in the new image viewer.
- General improvements.

## [4.0.3] - Pre-release

### Added 

- Show user-friendly extension setup error message.
- Add errors for each module that failed to setup in the tree view.

## [4.0.1] - Pre-release

### Added

- Keyboard navigation in images list
- Pin images to top of list
- Legend for segmentation images

## [4.0.0] - Release

### Added

- Implement a new image viewer (see below 3.0.15-3.0.25)


## [3.0.25] - Pre-release

### Added

- Configuration to set the scroll direction for zooming in the image viewer. (`viewerUi.invertMouseWheelZoom`)


## [3.0.23] - Pre-release

### Fixed

- Fixed bug with random seed.


## [3.0.21] - Pre-release

### Fixed

- Fix error logging.


## [3.0.19] - Pre-release

### Fixed

- Register debug-adapters with the new `debugpy` type (`python` is deprecated). Fixes #82.

## [3.0.17] - Pre-release

### Fixed

- Check module either in globals or in locals (instead of only in globals).

## [3.0.15] - Pre-release

### Added

- New image viewer (only images for now)
  - Supports zooming and panning
  - Pixel values in status bar
  - Pixel value when zoomed in
  - Heatmap coloring
  - Segmentation coloring

- Communicate with python via sockets

## [3.0.13] - Patch

### Fixed

-   Various issues regarding setup-code.


## [3.0.12] - Patch

### Added

-   Convert to `float` when saving torch tensor.

## [3.0.9] - Pre-release

### Added

-   Hovering over an image variable will show it's shape.

### Fixed

-   Bug fix in watch view when debugger is not paused.

## [3.0.2] - Patch

-   Bug fix in tree-view refresh.

## [3.0.1] - Patch

-   Bug fix in expressions (syntax error).

## [3.0.0] - Release

### Added

-   Expressions in watch view

## [2.99.1] - Pre-release

-   Complete rewrite of the extension:
    -   More methodical (and faster) way to communicate with the debugger.
    -   Sets the grounds to allow other extensions to integrate with it.

### Added

-   Support expressions in watch view
-   Command palette commands for tracking variables and expressions

### Removed

-   Some configurations I deemed unnecessary (If you think they're needed, please open an issue describing your need for them):

    -   `imageWatch.enable`
    -   `imageWatch.objects`

    The reason for the removal is, that the Image Watch view became a major part of the extension.
    I don't see much reason to disable it.

## [2.3.1] - Release

### Added

-   Support for Plotly figures

## [2.3.0] - Release

### Added

-   Pre-release features (see below)

### Bug Fixes

-   Tensor save mutate the image. Now copy the image before saving.

## [2.2.11] - Pre-release

-   [#28](#28) - Add config to allow control of whether the view plot in debug variables is shown.
    `"svifpd.addViewContextEntryToVSCodeDebugVariables": true`

## [2.2.9] - Pre-release

### Added

-   [#17](#17) - Debug context menu view for plots.

## [2.1.5] - Pre-release

### Added

-   [#11](#11) - Support Jupyter notebooks

## [2.1.3] - Pre-release

### Bug Fixes

-   [#11](#11) - Fixes various bugs and improves performance to allow debug IPython cells.

## [2.1.1]

### Bug Fixes

-   using `/tmp` directory for multiple users.

## [2.1.0]

### Added

-   Support for numpy Tensors, via `skimage.util.montage`

## [2.0.4]

### Fixed

-   testing for pytorch tensor dimensions fix

## [2.0.3]

### Added

-   config: set matplotlib to use 'agg' backend (default to false)

## [2.0.0]

### Added

-   Image variables watch view, support tracking images (refresh at each step)

## [1.0.1]

### Added

-   Support for pytorch Tensors, via `torchvision.utils.save_image`
-   Support for global variables view (local variables take precedence).

## [1.0.0]

-   add support for matplotlib figure & axes preview

## [0.1.0]

### Changed

-   Command id `extension.viewimagepythondebug` to `svifpd.view-image`

## [0.0.6]

### Fixed

-   Multi-threading bug

## [0.0.5]

### Added

-   Configuration verification

## [0.0.4]

### Added

-   Extension icon

### Changed

-   Show view-image tooltip only if it's an image.

## [0.0.3]

### Added

-   backends: Stand-alone png saver. Only needs numpy.

## [0.0.2]

### Added

-   backends: Pillow, imageio

## [0.0.1]

### Added

-   Display image with no need for `import cv2`
-   Saving backends: skimage, cv2
-   Preprocess image before viewing

## fork

link for pre-forking changelog (up to version 0.6.0):
https://github.com/elazarcoh/simply-view-image-for-python-debugging/blob/forked-here/CHANGELOG.md
