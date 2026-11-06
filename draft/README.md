# Draft site

Lucas's own site, in progress. So far it holds only the opening sequence and a placeholder portfolio page.

## The intro

1. The name's outlines trace themselves with a soft glow (`js/trace.js`).
2. Render windows pop open, then a block wipe reveals the 3D name (`js/render-windows.js`, `js/film-post.js`).
3. The letters float on springs and nudge every few seconds to invite a click (`js/name.js`).
4. Clicking cracks the name from that point and bursts it into shards (`js/name.js`, timed in `js/main.js`). A prompt under the name ("Scroll", or "Tap" on touch screens) means scrolling down, swiping up, tapping, or the down arrow breaks it from the middle.

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

After the name shatters, the overview page is underneath it: projects in two columns, then distinctions and experience. Arrow keys and Enter work as well as the mouse. Scrolling down from it walks through every project. Choosing one opens that project alone, right below the overview, so scrolling back up returns to the overview; Esc and the Overview button also go back. Project addresses look like `/draft/#robot-dog` and skip the intro.

The words and the overview's look live in `data/content.json`. Edit them in the Editor tab (`/draft/edit/`): type on the preview, changes save in that browser, and Publish commits the file through GitHub using your own token.

Animated projects sit in a rounded window with room around it for text. CAD parts float at random across the whole screen, then assemble in the window as you scroll. A light line wipes from CAD to footage, which either moves with the scroll or plays as a video. Their timing and camera angles are in `ANIMATED` in `js/projects/work.js`, the window's size is `--rw` in `css/site.css`. Models bake from the STEP files with `tools/build-cad.mjs`, including the assembled seesaw and the dog's standing pose. The micromanipulator bakes straight from its FreeCAD files (`tools/freecad-assembly.py` reads the assembly; FreeCAD itself isn't needed), and its camera is lined up with the clip's first frame. On the dog, each clip cuts straight to the next with no transition, and scroll footage moves at an even pace so it is in motion from its first frame. The seesaw video cuts between its two shots where the ball and beam sit in the same place. Scroll footage comes from `tools/build-frames.mjs`, videos from `tools/build-video.mjs`. Project photos, graphs, short clips, and list pictures come from `tools/build-media.mjs`.

Pictures and clips for a project (`media` in `data/content.json`) sit in a sideways gallery: scrolling down slides the row across one picture at a time, each holding in the middle with its caption underneath. It sits below an animated project's demo, and is the whole page for projects without one. A clip in it plays while it holds. The gallery's size is `--sw` in `css/site.css`, and the scroll each picture takes is `SLIDE_VH` in `js/projects/work.js`.

- Add `?to=overview` to the address to skip the intro.
- `node draft/tools/build-frames.mjs` re-extracts the video frames, with clip times at the top of the file.
- `node draft/tools/build-cad.mjs [model]` rebuilds the CAD files from the STEP and FreeCAD files.
Both tools need the local `toolkit` folder, plus the source files in Downloads.
