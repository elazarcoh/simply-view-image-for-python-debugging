try:
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
            return pack_info_to_object(
                {"type": obj_type, "shape": shape, "dtype": dtype}
            )

        def save(path, img, *args, **kwargs):
            ...

        return is_pillow_image, info, save

    is_pillow_image, pillow_image_info, pillow_image_save = pillow()
except:
    pass