def keyvalue(pair):
    key, value = pair
    return f"{stringify(key)}: {stringify(value)}"


def sanitize(s):
    # s.replace(\"'\", \"\\'\").replace('\"', '\\\"')
    return s.replace("'", "").replace('"', '')


def stringify(value):
    if isinstance(value, list):
        return f"[{','.join(map(stringify, value))}]"
    elif isinstance(value, tuple):
        return f"({','.join(map(stringify, value))})"
    elif isinstance(value, dict):
        return f"{{{ ','.join(map(keyvalue, value.items())) }}}"
    elif isinstance(value, str):
        if value.startswith("Value(") or value.startswith("Error("):
            return value  # keep Value/Error without wrapping quoted
        else:
            return f"'{value}'"
    elif isinstance(value, Exception):
        return f'"{type(value).__name__}: {sanitize(str(value))}"'
    else:
        return str(value)


def eval_into_value(func):
    try:
        return f"Value({stringify(func())})"
    except Exception as e:
        return f"Error({stringify(e)})"


def same_value_multiple_callables(get_value, funcs):
    try:
        val = get_value()
        return [eval_into_value(lambda: f(val)) for f in funcs]
    except Exception as e:
        return [f"Error({stringify(e)})"] * len(funcs)


def object_shape_if_it_has_one(obj):
    if hasattr(obj, "shape"):
        shape = obj.shape
        return tuple(shape)
    elif hasattr(obj, "width") and hasattr(obj, "height") and hasattr(obj, "getbands"):
        bands = "".join(map(str, obj.getbands()))
        return {"width": obj.width, "height": obj.height, "channels": bands}
    else:
        return None
