"""
Tests for P1 — remove unused O(n²) buffer accumulation in socket_client.py.

The `all_data` variable accumulates all sent chunks with `bytes +=`
(O(n²) copying) but is never read. On Full HD images this wastes ~117ms.

Run: python -m pytest tests/unit/python/test_unused_buffer.py -v
"""
import ast
import os
import pytest

SOCKET_CLIENT_PATH = os.path.join(
    os.path.dirname(__file__), '..', '..', '..', 'src', 'python', 'socket_client.py'
)


def test_no_all_data_variable():
    """The all_data variable should not exist in socket_client.py."""
    with open(SOCKET_CLIENT_PATH) as f:
        source = f.read()

    assert 'all_data' not in source, (
        "Found 'all_data' in socket_client.py. "
        "This unused variable wastes O(n²) time accumulating bytes."
    )


def test_send_loop_still_exists():
    """The sendall loop should still exist after removing all_data."""
    with open(SOCKET_CLIENT_PATH) as f:
        source = f.read()

    assert 's.sendall(chunk)' in source, (
        "The sendall(chunk) call should still exist in the send loop."
    )


def test_socket_client_compiles():
    """socket_client.py should compile without errors."""
    with open(SOCKET_CLIENT_PATH) as f:
        source = f.read()
    compile(source, SOCKET_CLIENT_PATH, 'exec')
