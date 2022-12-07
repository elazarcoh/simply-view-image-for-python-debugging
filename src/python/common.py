def eval_into_value(func):
    try:
        return f"Value({func()})"
    except Exception as e:
        return f"Error({type(e).__name__},'{e}')"


def same_value_multiple_callables(func, funcs):
    try:
        val = func()
        return [eval_into_value(lambda: f(val)) for f in funcs]
    except Exception as e:
        return [f"Error({type(e).__name__},'{e}')"] * len(funcs)
