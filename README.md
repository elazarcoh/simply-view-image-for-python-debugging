# simply-view-image-for-python-debugging

Based on the great work of [john-guo](https://github.com/john-guo/simply-view-image-for-python-opencv-debugging), a more general version for the extension.

## Features

* Support in Jupyter notebooks
* Support view image from expression
  * **NOTE when using this feature, the expression is actually executed, so beware of side-effects**
  ![Expression View](expression-example.gif)
* Support plot (matplotlib, plotly) view
  * Currently supports:
    * matplotlib.pyplot.Figure
    * matplotlib.pyplot.Axis
    * plotly Figure (saving backend is needed, see [here](https://plotly.com/python/static-image-export))
  
  ![Plotting View](pyplot-example.gif)
* Support Tensor view: pytorch and numpy
  * `numpy.ndarray` is considered a tensor if it has 4 channels, or 3 channels but it does not pass as an single image. `scikit-image` is required for this.
* Hover over image variable to see the image shape (sometime it's not visible/easy to find in the general debug hover).

### Watch view

Added a watch view, for watching image/plot/tensor variables, while refreshing the image-view at each breakpoint.

* Support custom python expressions (again, beware of side-effects)

![Watch View](watch-view.png)

## Q & A

* **Memory blows-up when using the extension.**

  It might happen when (very) large, non-`numpy` array object, is being used.
  The solution to it is to set the `restrictImageTypes` setting to `true` (should be by default).

* **Selecting different call-stack frame does not work as expected.**
  
  Use the command: `Debug View Python: Update Frame ID`.

  Why:
  > I couldn't find a way to get the current frame, if it was changed by the user (again and again).
  > So, I've added a command to force VSCode "tell" me the current frame.
  > It's a bit hacky, but it works, I think.
