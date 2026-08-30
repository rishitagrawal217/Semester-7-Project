"""Manual forward proxy that blocks phishing URLs — no mitmproxy involved.

- Plain HTTP requests: the full URL (path + query) is visible on the wire,
  so we check the complete URL and, if flagged, respond with a custom
  warning page instead of forwarding the request.
- HTTPS (CONNECT): without terminating TLS ourselves we only ever see the
  hostname from the CONNECT line, so that's all we check. A flagged host
  gets the CONNECT refused (403) and the socket closed — the browser shows
  its own generic connection error, not our warning page. That's the
  trade-off for not running our own MITM CA.
- Anything not flagged is relayed byte-for-byte, unmodified.
- If the prediction API call itself fails (service down, timeout), we fail
  open and let the request through rather than break browsing.

Run:
    python proxy/server.py
Then point your browser's HTTP *and* HTTPS proxy settings at
127.0.0.1:8081 (see README for exact steps per OS).
"""
import socket
import threading
from urllib.parse import urlsplit

import httpx

API_URL = "http://localhost:8000/api/predict"
LISTEN_HOST = "127.0.0.1"
LISTEN_PORT = 8081
BUFFER_SIZE = 8192
SOCKET_TIMEOUT = 15
BYPASS_HOSTS = ("localhost", "127.0.0.1")

WARNING_PAGE = """<!doctype html>
<html>
<head><title>Blocked - Phishing URL Detected</title></head>
<body style="font-family: sans-serif; text-align: center; margin-top: 15vh; color: #1f2937;">
  <h1 style="color:#dc2626;">Blocked: Phishing URL Detected</h1>
  <p>The URL <code>{url}</code> was flagged as phishing by the Phishing Detector.</p>
  <p style="color:#6b7280;">Browsing was stopped to protect you. Close this tab or go back.</p>
</body>
</html>"""


def is_phishing(url: str) -> bool:
    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.post(API_URL, json={"url": url})
            return bool(response.json().get("is_phishing"))
    except Exception as exc:
        print(f"[proxy] prediction check failed for {url}: {exc}")
        return False


def relay(source: socket.socket, destination: socket.socket) -> None:
    try:
        while True:
            data = source.recv(BUFFER_SIZE)
            if not data:
                break
            destination.sendall(data)
    except OSError:
        pass
    finally:
        for sock in (source, destination):
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass


def handle_connect(client: socket.socket, target_host: str, target_port: int) -> None:
    if target_host not in BYPASS_HOSTS and is_phishing(f"https://{target_host}"):
        client.sendall(b"HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n")
        client.close()
        return

    try:
        upstream = socket.create_connection((target_host, target_port), timeout=SOCKET_TIMEOUT)
    except OSError:
        client.sendall(b"HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n")
        client.close()
        return

    client.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
    threading.Thread(target=relay, args=(client, upstream), daemon=True).start()
    relay(upstream, client)


def handle_http(client: socket.socket, request_line: str, header_lines: list[str], body: bytes) -> None:
    method, url, http_version = request_line.split(maxsplit=2)
    headers = dict(h.split(": ", 1) for h in header_lines if ": " in h)

    content_length = int(headers.get("Content-Length", 0))
    while len(body) < content_length:
        chunk = client.recv(BUFFER_SIZE)
        if not chunk:
            break
        body += chunk

    parsed = urlsplit(url)
    host_header = headers.get("Host", "")
    target_host = parsed.hostname or host_header.split(":")[0]
    target_port = parsed.port or (int(host_header.split(":")[1]) if ":" in host_header else 80)

    if target_host not in BYPASS_HOSTS and is_phishing(url):
        page = WARNING_PAGE.format(url=url)
        response = (
            "HTTP/1.1 403 Forbidden\r\n"
            f"Content-Type: text/html\r\nContent-Length: {len(page)}\r\nConnection: close\r\n\r\n{page}"
        )
        client.sendall(response.encode())
        client.close()
        return

    try:
        upstream = socket.create_connection((target_host, target_port), timeout=SOCKET_TIMEOUT)
    except OSError:
        client.sendall(b"HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n")
        client.close()
        return

    origin_path = parsed.path or "/"
    if parsed.query:
        origin_path += "?" + parsed.query
    raw_request = f"{method} {origin_path} {http_version}\r\n" + "\r\n".join(header_lines) + "\r\n\r\n"
    upstream.sendall(raw_request.encode() + body)

    threading.Thread(target=relay, args=(upstream, client), daemon=True).start()
    relay(client, upstream)


def read_request_head(client: socket.socket) -> tuple[str, list[str], bytes]:
    buffer = b""
    while b"\r\n\r\n" not in buffer:
        chunk = client.recv(BUFFER_SIZE)
        if not chunk:
            break
        buffer += chunk
    head, _, rest = buffer.partition(b"\r\n\r\n")
    lines = head.decode(errors="replace").split("\r\n")
    return lines[0], lines[1:], rest


def handle_client(client: socket.socket) -> None:
    client.settimeout(SOCKET_TIMEOUT)
    try:
        request_line, header_lines, body = read_request_head(client)
        if not request_line.strip():
            client.close()
            return

        method = request_line.split()[0]
        if method == "CONNECT":
            target = request_line.split()[1]
            host, _, port = target.partition(":")
            handle_connect(client, host, int(port or 443))
        else:
            handle_http(client, request_line, header_lines, body)
    except Exception as exc:
        print(f"[proxy] error handling client: {exc}")
        client.close()


def main() -> None:
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((LISTEN_HOST, LISTEN_PORT))
    server.listen(100)
    print(f"[proxy] listening on {LISTEN_HOST}:{LISTEN_PORT} (checks against {API_URL})")

    while True:
        client, _ = server.accept()
        threading.Thread(target=handle_client, args=(client,), daemon=True).start()


if __name__ == "__main__":
    main()
