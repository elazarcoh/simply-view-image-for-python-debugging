try:
    import numpy as np
    import PIL
    import PIL.Image

    def pillow():
        def is_pillow_image(img):
            try:
                return isinstance(img, PIL.Image.Image)
            except TypeError:
                return False

        def info(img):
            obj_type = type(img).__name__
            try:
                img = np.asarray(img)
                shape = str(img.shape)
                dtype = str(img.dtype)
                return {"type": obj_type, "shape": shape, "dtype": dtype}
            except:
                return {"type": obj_type}

        def save(path, img, *args, **kwargs):
            from PIL import Image
            img.save(path)

        return is_pillow_image, info, save

    is_pillow_image, pillow_image_info, pillow_image_save = pillow()
except Exception as e:
    def is_pillow_image(img):
        return False
    _image_pillow_error = e
    pass