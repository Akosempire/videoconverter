FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=3000 \
    IMAGEIO_FFMPEG_EXE=/usr/bin/ffmpeg \
    FFMPEG_BINARY=/usr/bin/ffmpeg

WORKDIR /app

# Install the executable in the final runtime image, not only the build host.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && ffmpeg -version

RUN useradd --create-home --uid 10001 converter \
    && chown converter:converter /app
COPY --chown=converter:converter app.py server.py main.py ./
COPY --chown=converter:converter templates ./templates
COPY --chown=converter:converter static ./static

USER converter
RUN mkdir uploads && python -c "from server import check_ffmpeg; check_ffmpeg()"

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('PORT', '3000') + '/healthz', timeout=3)"

CMD ["python", "server.py"]
