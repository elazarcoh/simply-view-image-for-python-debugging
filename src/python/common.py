def catch_exception_to_object(func):
    def warper(*args, **kwargs):
        try:
            return f"Value({func(*args, **kwargs)})"
        except Exception as e:
            return f"Error({type(e).__name__},'{e}')"

    return warper

def pack_info_to_object(info):
    return info

Image = "image"
Plot = "plot"
Tensor = "tensor"

NumpyImage = "numpy_image"
PillowImage = "pillow_image"

PyPlotFigure = "pyplot_figure"
PyPlotAxes = "pyplot_axes"
PlotlyFigure = "plotly_figure"

TorchTensor = "torch_tensor"
NumpyTensor = "numpy_tensor"

Unknown = "unknown"

savers = {}

def save(expr, associated_type, *args, **kwargs):
    if associated_type in savers:
        return savers[associated_type](expr, *args, **kwargs)
    else:
        raise ValueError(f"Unknown type '{associated_type}'")
