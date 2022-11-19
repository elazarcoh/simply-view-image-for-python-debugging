
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
        def save(path, obj, *args, **kwargs):
            ...
        return is_pyplot_figure, info, save
    register("plot", "pyplot_figure", *pyplot_figure())

    def pyplot_axes():
        def is_pyplot_ax(obj, restrict_types):
            return safe_isinstance(obj, plt.Axes)
        def info(obj):
            obj_type = type(obj).__name__
            return pack_info_to_object({
                "type": obj_type
            })
        def save(path, obj, *args, **kwargs):
            ...
        return is_pyplot_ax, info, save
    register("plot", "pyplot_axes", *pyplot_axes())
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
        def save(path, obj, *args, **kwargs):
            ...
        return is_plotly_figure, info, save
    register("plot", "plotly_figure", *plotly_figure())
except:
    pass
