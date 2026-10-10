# Video editor design system

The primary screen now reproduces the supplied video editor reference: a 1536 ×
1092 black application shell on a charcoal canvas, 35px navigation, three editing
panes, and a lower multitrack timeline. At the reference's 2048 × 1235 viewport,
the shell sits at x=256 and y=71.5, matching the supplied composition.

## Source and components

- `templates/components/editor.html`: reusable SVG glyphs, icon buttons, asset
  cards, and adjustment sliders.
- `templates/index.html`: reference workspace assembled from those components.
- `static/editor.css`: reference colors, geometry, control states, and responsive
  layouts. Panel gap 8px; panel radius 6px; spacing scale 4/8/12/16px.
- `static/assets/editor-reference.jpg`: user-supplied visual reference, used as a
  CSS image sprite for the lounge, people, and meeting-room image assets. Panels,
  controls, type, tracks, and color wheels are real HTML/CSS, not a screenshot
  overlay. No external stock imagery or image generation is used.

## Palette

| Token | Color |
| --- | --- |
| Surround | `#282828` |
| Application shell | `#030303` |
| Pane | `#0a0a0a` |
| Raised surface | `#191919` |
| Text | `#898989` |
| Selection | `#c69d16` |
| Video track | `#0784d8` |
| Image track | `#bb00e5` |
| Audio track | `#00bf69` |

```jinja
{% from 'components/editor.html' import tool, slider, asset %}
{{ tool('folder', 'Import MOV', 'import-button') }}
{{ slider('Saturation', 'saturation', 100, 50, 400) }}
{{ asset('film', 'lounge', 'Assetname here', true) }}
```

## Behavior

Import opens the MOV picker. Export opens a native modal with the existing
Flask conversion form. Drag a MOV onto the source monitor to import. The preview
supports playback, seeking, frame stepping, volume, playback speed, and frame
capture for browser-compatible codecs. Unsupported MOV codecs can still convert.

The initial project contains reference sample images and illustrative timeline
tracks. It is not a playable sample video. Imported MOV footage populates the
source monitor and first video clip. Timeline tracks provide reference selection,
visibility, locking, and preview mute/solo controls; they do not concatenate media.

Color presets, sliders, and tint controls affect the monitor preview only. The
Export modal and Properties/Effect control panels disclose that MP4 export uses
original source colors. Saved preview presets use browser local storage.

The earlier optional `/design-system` gallery retains the raised button variants
from the second user reference. The application's main UI uses the first image's
compact editor controls instead. Below 900px panels reflow; below 540px monitor,
media library, inspector, and timeline stack while retaining their visual styles.
