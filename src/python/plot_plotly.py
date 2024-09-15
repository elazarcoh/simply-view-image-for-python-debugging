import plotly

def plotly_figure():
    def is_plotly_figure(obj):
        try:
            from plotly.basedatatypes import BaseFigure
        except ImportError:
            return False
        try:
            return isinstance(obj, BaseFigure)
        except TypeError:
            return False

    def info(obj):
        obj_type = type(obj).__name__
        return {"type": obj_type}

    def save(path, fig, *args, **kwargs):
        fig.write_image(path)

    return is_plotly_figure, info, save

is_plotly_figure, plotly_figure_info, plotly_figure_save = plotly_figure()
