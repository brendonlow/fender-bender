"""Static server for the app with revalidation headers, so phones pick up new versions
instead of running a cached index.html. Usage: python3 serve.py [port] [bind]"""
import functools, http.server, os, sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")  # always revalidate; 304s keep it fast
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8100
bind = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"
handler = functools.partial(NoCacheHandler, directory=os.path.dirname(os.path.abspath(__file__)))
http.server.ThreadingHTTPServer((bind, port), handler).serve_forever()
