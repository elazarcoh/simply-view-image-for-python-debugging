# simply-view-image-for-python-debugging

Based on the great work of [john-guo](https://github.com/john-guo/simply-view-image-for-python-opencv-debugging), a more general version for the extenstion.

## New features

* No need for opencv (we support multiple backend)
* No include is needed by the user
* Support view image from expression

## Dependencies

* python>=3.4
* At least of the following packages are need to be installed:
  - opencv
  - skimage
  more to come

## TODO
1. allow users to choose default save backend
1. (optionally) allow users to choose the preference order of the save backends
1. allow users to choose preprocess method
1. allow users to define custom preprocess
1. (optionally) add standalone image save backend