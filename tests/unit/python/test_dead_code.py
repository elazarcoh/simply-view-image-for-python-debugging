"""
Tests for C4 — dead code removal in create_exception_message().

The function had unreachable code after the first `return` statement.
This test verifies the function still works correctly after removing
the dead code, and that no unreachable code remains.

Run: python -m pytest tests/unit/python/test_dead_code.py -v
"""
import ast
import os
import pytest

SOCKET_CLIENT_PATH = os.path.join(
    os.path.dirname(__file__), '..', '..', '..', 'src', 'python', 'socket_client.py'
)


def test_no_unreachable_code_after_return():
    """Check that no code follows a return statement in the same block."""
    with open(SOCKET_CLIENT_PATH) as f:
        source = f.read()

    tree = ast.parse(source)

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            body = node.body
            for i, stmt in enumerate(body):
                if isinstance(stmt, ast.Return) and i < len(body) - 1:
                    remaining = body[i + 1:]
                    # Filter out only real statements (not docstrings after return)
                    real_stmts = [s for s in remaining
                                  if not (isinstance(s, ast.Expr) and isinstance(s.value, ast.Constant))]
                    assert len(real_stmts) == 0, (
                        f"Function '{node.name}' has {len(real_stmts)} unreachable "
                        f"statement(s) after return at line {stmt.lineno}"
                    )


def test_create_exception_message_still_works():
    """Verify create_exception_message produces valid packed bytes."""
    with open(SOCKET_CLIENT_PATH) as f:
        source = f.read()

    # Execute the module to get the function
    namespace = {}
    exec(compile(source, SOCKET_CLIENT_PATH, 'exec'), namespace)

    create_exception_message = namespace['create_exception_message']
    result = create_exception_message(ValueError("test error"))
    assert isinstance(result, bytes)
    assert len(result) > 0
    # Should contain the exception type name and message
    assert b'ValueError' in result
    assert b'test error' in result


def test_socket_client_compiles_cleanly():
    """The file should compile without errors."""
    with open(SOCKET_CLIENT_PATH) as f:
        source = f.read()
    compile(source, SOCKET_CLIENT_PATH, 'exec')
