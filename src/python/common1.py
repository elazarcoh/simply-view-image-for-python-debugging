def catch_exception_to_object(func):
    def warper(*args, **kwargs):
        try:
            return f"Value({func(*args, **kwargs)})"
        except Exception as e:
            return f"Error({type(e).__name__},'{e}')"

    return warper


def pack_info_to_object(info):
    return info


def safe_isinstance(obj, type_):
    try:
        return isinstance(obj, type_)
    except TypeError:
        return False


handlers = {
    # Image: {PillowImage: {}, NumpyImage: {}},
    # Plot: {PyPlotFigure: {}, PyPlotAxes: {}, PlotlyFigure: {}},
    # Tensor: {TorchTensor: {}, NumpyTensor: {}},
}

def register(group, type, is_func, info_func, save_func):
    if group not in handlers:
        handlers[group] = {}
    if type not in handlers[group]:
        handlers[group][type] = {}
    handlers[group][type]["is"] = is_func
    handlers[group][type]["info"] = info_func
    handlers[group][type]["save"] = save_func

savers = {}


def save(expr, associated_type, *args, **kwargs):
    if associated_type in savers:
        return savers[associated_type](expr, *args, **kwargs)
    else:
        raise ValueError(f"Unknown type '{associated_type}'")
