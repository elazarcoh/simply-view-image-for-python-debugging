import numpy as np

def numpy_tensor():
    def is_numpy_tensor(obj):
        try:
            import numpy as np
        except ImportError:
            return False
        valid_channels = (1, 3, 4)
        try:
            is_valid = isinstance(obj, np.ndarray)
            is_valid &= len(obj.shape) in (3, 4)
            if len(obj.shape) == 3:
                pass
            elif len(obj.shape) == 4:
                is_valid &= obj.shape[3] in valid_channels
            return is_valid

        except TypeError:
            return False

    def info(obj):
        import numpy as np
        obj_type = type(obj).__name__
        try:
            obj = np.asarray(obj)
            shape = str(obj.shape)
            dtype = str(obj.dtype)
            return {"type": obj_type, "shape": shape, "dtype": dtype}
        except:
            return {"type": obj_type}

    def save(path, obj, normalize=True, pad=10, *args, **kwargs):
        try:
            import skimage.util
            import skimage.io
            from skimage import img_as_ubyte
        except ImportError:
            raise ImportError("scikit-image is required for saving numpy tensors")
        is_color = obj.ndim == 4
        if is_color:
            pad_value = (1.0,) * obj.shape[-1]
        else:
            pad_value = 1.0
        montage = skimage.util.montage(
            obj.copy(),  # avoid modifying the input object
            fill=pad_value,
            rescale_intensity=normalize,
            padding_width=pad,
            multichannel=is_color,
        )
        skimage.io.imsave(path, img_as_ubyte(montage), check_contrast=False)

    return is_numpy_tensor, info, save

is_numpy_tensor, numpy_tensor_info, numpy_tensor_save = numpy_tensor()
