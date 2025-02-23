def tensorflow_tensor():
    def is_torch_tensor(obj):
        try:
            import tensorflow
        except ImportError:
            return False
        valid_channels = (1, 2, 3, 4)
        try:
            is_valid = tensorflow.is_tensor(obj)
            is_valid &= len(obj.shape) in (2, 3, 4)
            if len(obj.shape) == 2:
                pass
            elif len(obj.shape) == 3:
                is_valid &= obj.shape[0] in valid_channels
            elif len(obj.shape) == 4:
                is_valid &= obj.shape[3] in valid_channels or obj.shape[1] in valid_channels
            return is_valid
        except:
            return False

    def info(obj):
        obj_type = type(obj).__name__
        try:
            shape = str(tuple(obj.shape))
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

        try:
            skimage_version = skimage.__version__
            major, minor, *_ = skimage_version.split(".")
            major = int(major)
            minor = int(minor)
        except ValueError:
            raise ValueError("Invalid scikit-image version: %s" % skimage_version)

        obj = obj.numpy()

        # guess channel first or last
        actual_channel_axis = -1
        channel_axis_parameter = None

        if len(obj.shape) == 3:
            if obj.shape[2] in (1, 3):
                actual_channel_axis = 2
            elif obj.shape[0] in (1, 3):
                actual_channel_axis = 0

        elif len(obj.shape) == 4:
            if obj.shape[3] in (1, 3):
                actual_channel_axis = 3
                channel_axis_parameter = 3
            elif obj.shape[1] in (1, 3):
                actual_channel_axis = 1
                channel_axis_parameter = 1

        else:
            raise ValueError("Invalid shape: %s" % (obj.shape,))

        is_color = obj.shape[actual_channel_axis] in (3, 4)
        if is_color:
            pad_value = (1.0,) * obj.shape[actual_channel_axis]
        else:
            pad_value = 1.0

        kwargs = {}
        if minor >= 19:
            kwargs["channel_axis"] = channel_axis_parameter

        if minor <= 18:
            kwargs["multichannel"] = is_color

        montage = skimage.util.montage(
            obj.copy(),  # avoid modifying the input object
            fill=pad_value,
            rescale_intensity=normalize,
            padding_width=pad,
            **kwargs,
        )
        if montage.shape[-1] == 1:
            montage = montage[..., 0]
        skimage.io.imsave(path, img_as_ubyte(montage), check_contrast=False)

    return is_torch_tensor, info, save

is_tf_tensor, tf_tensor_info, tf_tensor_save = tensorflow_tensor()
