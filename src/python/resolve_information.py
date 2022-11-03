
def safe_isinstance(obj, type_):
    try:
        return isinstance(obj, type_)
    except TypeError:
        return False

Image = 'image'
Plot = 'plot'
Tensor = 'tensor'

NumpyImage = "numpy_image"
PillowImage = "pillow_image"

PyPlotFigure = "pyplot_figure"
PyPlotAxes = "pyplot_axes"
PlotlyFigure = "plotly_figure"

TorchTensor = "torch_tensor"
NumpyTensor = "numpy_tensor"

Unknown = "unknown"

_check_object_registry = {}
_type_groups = {
    Image: [PillowImage, NumpyImage],
    Plot: [PyPlotFigure, PyPlotAxes, PlotlyFigure],
    Tensor: [TorchTensor, NumpyTensor]
}


try :
    import PIL
    import PIL.Image
    def is_pillow_image(img):
        return safe_isinstance(img, PIL.Image.Image)
    _check_object_registry[PillowImage] = is_pillow_image
except:
    pass

try:
    import numpy as np
    def is_numpy_image(img, restrict_types):
        if restrict_types:
            return safe_isinstance(img, np.ndarray)
        else:
            try:
                img = np.asarray(img)
                is_image = (img.ndim == 2) or (img.ndim == 3 and img.shape[2] in (1, 3, 4))
                return is_image
            except:
                return False
    _check_object_registry[NumpyImage] = is_numpy_image
except:
    pass

try:
    import matplotlib.pyplot as plt

    def is_pyplot_figure(obj):
        return safe_isinstance(obj, plt.Figure)
    _check_object_registry[PyPlotFigure] = is_pyplot_figure

    def is_pyplot_ax(obj):
        return safe_isinstance(obj, plt.Axes)
    _check_object_registry[PyPlotAxes] = is_pyplot_ax
except:
    pass

try:
    from plotly.basedatatypes import BaseFigure
    def is_plotly_figure(obj):
        return safe_isinstance(obj, BaseFigure)
    _check_object_registry[PlotlyFigure] = is_plotly_figure
except:
    pass

try:
    import torch
    def is_torch_tensor(obj):
        valid_channels = (1, 2, 3, 4)
        try:
            is_valid = safe_isinstance(obj, torch.Tensor)
            is_valid &= len(obj.shape) in (2, 3, 4)
            if len(obj.shape) == 2:
                pass
            elif len(obj.shape) == 3:
                is_valid &= obj.shape[0] in valid_channels
            elif len(obj.shape) == 4:
                is_valid &= obj.shape[1] in valid_channels
            return is_valid
        except:
            return False
    _check_object_registry[TorchTensor] = is_torch_tensor
except:
    pass

try:
    import numpy as np
    def is_numpy_tensor(obj):
        valid_channels = (1, 3, 4)
        try:
            is_valid = safe_isinstance(obj, np.ndarray)
            is_valid &= len(obj.shape) in (3, 4)
            if len(obj.shape) == 3:
                pass
            elif len(obj.shape) == 4:
                is_valid &= obj.shape[3] in valid_channels
            return is_valid
        except:
            return False
    _check_object_registry[NumpyTensor] = is_numpy_tensor
except:
    pass

def find_object_types(img, restrict_types):
    object_types = []
    for group, types in _type_groups.items():
        for type in types:
            if _check_object_registry[type](img, restrict_types):
                object_types.append((group, type))
    return object_types
