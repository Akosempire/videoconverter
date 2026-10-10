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

The workspace starts empty. Choose or drop one MOV file to see its real preview,
thumbnail, name, size, duration, and dimensions. Replace or remove the source at
any time before converting. A codec the browser cannot preview can still be sent
for conversion.

Export settings affect the generated file:

- Quality: Balanced (CRF 23), High quality (CRF 18), Smaller file (CRF 28).
- Resolution: original, up to 1080p, or up to 720p. Limits preserve orientation and
  aspect ratio without enlarging a smaller source.
- Keep audio: include source audio as AAC, or create a silent MP4.

Upload progress is measured, followed by an indeterminate conversion state. A
successful response reveals the MP4 download. Errors preserve the source for a
retry. Files upload to the Flask server only when you convert; preview stays local.
The reference image informs the dark panels and accent colors only. There are no
sample files, pretend tracks, or color controls disconnected from the export.

See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for the component and state model.
The `/design-system` page uses the same component styles as the workspace.
No frontend build step is needed.

Run backend tests with `python -m pytest -q` (install `pytest` first).
For browser regression checks, install `playwright`, run
`python -m playwright install chromium`, start the app on port 3000, and run:

```powershell
$env:WORKSPACE_TEST_URL = "http://127.0.0.1:3000"
python tests/browser_workspace.py
```

The browser checks cover empty/imported states, real export/download, options,
failures and retry, unsupported previews, file removal, drag/drop, long filenames,
320–1920px layouts, and the JavaScript-disabled form. Screenshots are saved under
`.tmp/workspace-checks` and excluded from Git.

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
