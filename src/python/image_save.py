import numpy as np

NumpyImage = "numpy_image"
PillowImage = "pillow_image"

def standalone_imsave(path, img):
    def preprocess_for_png(img):
        assert img.ndim >= 2 and img.ndim <= 3
        has_alpha = img.ndim == 3 and img.shape[2] == 4
        is_grayscale = img.ndim == 2 or (img.shape[2] == 1)

        while img.ndim < 3:
            img = img[..., None]
        
        if is_grayscale:
            img = np.concatenate((img, img, img), axis=2)
        if not has_alpha:
            mask = np.full((*img.shape[:2], 1), 0xFF)
            img = np.concatenate((img, mask), axis=2)

        return img.astype(np.ubyte)

    # https://gist.github.com/campagnola/0fb74586d38ea1a86e99
    def make_png(data):
        import numpy as np
        import zlib
        import struct

        assert data.dtype == np.ubyte
        assert data.ndim == 3
        assert data.shape[-1] == 4

        # www.libpng.org/pub/png/spec/1.2/PNG-Structure.html
        header = bytes.fromhex('89504e470d0a1a0a') # header

        def mkchunk(data, name):
            if isinstance(data, np.ndarray):
                size = data.nbytes
            else:
                size = len(data)
            chunk = np.empty(size + 12, dtype=np.ubyte)
            chunk.data[0:4] = struct.pack('!I', size)
            chunk.data[4:8] = name # b'CPXS' # critical, public, standard, safe
            chunk.data[8:8+size] = data
            chunk.data[-4:] = struct.pack('!I', zlib.crc32(chunk[4:-4]))
            return chunk

        # www.libpng.org/pub/png/spec/1.2/PNG-Chunks.html#C.IHDR
        ctyp = 0b0110  # alpha, color
        h, w = data.shape[:2]
        depth = data.itemsize * 8
        ihdr = struct.pack('!IIBBBBB', w, h, depth, ctyp, 0, 0, 0)
        c1 = mkchunk(ihdr, b'IHDR')

        # www.libpng.org/pub/png/spec/1.2/PNG-Chunks.html#C.IDAT
        idat = np.empty((h, w*4 + 1), dtype=np.ubyte) # insert filter byte at each scanline
        idat[:, 1:] = data.reshape(h, w*4)
        idat[:, 0] = 0
        c2 = mkchunk(zlib.compress(idat), b'IDAT')

        c3 = mkchunk(np.empty((0,), dtype=np.ubyte), b'IEND')

        # concatenate
        lh = len(header)
        png = np.empty(lh + c1.nbytes + c2.nbytes + c3.nbytes, dtype=np.ubyte)
        png.data[:lh] = header
        p = lh
        for chunk in (c1, c2, c3):
            png[p:p+len(chunk)] = chunk
            p += chunk.nbytes

        return png

    with open(path, 'wb')as fp:
        fp.write(make_png(preprocess_for_png(img)))

import importlib
def try_import(package):
    try:
        return importlib.import_module(package)
    except ImportError:
        return None

def prepare_image(img, preprocess_method='normalize'):
    import numpy as np
    img = np.array(img)
    if preprocess_method == 'skimage.img_as_ubyte':
        from skimage import img_as_ubyte
        try:
            return img_as_ubyte(img)
        except:
            return prepare_image(img)
    elif preprocess_method == 'normalize':
        if img.dtype in (bool, np.bool_):
            img = img.astype(np.uint8)
        else:
            img = img - img.min()
            img = img / img.max()
            img = img * 255
            img = img.astype(np.uint8)
        return img
    else:
        if img.dtype in (bool, np.bool_):
            img = img.astype(np.uint8)
        return img

def opencv_imsave(path, img):
    import cv2
    cv2.imwrite(path, img)

def skimage_imsave(path, img):
    import skimage.io
    skimage.io.imsave(path, img)

def imageio_imsave(path, img):
    import imageio
    imageio.imwrite(path, img)

def pillow_imsave(path, img):
    from PIL import Image
    img = Image.fromarray(img)
    img.save(path)

options = {
    'skimage': ('skimage.io', skimage_imsave),
    'opencv': ('cv2', opencv_imsave),
    'imageio': ('imageio', imageio_imsave),
    'Pillow' : ('PIL', pillow_imsave),
    'Standalone' : ('numpy', standalone_imsave)
}

def get_function(preferred=None):
    save_function = None
    
    if preferred is not None and preferred in options:
        module_test, function = options[preferred] 
        module = try_import(module_test)
        if module:
            return function
    
    for name, (module_test, function) in options.items():
        module = try_import(module_test)
        if module:
            save_function = function
            break
    return save_function

@catch_exception_to_object
def save_image(path, img, backend, preprocess):
    func = get_function(backend)
    img = prepare_image(img, preprocess)
    func(path, img)

savers[NumpyImage] = save_image
savers[PillowImage] = save_image
