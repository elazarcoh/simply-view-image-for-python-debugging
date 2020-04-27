# simply-view-image-for-python-opencv-debugging README

## Features

This simple extension can and **only** can let you view the image of a variable when you are debugging **python** codes with **opencv**.

Currently, It's only support python with opencv module *(opencv-python)* debugging.

There is a limition that's your python codes must import opencv as cv2.

For example:

    import cv2

## Requirements

Python debugger extension for vscode (vscode Microsoft official python extension recommend)

Python module of OpenCV support **imwrite** function installed (official module *opencv-python* recommend)

## How to use

Due to vscode do not allow extension customizes hover when you are debugging so that this extension use the code action command to open a new editor to view the image.

### Step

1. Open a python file which has "import cv2".

2. Start Debug

3. Break on a certain line

4. Click a variable that contains image data and waiting for the code action icon (a little yellow light bubble) popup.

5. Click the icon or press ctrl+. to popup a menu then click the menu to view image.

![How to use](usage.gif)

## Extension Settings

No settings, the initail version is hardcode.

## Limitations

The initail version is hardcode so there are some limitations:

1. Only work on python debugging with opencv module.

2. The python opencv module **must** support imwrite("filename to save", image_variable) function.

3. The python file **must** import opencv module as cv2 such as "import cv2".

4. The extension use imwrite to save the temporary image file.

5. The temporary directory is hardcode.

6. The temporary image file type is png.

7. The temporary image files are removed on extension activation not deactivation.

8. Unsupport variable tracking while debugging so the image cannot be refreshed automatically. You must click the variable again to refresh.

## Release Notes

### 0.0.2
Thanks to [marisancans](https://github.com/marisancans) add support for float np array. Notice it's a hardcode workaround.

### 0.0.1

Initial release

**Enjoy!**
