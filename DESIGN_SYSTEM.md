# Video converter design system

A Neo-Brutalist conversion workspace: cream canvas, thick black borders, hard offset shadows, and vibrant candy fills (coral primary, lavender secondary, teal accent, yellow highlights). The layout remains the same (media / preview / export / conversion strip), only the skin changed. The image is not a screenshot template or preloaded project.

## Components and source

- `templates/components/workspace.html`: shared action button and panel-heading macros.
- `templates/components/editor.html`: reusable inline SVG glyphs.
- `templates/index.html`: media, preview, export, and conversion-status panels.
- `static/workspace.css`: semantic tokens, states, and responsive layout.
- `static/app.js`: source lifecycle and actual upload/conversion behavior.
- `/design-system`: component specimens using these shared styles.
- `/design-system/premium`: full brutalist reference (tokens, buttons, dropzone, states).

```jinja
{% from 'components/workspace.html' import action, heading %}
{{ heading('Source preview', 'SOURCE') }}
{{ action('Choose a video', 'upload', 'choose-file', true) }}
```

## Foundations

| Role | Token / value |
| --- | --- |
| Canvas | `--bg: #FFF9EE` (cream) |
| Panel | `--panel: #FFFFFF` |
| Surface | `--surface: #FFF6E8` |
| Input | `--input: #FFFFFF` |
| Border | `--border: #111111` (2.5px, hard shadow `5px 5px 0 #111`) |
| Main text | `--text: #111111` |
| Supporting text | `--muted: #6B6B6B` |
| Quiet | `--quiet: #9A9A9A` |
| Primary (coral) | `--primary: #FF5A5A` |
| Secondary (lavender) | `--secondary: #8B7CF8` |
| Accent / Success (teal) | `--accent: #1CC9B6` |
| Highlight (yellow) | `--yellow: #FFD93D` |
| Error | `--error: #FF5A5A` |
| Spacing | 4, 8, 12, 16, 20, 24, 32px |
| Radii | panels 14px, buttons 10px, pills 999px |

Bold `2.5px solid #111` strokes and `5px 5px 0 #111` hard shadows replace thin 1px borders and soft glows. Primary CTA is coral, secondary lavender, accent/teal for success. Yellow marks highlights and active chips. Buttons lift on hover and sink into the shadow on press. System fonts avoid external font downloads. Icons are SVG and decorative icons are hidden from assistive technology. Every control has a 3px black focus ring. Essential feedback uses a live region. The central isometric MOV→MP4 illustration now sits on cream with thick black outlines and floats gently; other motion is limited to user interaction and conversion state. Reduced-motion preferences disable animation.

## Product states

1. **Empty:** no files or preview imagery; clear import action; export disabled.
2. **Ready:** actual filename, size, metadata, frame thumbnail, native video player, and source removal/replacement. No fabricated duration or waveform.
3. **Preview unsupported:** a fallback explains that conversion can still be tried.
4. **Uploading:** measured upload percentage; source and settings locked.
5. **Converting:** indeterminate progress, no fabricated completion percentage.
6. **Complete:** server-provided filename, byte size, and working download link.
7. **Error:** actionable feedback (coral alert) and retry using the same source and settings.
8. **Removed/replaced:** object URL released; metadata and download state reset.

Quality, resolution, and audio controls alter the server conversion. No visual editing controls imply changes that are not included in the downloaded MP4. The standard multipart form remains usable without JavaScript.

## Responsive layout

- Above 980px: media library, flexible preview, export settings, then full-width conversion status. No fixed application aspect ratio or viewport-height lock.
- 621–980px: media and preview share a row; export spans the next row.
- 620px and below: preview first, compact source card, settings, conversion status. Populated preview uses a 16:10 containing frame; portrait video is letterboxed. Hard shadows clamp to 3px at mobile widths.
- Checked at 320, 390, 620, 768, 980, 1024, 1280, and 1920px, including long names.

No screenshot image, hardcoded reference assets, sample tracks, or mock project is loaded by the application.
