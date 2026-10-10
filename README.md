# MOV to MP4 Converter

A simple Python script to convert .mov files to .mp4 using MoviePy and FFmpeg.

## Prerequisites

- Python 3.10+
- FFmpeg installed and added to PATH
- MoviePy package

## Install on Windows

```powershell
git clone https://github.com/melihteke/moviepy-mov2mp4.git
cd moviepy-mov2mp4
py -m pip install -r requirements.txt
```

Install FFmpeg if it is not already available:

```powershell
winget install --id Gyan.FFmpeg -e --source winget
```

Then confirm it is available:

```powershell
ffmpeg -version
```

## Usage

Run the converter with your own input and output paths:

```powershell
py main.py "C:\path\to\input.mov" "C:\path\to\output.mp4"
```

You can also use the defaults:

```powershell
py main.py
```

This will read `test.mov` and write `output.mp4` in the project folder.

## Notes

- The script keeps audio in the converted video.
- It creates the destination folder automatically if needed.
- The output is encoded with H.264/AAC for broad compatibility.
