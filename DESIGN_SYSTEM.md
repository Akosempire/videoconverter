# Video converter design system

A functional conversion workspace inspired by the reference's dark panels,
warm yellow actions, blue video accents, and green completion states. The image
is not a screenshot template or preloaded project.

## Components and source

- `templates/components/workspace.html`: shared action button and panel-heading macros.
- `templates/components/editor.html`: reusable inline SVG glyphs.
- `templates/index.html`: media, preview, export, and conversion-status panels.
- `static/editor.css`: semantic tokens, states, and responsive layout.
- `static/app.js`: source lifecycle and actual upload/conversion behavior.
- `/design-system`: component specimens using these shared styles.

```jinja
{% from 'components/workspace.html' import action, heading %}
{{ heading('Source preview', 'SOURCE') }}
{{ action('Choose a video', 'plus', 'choose-file', true) }}
```

## Foundations

| Role | Token / value |
| --- | --- |
| Canvas | `--bg: #101112` |
| Panel | `--panel: #18191c` |
| Raised controls | `--surface: #222327` |
| Border | `--border: #2c2d32` |
| Main text | `--text: #eeeff2` |
| Supporting text | `--muted: #9a9da7` |
| Primary action | `--accent: #eccc72` |
| Video / progress | `--blue: #78b8f1` |
| Completion | `--green: #74cfaa` |
| Error | `--error: #f5a4a4` |
| Spacing | 4, 8, 12, 16, 20, 24, 32px |
| Radii | panels 10px, buttons 6px |

System fonts avoid external font downloads. Icons are SVG and decorative icons
are hidden from assistive technology. Every control has a label and visible
keyboard focus. Essential feedback uses a live region. Reduced motion is honored
for scrolling to conversion status. No automatic promotional animation is used.

## Product states

1. **Empty:** no files or preview imagery; clear import action; export disabled.
2. **Ready:** actual filename, size, metadata, frame thumbnail, native video player,
   and source removal/replacement. No fabricated duration or waveform.
3. **Preview unsupported:** a fallback explains that conversion can still be tried.
4. **Uploading:** measured upload percentage; source and settings locked.
5. **Converting:** indeterminate progress, no fabricated completion percentage.
6. **Complete:** server-provided filename, byte size, and working download link.
7. **Error:** actionable feedback and retry using the same source and settings.
8. **Removed/replaced:** object URL released; metadata and download state reset.

Quality, resolution, and audio controls alter the server conversion. No visual
editing controls imply changes that are not included in the downloaded MP4.
The standard multipart form remains usable without JavaScript.

## Responsive layout

- Above 980px: media library, flexible preview, export settings, then full-width
  conversion status. No fixed application aspect ratio or viewport-height lock.
- 621–980px: media and preview share a row; export spans the next row.
- 620px and below: preview first, compact source card, settings, conversion status.
  Populated preview uses a 16:10 containing frame; portrait video is letterboxed.
- Checked at 320, 390, 620, 768, 980, 1024, 1280, and 1920px, including long names.

No screenshot image, hardcoded reference assets, sample tracks, or mock project
is loaded by the application.
