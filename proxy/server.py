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
import html
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
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Blocked — Phishing URL Detected</title>
<style>
  :root {
    --bg: #f8fafc;
    --card-bg: #ffffff;
    --card-border: #e2e8f0;
    --text: #1e293b;
    --text-muted: #64748b;
    --danger-bg: #fff1f2;
    --danger-border: #fecdd3;
    --danger-text: #be123c;
    --danger-icon-bg: #f43f5e;
    --code-bg: #f1f5f9;
    --button-bg: #2563eb;
    --button-bg-hover: #1d4ed8;
    --button-text: #ffffff;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --danger-bg: rgba(244, 63, 94, 0.12);
      --danger-border: #9f1239;
      --danger-text: #fda4af;
      --danger-icon-bg: #f43f5e;
      --code-bg: #0f172a;
      --button-bg: #3b82f6;
      --button-bg-hover: #60a5fa;
      --button-text: #0f172a;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    padding: 24px;
  }
  .card {
    width: 100%;
    max-width: 440px;
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 16px;
    padding: 32px;
    text-align: center;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  }
  .brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
    color: var(--text-muted);
    margin-bottom: 20px;
  }
  .icon-badge {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--danger-icon-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
  }
  h1 {
    font-size: 20px;
    margin: 0 0 8px;
  }
  .subtitle {
    color: var(--text-muted);
    font-size: 14px;
    margin: 0 0 20px;
  }
  .url-box {
    background: var(--danger-bg);
    border: 1px solid var(--danger-border);
    color: var(--danger-text);
    border-radius: 10px;
    padding: 10px 14px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    word-break: break-all;
    margin-bottom: 20px;
  }
  .explanation {
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1.5;
    margin-bottom: 24px;
  }
  button {
    background: var(--button-bg);
    color: var(--button-text);
    border: none;
    border-radius: 10px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  button:hover {
    background: var(--button-bg-hover);
  }
</style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z"/>
      </svg>
      Phishing Detector
    </div>
    <div class="icon-badge">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 9v4"/>
        <path d="M12 17h.01"/>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>
      </svg>
    </div>
    <h1>This site was blocked</h1>
    <p class="subtitle">Identified as a likely phishing site</p>
    <div class="url-box">__URL__</div>
    <p class="explanation">
      Browsing was stopped automatically by the Phishing Detector proxy to protect you.
      If you believe this is a mistake, you can verify the URL yourself in the dashboard.
    </p>
    <button onclick="history.back()">Go Back</button>
  </div>
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
        page = WARNING_PAGE.replace("__URL__", html.escape(url))
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
