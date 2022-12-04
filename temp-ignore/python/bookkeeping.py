try:
    _bookkeeping
except NameError:
    _bookkeeping = {}

    def get_bookkeeping(id):
        if id in _bookkeeping:
            return _bookkeeping[id]
        else:
            return None
    def add_bookkeeping(id, value):
        _bookkeeping[id] = value
