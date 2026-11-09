"""Serving a folder with the web app, for `stilo serve` and `stilo tutor`."""

import threading
import time
import webbrowser
from pathlib import Path

import uvicorn

from stilo.server import create_app

# The built web app, `stilo/web`: written there by `npm run build` in a
# checkout, shipped there in the package
WEB_DIST = Path(__file__).resolve().parents[1] / "web"


def run_server(folder: Path, host: str, port: int, web: Path = WEB_DIST, open_url: str | None = None):
    """Serves `folder` until the process is stopped. With `open_url`, opens
    it in the browser once the server accepts connections. Ctrl+C stops it
    with a goodbye instead of a traceback."""
    server = uvicorn.Server(uvicorn.Config(create_app(folder, web), host=host, port=port))
    if open_url:
        threading.Thread(target=_open_when_started, args=(server, open_url), daemon=True).start()
    try:
        server.run()
    except KeyboardInterrupt:
        # uvicorn has already shut down cleanly; it re-raises the interrupt
        # for its caller, and asyncio raises it out of a CancelledError
        print("Stilo: stopped. Goodbye!")


def _open_when_started(server, url):
    while not server.should_exit:
        if server.started:
            webbrowser.open(url)
            return
        time.sleep(0.1)
