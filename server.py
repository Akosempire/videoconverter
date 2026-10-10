"""Production web entry point. main.py remains the standalone converter CLI."""

import logging
import os
import subprocess

from waitress import serve

from app import create_app


def check_ffmpeg():
    """Fail before serving traffic if the runtime cannot execute FFmpeg."""
    try:
        from moviepy.config import FFMPEG_BINARY

        subprocess.run(
            [FFMPEG_BINARY, "-version"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=15,
        )
    except (ImportError, RuntimeError, OSError, subprocess.SubprocessError) as exc:
        raise RuntimeError(
            "FFmpeg is missing or cannot run in this runtime. Deploy using the "
            "repository Dockerfile, which installs FFmpeg, or install FFmpeg "
            "in the runtime image and set IMAGEIO_FFMPEG_EXE to its executable."
        ) from exc


def main():
    try:
        port = int(os.environ.get("PORT", "3000"))
        if not 1 <= port <= 65535:
            raise ValueError
    except ValueError as exc:
        raise ValueError("PORT must be an integer between 1 and 65535.") from exc

    check_ffmpeg()
    app = create_app()

    # Trust Pxxl/host proxy headers so url_for and logging see the real client
    try:
        from werkzeug.middleware.proxy_fix import ProxyFix

        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    except Exception:
        pass

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.info("Starting video converter on 0.0.0.0:%s (threads=8, channel_timeout=300)", port)
    serve(
        app,
        host="0.0.0.0",
        port=port,
        threads=8,
        channel_timeout=300,
        connection_limit=200,
        backlog=2048,
        max_request_body_size=app.config["MAX_CONTENT_LENGTH"],
        ident="videoconverter",
        clear_untrusted_proxy_headers=True,
    )


if __name__ == "__main__":
    main()
