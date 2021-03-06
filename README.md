# simply-view-image-for-python-debugging

Based on the great work of [john-guo](https://github.com/john-guo/simply-view-image-for-python-opencv-debugging), a more general version for the extension.

## Features

* Support view image from expression
  * **NOTE when using this feature, the expression is actually executed, so beware of side-effects**
  ![Expression View](expression-example.gif)
* Support plot (matplotlib) view
  * Currently supports:
    * matplotlib.pyplot.Figure
    * matplotlib.pyplot.Axis
  
  ![Plotting View](pyplot-example.gif)
* Support Tensor view (only pytorch, for now) 


## Feature-Requests

If you want me to add other debug-viewers for your objects, please open an issue for it, and provide simple example (in python, of course) of how to save an image from your object.

## Dependencies

* python>=3.4
