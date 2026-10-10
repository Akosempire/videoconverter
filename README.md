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
http://localhost:5000
```

Upload a `.mov` file and download the converted `.mp4` version.

The Frame workspace includes drag-and-drop import, local video preview, source
metadata, and conversion feedback. MOV codecs that cannot play in your browser
can still be converted. Files are uploaded to the Flask server when you convert.
The responsive layout supports desktop and mobile screens.

See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for reusable Jinja components, colors,
spacing, buttons, and layout guidance. No frontend build step is needed.

Run the conversion tests with `python -m pytest -q` (install `pytest` first).

## Terminal usage

```powershell
python main.py "C:\path\to\input.mov" "C:\path\to\output.mp4"
```

If you omit the arguments, the script will look for a single `.mov` file in the current folder.

## Notes

- Audio is preserved in the output video.
- H.264/AAC output is used for broad compatibility.
- The web app stores uploaded files in the `uploads` directory.
