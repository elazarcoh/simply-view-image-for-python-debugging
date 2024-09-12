import torch

def torch_tensor():
    def is_torch_tensor(obj):
        try:
            import torch
        except ImportError:
            return False
        valid_channels = (1, 2, 3, 4)
        try:
            is_valid = isinstance(obj, torch.Tensor)
            is_valid &= len(obj.shape) in (2, 3, 4)
            if len(obj.shape) == 2:
                pass
            elif len(obj.shape) == 3:
                is_valid &= obj.shape[0] in valid_channels
            elif len(obj.shape) == 4:
                is_valid &= obj.shape[1] in valid_channels
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
        import torchvision

        pad_value = 255
        torchvision.utils.save_image(
            obj.float(),
            path,
            normalize=normalize,
            pad_value=pad_value,
            padding=pad,
        )

    return is_torch_tensor, info, save

is_torch_tensor, torch_tensor_info, torch_tensor_save = torch_tensor()
