# Draft site

Lucas's own site, in progress. So far it holds only the opening sequence and a placeholder portfolio page.

## The intro

1. The name's outlines trace themselves with a soft glow (`js/trace.js`).
2. Render windows pop open, then a block wipe reveals the 3D name (`js/render-windows.js`, `js/film-post.js`).
3. The letters float on springs and nudge every few seconds to invite a click (`js/name.js`).
4. Clicking cracks the name from that point and bursts it into shards (`js/name.js`, timed in `js/main.js`).

## The letter material

The letters are rendered as light passing through rock, not as a coloured surface (`js/name.js`, with colours in `js/palette.js`).

- Each pixel follows a view ray back through a block of pigment clouds baked at startup (`js/bake.js`). The rock and pigments absorb green and blue faster than red, so more rock means a deeper colour.
- Each letter acts as a deep prism. A ray that slips out of a stroke's side crosses no more rock, so thin strokes glow and heavy joins stay deep, and the walls shift as a letter turns.
- Deeper clouds use blurrier copies of the bake, and part of the light comes out as a soft blur of the clouds, which gives dark bands a red bloom.
- A lamp hung far behind the name slides against the letters as they turn.

## Trying things

- Add `?font=shoulders`, `?font=teko`, `?font=inter`, or `?font=anton` to the address to compare fonts. Barlow Condensed is the default.
- Add `?skip=1` to jump straight to the floating name.
- Add `?style=thermal` to see one window style full screen. The other styles are `wireframe`, `uv`, `transmission`, `depth`, `halftone`, and `rings`.

## Changing the name or fonts

Run `node draft/tools/build-name.mjs` from the repo root. It needs the local `toolkit` folder, which is not published.

## Project sections

Each project sits in a rounded window in the middle of the screen, with room around it for text. As you scroll, CAD parts scattered across the whole screen fly in and assemble inside the window, the camera turns to the footage's angle, a light line wipes from CAD to video, then the video plays with the scroll. The window's size is set by `--rw` in `css/site.css`. The dog clip is cut with `tools/build-frames.mjs`, whose `lock` option follows the background and cancels the camera's movement. Code is in `js/projects/`, and the words and camera angles are in the `PROJECTS` list in `work.js`.

- Add `?to=work` to the address to skip the intro and reach the projects.
- `node draft/tools/build-frames.mjs` re-extracts the video frames, with clip times at the top of the file.
- `node draft/tools/build-cad.mjs` rebuilds the CAD files from the STL exports.
Both tools need the local `toolkit` folder, plus the source files in Downloads.
