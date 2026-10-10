# MOV to MP4 Converter

A simple video converter that works from both the terminal and a browser-based web app.

## Prerequisites

- Python 3.10+
- FFmpeg installed and available in PATH

## Install on Windows

```powershell
git clone https://github.com/Akosempire/videoconverter.git
cd videoconverter
python -m pip install -r requirements.txt
```

If FFmpeg is not already installed:

```powershell
winget install --id Gyan.FFmpeg -e --source winget
```

Then confirm it works:

```powershell
ffmpeg -version
```

## Web app usage

Start the server:

```powershell
python app.py
```

Then open:

```text
http://localhost:3000
```

Upload a `.mov` file and download the converted `.mp4` version.

The workspace reproduces the supplied editing UI: media library, source monitor,
color inspector, and multitrack reference timeline. Use **Import** to select a MOV,
then **Export** to convert and download an MP4. MOV codecs that cannot play in your
browser can still be converted. Files upload to the Flask server when converting.

The initial scene and tracks are reference samples. Color controls affect the
monitor preview only; MP4 output retains source colors. Playback, seeking, volume,
frame capture, asset search, and saved preview presets work in the browser.

See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for reusable Jinja components, reference
geometry, colors, spacing, and behavior. No frontend build step is needed.

Run the conversion tests with `python -m pytest -q` (install `pytest` first).

## Production deployment (Pxxl)

Use the repository's **Dockerfile** build mode so FFmpeg is installed in the
final runtime image. Installing the Python `moviepy` package alone does not
guarantee that an FFmpeg executable exists on every Linux distribution.

| Setting | Value |
| --- | --- |
| Source branch | `main` |
| Base directory | repository root (`/`) |
| Build mode | Dockerfile |
| Dockerfile path | `Dockerfile` |
| Application port | `3000` |
| Environment variable | `PORT=3000` |
| Start command | image default (`python server.py`) |
| Health check path, if configurable | `/healthz` |

Remove the old `python main.py` start override. It invokes the file-conversion
CLI and does not start an HTTP server. The Dockerfile handles dependency
installation; do not carry over the Python buildpack's install/build commands.
If the dashboard requires an explicit start command, use `python server.py`.

`server.py` verifies that FFmpeg runs before accepting requests, then starts
Waitress on `0.0.0.0:$PORT` (default `3000`). `python app.py` starts the same server.
The original `python main.py input.mov output.mp4` command remains available.

For hosts without Dockerfile support, use a runtime image with system FFmpeg
installed and start `python server.py`; set `IMAGEIO_FFMPEG_EXE` and
`FFMPEG_BINARY` to that executable's path if discovery fails. Installing FFmpeg
only on a separate build machine does not install it in the application runtime.

To test the Docker deployment locally where Docker is installed:

```sh
docker build -t videoconverter .
docker run --rm -p 3000:3000 videoconverter
```

The image runs as an unprivileged user. Uploaded files are temporary container
data unless a persistent writable volume is mounted at `/app/uploads`.

Pxxl configuration reference: https://docs.pxxl.app/deploy/configuration

## Terminal usage

```powershell
python main.py "C:\path\to\input.mov" "C:\path\to\output.mp4"
```

If you omit the arguments, the script will look for a single `.mov` file in the current folder.

## Notes

- Audio is preserved in the output video.
- H.264/AAC output is used for broad compatibility.
- The web app stores uploaded files in the `uploads` directory.
