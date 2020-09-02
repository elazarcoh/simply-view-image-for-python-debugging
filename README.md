# simply-view-image-for-python-debugging

Based on the great work of [john-guo](https://github.com/john-guo/simply-view-image-for-python-opencv-debugging), a more general version for the extenstion.

## New features

* No need for opencv (we support multiple backend)
* No include is needed by the user
* Support view image from expression
  
  ![Expression View](expression-example.gif)


## Dependencies

* python>=3.4
* At least one of the following packages needs to be installed:
  - [skimage](https://pypi.org/project/scikit-image/)
  - [opencv](https://pypi.org/project/opencv-python/)
  - [Pillow](https://pypi.org/project/Pillow/)
  - [imageio](https://pypi.org/project/imageio/)

## TODO
1. add no-backend option that uses: https://stackoverflow.com/a/19174800 (a pure python implementation)
1. (optionally) allow users to choose the preference order of the save backends
1. allow users to define custom preprocess
1. allow users to define custom save backend
