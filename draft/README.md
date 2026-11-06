# Draft site

Lucas's own site, in progress. So far it holds only the opening sequence and a placeholder portfolio page.

## The intro

1. The name's outlines trace themselves with a soft glow (`js/trace.js`).
2. Render windows pop open, then a block wipe reveals the 3D name (`js/render-windows.js`, `js/film-post.js`).
3. The letters float on springs and nudge every few seconds to invite a click (`js/name.js`).
4. Clicking cracks the name from that point and bursts it into shards (`js/name.js`, timed in `js/main.js`). A prompt at the bottom takes one step per scroll gesture, swipe, tap, or down-arrow press: during the intro ("Scroll to skip") it jumps straight to the name, and on the name ("Scroll") it breaks it from the middle.

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

After the name shatters, the overview page is underneath it. Its first screen is about Lucas: the name large at the top centre with GitHub, LinkedIn and email icons, the intro (`site.intro`; the first sentence and any **double-asterisked** words are bold), a row of logos that slides past in a loop (`site.logos`, from `tools/build-logos.mjs`), and Experience, Research (`research` in `data/content.json`, papers that open like projects) and Honors on their own lines. The projects peek up from the bottom. Scrolling glides the name into a bar at the top left, and the hardware and software panels fill the screen below it. Other projects are hidden for now (`showExtras`). The ship's build video is cut from his long-form video by `tools/build-ship.mjs`. Card pictures come from `tools/build-media.mjs`, except the NeurIPS paper's cover, which `tools/build-paper.mjs` draws along with its title and programme slides (NeurIPS logo from neurips.cc; Sydney photo by Benh Lieu Song, CC BY-SA 4.0, credited in the caption). Arrow keys and Enter work as well as the mouse. Scrolling down from it walks through every project. Choosing one opens that project alone, right below the overview, so scrolling back up returns to the overview; Esc and the Overview button also go back. Project addresses look like `/draft/#robot-dog` and skip the intro.

The words and the overview's look live in `data/content.json`. Edit them in the Editor tab (`/draft/edit/`): type on the preview, changes save in that browser, and Publish commits the file through GitHub using your own token.

Animated projects sit in a rounded window on the left, with the project's bullets in a column on the right: all of them always showing, the one for what's on screen lit (`captions` in `data/content.json`, timed by `copyAt` in `ANIMATED`). The model is drawn shifted to match the window. CAD parts float at random across the whole screen, then assemble in the window as you scroll. A light line wipes from CAD to footage, which then plays as a video. A caption can follow the scroll or the video's own time. Their timing and camera angles are in `ANIMATED` in `js/projects/work.js`, the window's size is `--rw` in `css/site.css`. Models bake from the STEP files with `tools/build-cad.mjs`, including the assembled seesaw and the dog's standing pose. The micromanipulator bakes straight from its FreeCAD files (`tools/freecad-assembly.py` reads the assembly; FreeCAD itself isn't needed), and its camera is lined up with the clip's first frame. The dog's video is its four shots (side on, front three-quarter, head on, walking) joined with hard cuts, each caption showing during its own shot. The seesaw video comes from the raw recordings (converted from HDR by macOS `avconvert`) and cuts between its two shots where the ball sits in the same place. Videos come from `tools/build-video.mjs`; the dog's first two shots are steadied into frames by `tools/build-frames.mjs` first. Project photos, graphs, short clips, and list pictures come from `tools/build-media.mjs`.

Pictures and clips for a project (`media` in `data/content.json`) sit in a sideways gallery on the left two thirds of the screen, with each picture's caption on the right and the project's heading and description above, all on one screen; the pictures size themselves to the room left. Scrolling down slides the row across one picture at a time, each holding still for a while; scrolling sideways, the left and right arrow keys, the arrow buttons, or clicking the next picture also move it. It sits below an animated project's demo, and is the whole page for projects without one. A clip in it plays while it holds. The gallery's size is `--sw` in `css/site.css`, and the scroll each picture takes is `SLIDE_VH` in `js/projects/work.js`.

- Add `?to=overview` to the address to skip the intro.
- `node draft/tools/stamp.mjs` before publishing: stamps the stylesheet and scripts in `index.html` with codes from their contents, so visitors get changes at once rather than a copy saved for up to ten minutes.
- `node draft/tools/build-frames.mjs`, then `node draft/tools/build-video.mjs dog-walk` and `node draft/tools/build-video.mjs dog`, rebuild the dog's video (steadied frames go in the local `toolkit/frames`). Clip times are at the top of each file.
- `node draft/tools/build-cad.mjs [model]` rebuilds the CAD files from the STEP and FreeCAD files.
Both tools need the local `toolkit` folder, plus the source files in Downloads.
