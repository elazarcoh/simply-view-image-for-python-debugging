
def safe_isinstance(obj, type_):
    try:
        return isinstance(obj, type_)
    except TypeError:
        return False


_object_handlers_registry = {}
_type_groups = {
    Image: [PillowImage, NumpyImage],
    Plot: [PyPlotFigure, PyPlotAxes, PlotlyFigure],
    Tensor: [TorchTensor, NumpyTensor]
}


try :
    import numpy as np
    import PIL
    import PIL.Image
    def pillow():
        def is_pillow_image(img, restrict_types):
            return safe_isinstance(img, PIL.Image.Image)
        def info(img):
            obj_type = type(img).__name__
            img = np.asarray(img)
            shape = str(img.shape)
            dtype = str(img.dtype)
            return pack_info_to_object({
                "type": obj_type,
                "shape": shape,
                "dtype": dtype
            })
        return is_pillow_image, info

    _object_handlers_registry[PillowImage] = pillow()
except:
    pass

try:
    import numpy as np
    def numpy():
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
        def info(img):
            obj_type = type(img).__name__
            img = np.asarray(img)
            shape = str(img.shape)
            dtype = str(img.dtype)
            return pack_info_to_object({
                "type": obj_type,
                "shape": shape,
                "dtype": dtype
            })
        return is_numpy_image, info
    _object_handlers_registry[NumpyImage] = numpy()
except:
    pass

try:
    import matplotlib.pyplot as plt
    def pyplot_figure():
        def is_pyplot_figure(obj, restrict_types):
            return safe_isinstance(obj, plt.Figure)
        def info(obj):
            obj_type = type(obj).__name__
            return pack_info_to_object({
                "type": obj_type
            })
        return is_pyplot_figure, info
    _object_handlers_registry[PyPlotFigure] = pyplot_figure()

    def pyplot_axes():
        def is_pyplot_ax(obj, restrict_types):
            return safe_isinstance(obj, plt.Axes)
        def info(obj):
            obj_type = type(obj).__name__
            return pack_info_to_object({
                "type": obj_type
            })
        return is_pyplot_ax, info
    _object_handlers_registry[PyPlotAxes] = pyplot_axes()
except:
    pass

try:
    from plotly.basedatatypes import BaseFigure
    def plotly_figure():
        def is_plotly_figure(obj, restrict_types):
            return safe_isinstance(obj, BaseFigure)
        def info(obj):
            obj_type = type(obj).__name__
            return pack_info_to_object({
                "type": obj_type
            })
        return is_plotly_figure, info
    _object_handlers_registry[PlotlyFigure] = plotly_figure()
except:
    pass

try:
    import torch
    def torch_tensor():
        def is_torch_tensor(obj, restrict_types):
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
        def info(obj):
            obj_type = type(obj).__name__
            shape = str(tuple(tensor.shape))
            dtype = str(tensor.dtype)
            return pack_info_to_object({
                "type": obj_type,
                "shape": shape,
                "dtype": dtype
            })
        return is_torch_tensor, info
    _object_handlers_registry[TorchTensor] = torch_tensor()
except:
    pass

try:
    import numpy as np
    def numpy_tensor():
        def is_numpy_tensor(obj, restrict_types):
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
        def info(obj):
            obj_type = type(obj).__name__
            shape = str(tuple(obj.shape))
            dtype = str(obj.dtype)
            return pack_info_to_object({
                "type": obj_type,
                "shape": shape,
                "dtype": dtype
            })
        return is_numpy_tensor, info
    _object_handlers_registry[NumpyTensor] = numpy_tensor()
except:
    pass

@catch_exception_to_object
def find_object_types(img, restrict_types):
    object_types = []
    info_funcs = []
    for group, types in _type_groups.items():
        for type in types:
            if type in _object_handlers_registry:
                is_type, info = _object_handlers_registry[type]
                if is_type(img, restrict_types):
                    object_types.append((group, type))
                    info_funcs.append(info)
                    break
    if len(info_funcs) == 0:
        return object_types, pack_info_to_object({})
    else:
        info = info_funcs[0](img)
        return object_types, info
