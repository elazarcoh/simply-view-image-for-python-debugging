
try:
    import torch
    def torch_tensor():
        def is_torch_tensor(obj, restrict_types):
            valid_channels = (1, 2, 3, 4)
            try:
                is_valid = safe_isinstance(obj, torch.Tensor)
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
            shape = str(tuple(tensor.shape))
            dtype = str(tensor.dtype)
            return pack_info_to_object({
                "type": obj_type,
                "shape": shape,
                "dtype": dtype
            })
        def save(obj, path, *args, **kwargs):
            ...
        return is_torch_tensor, info, save
    register("tensor", "torch_tensor", *torch_tensor())
except:
    pass

try:
    import numpy as np
    def numpy_tensor():
        def is_numpy_tensor(obj, restrict_types):
            valid_channels = (1, 3, 4)
            try:
                is_valid = safe_isinstance(obj, np.ndarray)
                is_valid &= len(obj.shape) in (3, 4)
                if len(obj.shape) == 3:
                    pass
                elif len(obj.shape) == 4:
                    is_valid &= obj.shape[3] in valid_channels
                return is_valid
            except:
                return False
        def info(obj):
            obj_type = type(obj).__name__
            shape = str(tuple(obj.shape))
            dtype = str(obj.dtype)
            return pack_info_to_object({
                "type": obj_type,
                "shape": shape,
                "dtype": dtype
            })
        def save(obj, path, *args, **kwargs):
            ...
        return is_numpy_tensor, info, save
    register("tensor", "numpy_tensor", *numpy_tensor())
except:
    pass