def keyvalue(pair):
    key, value = pair
    return f"{stringify(key)}: {stringify(value)}"


def sanitize(s):
    backslash = chr(92)
    dq = chr(34)
    return s.replace(backslash, backslash + backslash).replace(dq, backslash + dq)


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
            return f'"{sanitize(value)}"'
    elif isinstance(value, Exception):
        return f'"{type(value).__name__}: {sanitize(str(value))}"'
    else:
        return str(value)


def eval_into_value(func):
    try:
        return f"Value({stringify(func())})"
    except Exception as e:
        return f"Error({stringify(e)})"


def eval_or_return_exception(func):
    try:
        return func()
    except Exception as e:
        return e


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


# ---------------------------------------------------------------------------
# probe_viewables_and_info — single-call probe replacing two round-trips.
#
# expr_checkers: list of (get_val, [(type_name_str, test_fn, info_fn), ...])
#   get_val:   zero-arg lambda that returns the object to inspect
#   type_name_str: the Viewable.type string (used as "viewable_type" key)
#   test_fn:   lambda(val) -> bool  — True if the viewable matches
#   info_fn:   lambda(val) -> dict  — returns the info dict on match
#
# Returns: list of lists — for each expression, a list of eval_into_value
# strings (Value({...}) or Error(...)) for each matching viewable.
# ---------------------------------------------------------------------------

_probe_cache = {}
_PROBE_CACHE_MAX = 512


def _shape_sig(obj):
    if hasattr(obj, "shape"):
        try:
            return tuple(obj.shape)
        except Exception:
            return None
    elif hasattr(obj, "width") and hasattr(obj, "height"):
        try:
            return (obj.width, obj.height)
        except Exception:
            return None
    return None


def _probe_key(val):
    return (id(val), type(val).__name__, _shape_sig(val))


def probe_viewables_and_info(expr_checkers):
    results = []
    for get_val, checker_triples in expr_checkers:
        try:
            val = get_val()
            key = _probe_key(val)
            cached = _probe_cache.get(key)
            if cached is not None:
                results.append(cached)
                continue
            per_expr = []
            for type_name, test_fn, info_fn in checker_triples:
                try:
                    if test_fn(val):
                        tn, ifn, v = type_name, info_fn, val
                        def _get(tn=tn, ifn=ifn, v=v):
                            i = ifn(v)
                            i["viewable_type"] = tn
                            return i
                        per_expr.append(eval_into_value(_get))
                except Exception:
                    pass
            if len(_probe_cache) >= _PROBE_CACHE_MAX:
                _probe_cache.pop(next(iter(_probe_cache)))
            _probe_cache[key] = per_expr
        except Exception as e:
            per_expr = [f"Error({stringify(e)})"]
        results.append(per_expr)
    return results
