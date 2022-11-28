try:
    import numpy as np

    def numpy():
        def is_numpy_image(img, restrict_types):
            if restrict_types:
                return safe_isinstance(img, np.ndarray)
            else:
                try:
                    img = np.asarray(img)
                    is_image = (img.ndim == 2) or (
                        img.ndim == 3 and img.shape[2] in (1, 3, 4)
                    )
                    return is_image
                except:
                    return False

        def info(img):
            obj_type = type(img).__name__
            img = np.asarray(img)
            shape = str(img.shape)
            dtype = str(img.dtype)
            return pack_info_to_object(
                {"type": obj_type, "shape": shape, "dtype": dtype}
            )

        def save(path, img, *args, **kwargs):
            ...

        return is_numpy_image, info, save

except:
    pass
