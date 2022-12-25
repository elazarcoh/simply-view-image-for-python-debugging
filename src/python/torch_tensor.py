try:
    import torch

    def torch_tensor():
        def is_torch_tensor(obj, restrict_types):
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
            obj_type = type(img).__name__
            try:
                shape = str(tuple(tensor.shape))
                dtype = str(tensor.dtype)
                return {"type": obj_type, "shape": shape, "dtype": dtype}
            except:
                return {"type": obj_type}

        def save(obj, path, normalize=True, pad=10, *args, **kwargs):
            import torchvision

            pad_value = 255
            torchvision.utils.save_image(
                obj,
                path,
                normalize=normalize,
                pad_value=pad_value,
                padding=pad,
            )

        return is_torch_tensor, info, save

    is_torch_tensor, torch_tensor_info, torch_tensor_save = torch_tensor()
except:
    pass