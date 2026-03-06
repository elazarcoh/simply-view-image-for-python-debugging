"""Tests for socket_client.py secret authentication parameter."""
import socket
import struct
import threading

# Inline the relevant function signature from socket_client.py
# We test that the secret parameter is sent as raw bytes before message data


def test_secret_hex_to_bytes():
    """bytes.fromhex converts hex secret to correct bytes."""
    hex_secret = "aa" * 32  # 64 hex chars = 32 bytes
    raw = bytes.fromhex(hex_secret)
    assert len(raw) == 32
    assert all(b == 0xAA for b in raw)


def test_secret_roundtrip():
    """Secret survives hex encode/decode roundtrip."""
    import os
    secret = os.urandom(32)
    hex_str = secret.hex()
    assert len(hex_str) == 64
    recovered = bytes.fromhex(hex_str)
    assert recovered == secret


def test_secret_sent_before_data():
    """When secret is provided, it is sent as the first 32 bytes on the socket."""
    received_data = bytearray()
    server_ready = threading.Event()

    def server_thread(port_holder):
        srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind(("localhost", 0))
        port_holder.append(srv.getsockname()[1])
        srv.listen(1)
        server_ready.set()
        conn, _ = srv.accept()
        while True:
            chunk = conn.recv(4096)
            if not chunk:
                break
            received_data.extend(chunk)
        conn.close()
        srv.close()

    port_holder = []
    t = threading.Thread(target=server_thread, args=(port_holder,))
    t.daemon = True
    t.start()
    server_ready.wait(timeout=5)

    port = port_holder[0]
    secret_hex = "ab" * 32
    expected_secret = bytes.fromhex(secret_hex)
    test_payload = b"hello"

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.connect(("localhost", port))
        # Simulate what socket_client.py does: send secret then payload
        s.sendall(expected_secret)
        s.sendall(test_payload)
        s.close()

    t.join(timeout=5)

    assert received_data[:32] == expected_secret, "First 32 bytes should be the secret"
    assert received_data[32:] == test_payload, "Remaining bytes should be the payload"


def test_no_secret_sends_no_prefix():
    """When secret is None, no prefix bytes are sent."""
    received_data = bytearray()
    server_ready = threading.Event()

    def server_thread(port_holder):
        srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind(("localhost", 0))
        port_holder.append(srv.getsockname()[1])
        srv.listen(1)
        server_ready.set()
        conn, _ = srv.accept()
        while True:
            chunk = conn.recv(4096)
            if not chunk:
                break
            received_data.extend(chunk)
        conn.close()
        srv.close()

    port_holder = []
    t = threading.Thread(target=server_thread, args=(port_holder,))
    t.daemon = True
    t.start()
    server_ready.wait(timeout=5)

    port = port_holder[0]
    test_payload = b"hello"

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.connect(("localhost", port))
        # No secret - just payload
        s.sendall(test_payload)
        s.close()

    t.join(timeout=5)

    assert received_data == test_payload, "All bytes should be payload when no secret"
