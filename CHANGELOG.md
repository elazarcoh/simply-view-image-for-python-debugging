# Change Log

## [2.1.3] - Pre-release

### Bug Fixes
- [#11](#11) - Fixes various bugs and improves performance to allow debug IPython cells.

## [2.1.1]

### Bug Fixes
- using `/tmp` directory for multiple users.

## [2.1.0]

### Added
- Support for numpy Tensors, via `skimage.util.montage`

## [2.0.4]

### Fixed

- testing for pytorch tensor dimensions fix


## [2.0.3]

### Added

- config: set matplotlib to use 'agg' backend (default to false)


## [2.0.0]

### Added

- Image variables watch view, support tracking images (refresh at each step)


## [1.0.1]

### Added
- Support for pytorch Tensors, via `torchvision.utils.save_image`
- Support for global variables view (local variables take precedence).


## [1.0.0]

- add support for matplotlib figure & axes preview

## [0.1.0]

### Changed

- Command id `extension.viewimagepythondebug` to `svifpd.view-image`

## [0.0.6]

### Fixed 

- Multi-threading bug

## [0.0.5]

### Added

- Configuration verification

## [0.0.4]

### Added

- Extension icon

### Changed

- Show view-image tooltip only if it's an image.

## [0.0.3]

### Added

- backends: Stand-alone png saver. Only needs numpy.

## [0.0.2]

### Added

- backends: Pillow, imageio

## [0.0.1]

### Added

- Display image with no need fot `import cv2`
- Saving backends: skimage, cv2
- Preprocess image before viewing

## fork 

link for pre-forking changelog (up to version 0.6.0):
https://github.com/elazarcoh/simply-view-image-for-python-debugging/blob/forked-here/CHANGELOG.md
