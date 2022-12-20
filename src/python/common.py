def eval_into_value(func):
    try:
        return f"Value({func()})"
    except Exception as e:
        return f'Error("{type(e).__name__}")'


def same_value_multiple_callables(get_value, funcs):
    try:
        val = get_value()
        return [eval_into_value(lambda: f(val)) for f in funcs]
    except Exception as e:
        return [f"Error({type(e).__name__},'{e}')"] * len(funcs)
