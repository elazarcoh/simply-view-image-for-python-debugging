# simply-view-image-for-python-debugging

Based on the great work of [john-guo](https://github.com/john-guo/simply-view-image-for-python-opencv-debugging), a more general version for the extension.

## features

* Support view image from expression
  * **NOTE when using this feature, the expression is actually executed, so beware of side-effects**
  ![Expression View](expression-example.gif)
* Support plot (matplotlib) view
  * Currently supports:
    * matplotlib.pyplot.Figure
    * matplotlib.pyplot.Axis
  
  ![Plotting View](pyplot-example.gif)

## Dependencies

* python>=3.4
* At least one of the following packages needs to be installed:
  - [numpy](https://pypi.org/project/numpy/)
  - [skimage](https://pypi.org/project/scikit-image/)
  - [opencv](https://pypi.org/project/opencv-python/)
  - [Pillow](https://pypi.org/project/Pillow/)
  - [imageio](https://pypi.org/project/imageio/)
