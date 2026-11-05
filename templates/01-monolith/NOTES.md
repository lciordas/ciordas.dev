# Monolith template

A full-screen 3D portfolio. Home is a ring of giant project titles around a veined stone. Opening a project breaks the stone into a ring of shards around a media screen.

## Fill it in

Edit `content.js`. Every word, link, colour and media path lives there. Nothing else needs changing.

- **Projects:** add or remove entries in `projects`. `title` is the two big lines, `media` takes images and videos such as `[{ src: 'media/one.mp4' }]`. An empty list shows a generated placeholder.
- **Colours:** each project has its own `palette`, and the whole scene follows it.
- **Start without the intro:** set `intro: false`.

## Run it

It needs a web server because it uses JavaScript modules. From the `templates` folder:

```
python3 -m http.server 8101
```

Then open `http://localhost:8101/01-monolith/`. The gallery of single effects is at `http://localhost:8101/01-monolith/elements.html`.

If you move this folder, keep `_vendor` beside it or update the `../_vendor/` paths in `index.html`, `elements.html` and `css/site.css`. Routes use the URL hash (`#/about`, `#/work/project-one`), so no server rewrites are needed on GitHub Pages.

## Elements

Each file in `elements/` exports one mount function. `_util.js` and `_merge.js` are helpers.

| File | What it does |
| --- | --- |
| `stone.js` | Veined monolith made of fracture cells: cracks, hover slit, heat, shards, sparks, chips, debug render modes |
| `dusk-landscape.js` | Sky, hills, plants, birds, mirrored pools, flood mode |
| `title-ring.js` | Curved 3D titles, solid in the centre and outlined outside it |
| `carousel-input.js` | Wheel and drag as one snapping spring |
| `media-plane.js` | Floating soft-edged screen that opens from a column and cross-cuts |
| `block-dissolve.js` | Grid wipe with registration marks |
| `film-post.js` | Bloom, vignette, woven grain |
| `render-windows.js` | Panels showing one scene in different render modes |
| `loader-outline.js` | Progress drawn up the object's silhouette |
| `ui-links.js` | Cracked word, rolling link, redrawing arrow |
| `line-reveal.js` | Masked line-by-line text reveal |
| `flip-brand.js` | A word flies from one place on the page to another |
| `sound.js` | Self-drawing speaker icon and generated ambience |

## Replication status

Compared side by side with the reference at 1440×900 and 390×844, using frame sequences of each transition.

| Feature | Status | Notes |
| --- | --- | --- |
| Loading outline climbing both sides with glowing tips | Matched | Generated from this stone's real silhouette. Runs for a fixed 3.3 seconds |
| Seven render-pass windows, same slots and sizes | Matched | Positions are fixed here. The reference shuffles which label sits in which slot on each load |
| Block dissolve with rounded survivors and marks | Matched | |
| Title ring sweeping in from the previous title after the dissolve | Matched | |
| Header, nav and sound layout, sizes, colours, easings | Matched | Measured from computed styles |
| Cracked-word nav hover | Matched | |
| Rolling link with rule sweep and arrow exit | Matched | |
| Arrow erase and redraw | Matched | |
| Sound icon animation | Matched | |
| Keyboard-only project list appearing on focus | Matched | |
| Wheel: small nudge springs back, full step advances | Matched | |
| Drag: scene pulls back, titles flatten into a row, spring on release | Matched | Spring values are tuned by eye against frames |
| Stone rotating half a turn per project | Matched | |
| Per-project colour grade | Matched | Palettes sampled from the reference frames. Only the first 8 of its 12 grades are in `content.js` |
| Solid and outlined title cut per pixel, blur near the lens | Matched | |
| Title click and stone click open the project; side titles do nothing | Matched | |
| Cracks glow over the whole stone, then burst | Matched | Timing matched from frames |
| Shards orbiting the media screen, with drift and parallax | Matched | |
| Screen opening from a column, closing back into one | Matched | |
| Next and previous between projects, shards re-flying | Matched | |
| Arrow keys and Escape in a project | Matched | |
| Scroll or click outside the screen closes a project | Matched | Clicking the screen itself keeps it open. Inferred, since the reference test only covered the outside click |
| About: stone slides right spinning, scene grades, name flies into the paragraph, lines reveal | Matched | |
| About: heat following the pointer | Matched | |
| Links dimming each other, copy email feedback | Matched | |
| Mobile layout: centred sheet, arrows at the bottom, big title hidden on project pages, no sound button on touch | Matched | |
| Mouse parallax | Approximated | Same direction, strength tuned by eye |
| Stone surface | Approximated | Procedural shader, not a sculpted model with painted textures. Bands and veins read alike, the exact pattern differs |
| Stone silhouette | Approximated | Profile measured from the reference outline, with a different surface detail |
| Hover slit on the stone | Approximated | Drawn in the shader along the fracture line. The reference physically opens the mesh |
| Shard shapes | Approximated | Cut from the stone by fracture cells with generated creases. The reference pieces have more folded detail |
| Landscape | Approximated | Generated terrain and plants. Same layering and mood, different specific shapes |
| Water reflection | Approximated | True mirror pass with ripple. The reference pools sit in different places |
| Sparks on the stone while moving | Approximated | Timing and placement are close, not identical |
| Display type | Approximated | Archivo Black stretched wider, because the reference uses a paid font. Interface text is Hanken Grotesk for the same reason |
| Project media | Not replicated | The reference videos belong to their owners. Generated placeholders run until you add yours |
| Sound design | Not replicated | The reference audio files were not reused. A small synthesized ambience and effects stand in, silent until the first click or key press |
| About text drawn inside the 3D scene | Not replicated | Plain page text here, which looks the same and stays selectable |
| WebGPU renderer | Not replicated | Uses WebGL2 for wider browser support |
| 404 page with interactive void | Not replicated | Out of scope for a template using hash routes. Unknown routes show home |

## Accessibility and fallbacks

- **Reduced motion:** the intro is skipped and transitions finish almost at once.
- **No WebGL:** a readable page with the project list, about text and project details.
- **Touch:** swipe moves between projects, tap opens one.
