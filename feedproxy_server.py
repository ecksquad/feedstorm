"""Feedstorm's CORS-unlocking proxy.

Feedstorm is a plain static website (GitHub Pages), not a browser extension,
so its own fetch() calls are subject to normal CORS rules - most sites don't
send headers letting another origin read their response. This one route
fetches a URL server-side (no CORS applies to server-to-server requests) and
hands the content back with a permissive Access-Control-Allow-Origin, which
lets the browser read it.

Deliberately separate from byd-control's server.py (different service, own
port, own systemd unit) rather than bolted onto that one - a bug or abuse
issue here shouldn't be able to touch the car/house control service.

Scoped down for safety: GET only, http(s) schemes only, a real timeout, and
a response-size cap so this can't be used as an open bandwidth-relay for
arbitrary large files.
"""
from flask import Flask, request, Response
import requests

app = Flask(__name__)
MAX_BYTES = 5 * 1024 * 1024  # 5 MB - feeds are text; images load directly via <img>, not through this
TIMEOUT = 10


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    # This box's address is in Tailscale's CGNAT range, so Chrome/Edge's Local
    # Network Access policy blocks fetch() to it from a public page (like the
    # GitHub Pages site) unless the preflight response explicitly allows it.
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


@app.route("/", methods=["GET", "OPTIONS"])
def proxy():
    if request.method == "OPTIONS":
        return Response(status=204)

    url = request.args.get("url", "")
    if not url.startswith("http://") and not url.startswith("https://"):
        return Response("invalid url", status=400)

    try:
        upstream = requests.get(
            url,
            timeout=TIMEOUT,
            stream=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                              "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
                "Accept": "*/*",
            },
        )
    except requests.RequestException as e:
        return Response(f"upstream error: {e}", status=502)

    content = upstream.raw.read(MAX_BYTES + 1, decode_content=True)
    if len(content) > MAX_BYTES:
        return Response("upstream response too large", status=413)

    content_type = upstream.headers.get("Content-Type", "application/octet-stream")
    return Response(content, status=upstream.status_code, content_type=content_type)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8791, threaded=True)
