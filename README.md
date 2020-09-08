# simply-view-image-for-python-debugging

Based on the great work of [john-guo](https://github.com/john-guo/simply-view-image-for-python-opencv-debugging), a more general version for the extenstion.

## New features

* No need for opencv (we support multiple backend)
  * We also have a support of a pure-python implementation (depends only on **numpy**)
* No include is needed by the user
* Support view image from expression
  * **NOTE when using this feature, the expression is actullay executed, so beware of side-effects**
  ![Expression View](expression-example.gif)
  

## Dependencies

* python>=3.4
* At least one of the following packages needs to be installed:
  - [numpy](https://pypi.org/project/numpy/)
  - [skimage](https://pypi.org/project/scikit-image/)
  - [opencv](https://pypi.org/project/opencv-python/)
  - [Pillow](https://pypi.org/project/Pillow/)
  - [imageio](https://pypi.org/project/imageio/)

## TODO
1. (optionally) allow users to choose the preference order of the save backends
1. allow users to define custom preprocess
1. allow users to define custom save backend
