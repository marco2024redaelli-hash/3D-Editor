"""
Server locale per il GLB 3D Editor con API per Claude Code.

Uso:
    python serve_editor.py
    python serve_editor.py --port 8080

Apri http://localhost:3000 nel browser per usare l'editor.

API endpoints:
    POST /api/command      - Invia un comando all'editor (Claude Code -> Editor)
    GET  /api/commands     - Leggi comandi pendenti (Editor polling)
    POST /api/scene-info   - Aggiorna info scena (Editor -> Server)
    GET  /api/scene-info   - Leggi info scena (Claude Code -> Server)
"""

import argparse
import http.server
import json
import os
import threading
import urllib.request
import urllib.error
import webbrowser
from functools import partial

LMSTUDIO_BASE = "http://localhost:1234"

# Shared state
_lock = threading.Lock()
_command_queue = []
_scene_info = {}


class EditorRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP handler con CORS e API endpoints per Claude Code."""

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def _send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length)

    def _proxy_lmstudio(self, path, body=None):
        """Proxy request to LM Studio and return the response."""
        url = LMSTUDIO_BASE + path
        headers = {"Content-Type": "application/json"}
        try:
            req = urllib.request.Request(url, data=body, headers=headers,
                                         method="POST" if body else "GET")
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.URLError as e:
            self._send_json({"error": f"LM Studio non raggiungibile: {e}"}, 502)
        except Exception as e:
            self._send_json({"error": str(e)}, 500)

    def do_POST(self):
        if self.path == "/api/command":
            try:
                cmd = json.loads(self._read_body())
                with _lock:
                    _command_queue.append(cmd)
                self._send_json({"ok": True})
                action = cmd.get("action", "?")
                ptype = cmd.get("type", "")
                print(f"  [API] Comando ricevuto: {action} {ptype}")
            except (json.JSONDecodeError, Exception) as e:
                self._send_json({"error": str(e)}, 400)

        elif self.path == "/api/scene-info":
            try:
                info = json.loads(self._read_body())
                with _lock:
                    _scene_info.clear()
                    _scene_info.update(info)
                self._send_json({"ok": True})
            except (json.JSONDecodeError, Exception) as e:
                self._send_json({"error": str(e)}, 400)

        elif self.path.startswith("/api/lmstudio/"):
            # Proxy to LM Studio: /api/lmstudio/v1/chat/completions -> localhost:1234/v1/chat/completions
            lm_path = self.path.replace("/api/lmstudio", "", 1)
            body = self._read_body()
            self._proxy_lmstudio(lm_path, body)

        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        if self.path == "/api/commands":
            with _lock:
                cmds = list(_command_queue)
                _command_queue.clear()
            self._send_json(cmds)

        elif self.path == "/api/scene-info":
            with _lock:
                info = dict(_scene_info)
            self._send_json(info)

        elif self.path.startswith("/api/lmstudio/"):
            # Proxy GET to LM Studio (e.g. /v1/models)
            lm_path = self.path.replace("/api/lmstudio", "", 1)
            self._proxy_lmstudio(lm_path)

        else:
            super().do_GET()

    def log_message(self, format, *args):
        msg = format % args
        # Nascondi polling frequente e favicon
        if "favicon" not in msg and "/api/commands" not in msg:
            print(f"  {msg}")


def main():
    parser = argparse.ArgumentParser(description="Server per GLB 3D Editor")
    parser.add_argument("--port", type=int, default=3000, help="Porta (default: 3000)")
    parser.add_argument("--no-open", action="store_true", help="Non aprire il browser automaticamente")
    args = parser.parse_args()

    # Serve i file dalla cartella public/ (un livello sopra tools/)
    directory = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public"))
    handler = partial(EditorRequestHandler, directory=directory)

    port = args.port
    print("\n  GLB 3D Editor + Claude Code API")
    print(f"  Server: http://localhost:{port}")
    print(f"  Editor: http://localhost:{port}/glb_editor.html")
    print(f"  Directory: {directory}")
    print("\n  API endpoints:")
    print(f"    POST http://localhost:{port}/api/command     <- Claude Code invia comandi")
    print(f"    GET  http://localhost:{port}/api/scene-info  <- Claude Code legge la scena")
    print("\n  Premi Ctrl+C per fermare\n")

    if not args.no_open:
        webbrowser.open(f"http://localhost:{args.port}/glb_editor.html")

    server = http.server.ThreadingHTTPServer(("", args.port), handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server fermato.")
        server.server_close()


if __name__ == "__main__":
    main()
