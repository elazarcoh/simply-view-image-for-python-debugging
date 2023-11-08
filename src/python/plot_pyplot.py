def set_matplotlib_agg(to_set):
    if to_set:
        try:
            import matplotlib
            matplotlib.use('agg')
        except:
            pass

try:

    import matplotlib.pyplot as plt
    def pyplot_figure():
        def is_pyplot_figure(obj):
            try:
                return isinstance(obj, plt.Figure)
            except TypeError:
                return False

        def info(obj):
            obj_type = type(obj).__name__
            return {"type": obj_type}

        def save(path, fig, tight=False, dpi=150, *args, **kwargs):
            if fig is None:
                fig = plt.gcf()
            if tight:
                fig.tight_layout()
            fig.savefig(path, dpi=dpi)

        return is_pyplot_figure, info, save

    is_pyplot_figure, pyplot_figure_info, pyplot_figure_save = pyplot_figure()

    def pyplot_axes():
        def is_pyplot_ax(obj):
            try:
                return isinstance(obj, plt.Axes)
            except TypeError:
                return False

        def info(obj):
            obj_type = type(obj).__name__
            return {"type": obj_type}

        def save(path, ax, tight=False, dpi=150, *args, **kwargs):
            from matplotlib.transforms import Bbox

            fig = ax.figure
            if tight:
                fig.tight_layout()
            renderer = fig.canvas.get_renderer()
            items = []
            items += ax.get_xticklabels() + ax.get_yticklabels()
            items += [ax, ax.title]
            bbox = Bbox.union(
                [item.get_window_extent(renderer=renderer) for item in items]
            )
            extent = bbox.transformed(fig.dpi_scale_trans.inverted())
            fig.savefig(path, bbox_inches=extent, dpi=dpi)

        return is_pyplot_ax, info, save

    is_pyplot_ax, pyplot_ax_info, pyplot_ax_save = pyplot_axes()
except:
    pass
