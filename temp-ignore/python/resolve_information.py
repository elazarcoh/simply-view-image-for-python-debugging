
@catch_exception_to_object
def find_object_types(img, restrict_types):
    object_types = []
    info_funcs = []
    for group, types in _type_groups.items():
        for type in types:
            if type in _object_handlers_registry:
                is_type, info = _object_handlers_registry[type]
                if is_type(img, restrict_types):
                    object_types.append((group, type))
                    info_funcs.append(info)
                    break
    if len(info_funcs) == 0:
        return object_types, pack_info_to_object({})
    else:
        info = info_funcs[0](img)
        return object_types, info
