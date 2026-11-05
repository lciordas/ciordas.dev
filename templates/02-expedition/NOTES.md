# Expedition template

A single-page WebGL portfolio. Everything visible is generated in the browser. No images, models, video or audio files are loaded.

- **Fill it in:** edit `content.js`. Nothing else needs to change.
- **Preview:** serve the `templates` folder (`python3 -m http.server`), then open `02-expedition/index.html`.
- **Effects on their own:** `elements.html` shows each module in `elements/`.
- **Add a project:** add an entry to `projects`. Each extra entry adds a crystal section and lengthens the scroll loop. The last entry always uses the ring section.
- **Add a link shape:** add an entry to `links`. `mark` is the short text the particles form, or `null` for the stone form.
- **Jump to a state:** `?skip=1` skips the intro. `?n=18` starts at scroll notch 18. `?nogl=1` shows the text version.

## Feature parity with the source site

Measured at 1440x900 by comparing paired frames at matching scroll positions, using a GPU-backed browser.

| Observed feature | Status | Notes |
| --- | --- | --- |
| Tiny scrambled loader text on flat fog colour | Matched | Hold is 1.5s. The source's 4.4s is its asset download time, which this template does not have. |
| Wire outline and scattered wire triangles fade in | Approximated | Same timing. Triangle layout is random, not the source's mesh. |
| White cap wipes down the dome, revealing stone | Matched | Same order and timing, within about 0.1s. |
| White front spreads across terrain from the base | Approximated | Same timing and shape. The source's front has more volumetric thickness. |
| Camera descends from high angle during load | Matched | Eased to the same resting pose range. |
| Seams ignite, then blocks start lifting | Matched | |
| HUD types on after the reveal | Matched | Scramble glyph set differs. Text is real DOM here, MSDF in WebGL there. |
| Blocks lift, tip and glow near the cursor | Matched | Cursor speed adds energy, decays over about 1.5s. A slow wandering pulse runs when idle. |
| Numbered crosses joined by thin lines on lifted blocks | Matched | |
| Strong camera parallax from cursor position | Matched | |
| Radial plume on the ground by the doorway | Approximated | Procedural streaks. |
| Stone block surface detail | Approximated | Procedural relief. The source uses baked colour and normal maps, which look crisper close up. |
| Snow terrain and mountains | Approximated | Composition is matched. The source uses sculpted baked meshes and textures, so ridges are more detailed there. |
| Drifting snow | Matched | |
| Wheel inertia, endless loop in both directions | Matched | Loop length is 116 wheel notches with the default three projects. |
| Fog wipe from below with prismatic smear and blocky pixels | Approximated | Timing and position are matched. The source's smear refracts through scene geometry, this one is a screen-space pass. |
| HUD drifts upward and erases during the wipe | Matched | |
| Crystals pass bottom to top while rotating | Matched | Speed and rotation follow the measured frames. |
| Crystal material | Approximated | Real refraction buffer, chromatic split, frost, rock chunk. The source has baked textures and a sculpted form inside. |
| Callout labels with leader lines, wire cage, type-on | Matched | Labels clamp to the viewport on phones. |
| Blurred words floating in the fog | Matched | Words come from `content.js`. |
| Fixed dot grid in fog sections | Matched | |
| Click crystal: spectral burst, dark panel, line-by-line text, bracket Close | Matched | Esc also closes. Wheel is locked while open, as on the source. |
| Rings tilt in from below and pass over the camera | Approximated | Size over scroll is fitted to measured frames. Inner rings move in depth to hold the same on-screen ratios. |
| Ring lip glow, sparks, fine web | Approximated | Procedural. The source's glow has more painted texture. |
| Rings as a project with a detail panel | Added | The source has no click target here. Required for the portfolio structure. |
| Top-down descent to platform, then level out | Matched | |
| Stepped platform with rim light and overhead halo | Approximated | Procedural lathe with procedural stone. |
| Point-cloud form turning with scroll | Approximated | Same point style and behaviour. The shape is a neutral stone pile, not the source's character. |
| Arrows and bracket label morph the form into new shapes | Matched | Link marks are text. The source uses logo shapes. |
| Hover on the label makes the lower body unravel, net column appears | Matched | |
| Form drifts up while blocks fly in and assemble, loop closes | Matched | |
| Sound toggle, off by default | Approximated | All sound is synthesised. It will not match the source's composed audio. |
| Pointer cursor over clickable objects | Added | The source's cursor could not be read because its canvas is not reachable from the page. |
| Arrow, Page, Space keys and a hidden text index | Added | Accessibility. |
| Phone layout and touch scrolling | Matched | HUD scale and camera framing follow the source's phone capture. |
| Reduced motion | Added | Skips the intro, smear, scramble and idle motion. |
| No WebGL | Added | Plain text page from `content.js`. |
| Source character, logos, brand copy, baked textures, 3D scans, composed audio | Not replicated | These belong to the site owner. |

## Structure

- `js/main.js`: orchestration, input and HUD.
- `js/timeline.js`: camera keyframes against scroll notches.
- `lib/`: scene pieces shared by the page and the elements.
- `elements/`: one mount function per effect.
