# Draft site

Lucas's own site, in progress. So far it holds only the opening sequence and a placeholder portfolio page.

## The intro

1. The name's outlines trace themselves with a soft glow (`js/trace.js`).
2. Render windows pop open, then a block wipe reveals the 3D name (`js/render-windows.js`, `js/film-post.js`).
3. The letters float on springs and nudge every few seconds to invite a click (`js/name.js`).
4. Clicking cracks the name from that point and bursts it into shards (`js/name.js`, timed in `js/main.js`).

## Trying things

- Add `?font=shoulders`, `?font=teko`, `?font=inter`, or `?font=anton` to the address to compare fonts. Barlow Condensed is the default.
- Add `?skip=1` to jump straight to the floating name.
- Add `?style=thermal` to see one window style full screen. The other styles are `wireframe`, `uv`, `clay`, `transmission`, `normals`, `contours`, `depth`, `halftone`, `rings`, and `negative`.

## Changing the name or fonts

Run `node draft/tools/build-name.mjs` from the repo root. It needs the local `toolkit` folder, which is not published.
