# Frame design system

The reference's dark editing surface, yellow selection accents, blue video tracks,
green audio tracks, compact headers, and pane layout become reusable Flask/Jinja
components. The converter retains MOV to H.264/AAC MP4 conversion.

## Tokens

`static/styles.css` defines semantic custom properties in `:root`:

| Role | Value |
| --- | --- |
| Workspace | `#101112` |
| Panel | `#18191b` |
| Raised surface | `#202123` |
| Border | `#2b2c2f` |
| Text / muted | `#ededee` / `#929498` |
| Primary action / selection | `#edca61` |
| Video / audio | `#5baff4` / `#55c79a` |
| Error | `#f29696` |
| Spacing | 4, 8, 12, 16, 20, 24, 32px |
| Corner radii | 5, 8, 12px |

Typography uses the system sans-serif stack; timecodes use monospace.
Headline 26px, panel title 12px, body 13px, metadata 9–11px.

## Components

Import `button`, `icon`, `panel_title`, and `property` from
`templates/components/ui.html`:

```jinja
{% from 'components/ui.html' import button, panel_title, property %}
{{ panel_title('Export settings', 'OUTPUT') }}
{{ property('Codec', 'H.264') }}
{{ button('Convert to MP4', 'arrow', 'primary', 'convert-button', 'submit') }}
```

Buttons support primary and secondary variants, native disabled states, and visible
keyboard focus. Panels use `.panel`, `.panel-heading`, `.panel-body`, and
`.panel-foot`. Status components include `.badge`, `.alert`, and `.status`.
Source media, preview monitor, and timeline have empty and populated states.

## Layout and behavior

Desktop: 250px media library, flexible monitor, 280px export panel, and full-width
source overview. Below 1100px export settings move under the monitor; below 650px
all panels stack. There is no fixed page width or height.

JavaScript adds local object-URL preview, drag and drop, metadata, source removal,
and asynchronous conversion with announced busy/result states. Unsupported MOV
preview codecs still allow conversion. The native multipart form remains usable
without JavaScript through the media library's file input. Export settings describe
actual backend behavior. Source overview is informational, not a trim editor.

## Interactive component reference

Open `/design-system` while the app runs to review the live palette, spacing scale,
buttons, typography, panels, and status components. Raised `blue`, `coral`, `purple`,
and `black` button variants adapt the second supplied reference with darker fills
for white-label contrast. All specimens use the same macros and stylesheet as the
converter; specimen buttons do not initiate conversion.
