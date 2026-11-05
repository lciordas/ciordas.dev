# Build notes

Rebuilt from study of the reference site at 1440 x 900 and iPhone 13: computed styles, geometry, transforms sampled along scroll, timing samples, and side-by-side screenshots. All code and art here are original. No source models, photos, fonts, Rive files, shaders, or scripts are used.

## Feature status

| Feature | Status | How it compares |
|---|---|---|
| Fluid rem scale (992 to 1920, phone and tablet tiers) | Matched | Same formula and breakpoints |
| Type sizes, line heights, tracking, variable axes | Matched | Mona Sans is the same family. Display serif is Instrument Serif, standing in for a commercial font, so letterforms differ |
| Palette | Matched | Values read from the source |
| Default easing and durations | Matched | `cubic-bezier(.65,.05,0,1)` at .75s |
| Smooth scrolling | Matched | Lenis with the same lerp and multipliers |
| Lime loader | Approximated | Same sequence and color. The source mark animates in Rive; here it wipes in, then becomes the growing hole |
| Page transition | Approximated | Lime mark grows to fill, then the loader opens the next page. The source's small mark animation is simplified |
| Nav, CTA, and menu buttons, sizes and positions | Matched | Own icons. The source's Rive icon morphs are CSS bar and arrow moves |
| Center mark hides on scroll | Matched | |
| Nav color flips by section | Matched | |
| Scroll position bar on the right edge | Approximated | Same place and size; fades when idle |
| Menu overlay: ellipse wipe, unfolding images and links, tint to color on hover | Matched | Timing fitted to sampled clip values |
| Hero contour lines and pointer-painted patches | Approximated | Same look and behavior from an own feedback shader. Not the same fluid solver, so strokes differ in detail |
| Hero reveal in sliced bands, idle sweep | Approximated | Same concept and rhythm |
| Hero subject | Not replicated | The source uses a photo of a real person and a 3D model. Here a neutral mannequin and patterned shell, replaceable with your images |
| Shell tilts with pointer | Matched | |
| Frame shrink, tint, and theme change on scroll | Matched | Frame size matches the sampled `power2.inOut` curve |
| Marquee rows behind the frame | Matched | Drawn in WebGL, as in the source |
| Signature draws over the frame | Approximated | Own generated stroke, drawn by scroll |
| Next-up card in the hero corner | Matched | Own outline and icons |
| Statement with block line reveal | Matched | Clip and block timing fitted to samples |
| Pinned horizontal gallery | Matched | Same 12 slots, 1:1 travel, same scrub lag |
| Background fade across the gallery | Matched | `power2.out` across the pinned range, fitted to sampled colors |
| Image drift inside frames, tinted images | Matched | Tint here is a CSS duotone, so any image works |
| Two-up panels, slide-in, scribble | Matched | Own scribble |
| Full-bleed image rising over the pinned panels | Matched | |
| Project grid with notched frames, staggered columns, scroll drift | Matched | Own frame path |
| Grid hover: outline draws, alternate image appears | Matched | |
| Curved dark edge flattening on scroll | Matched | |
| Feature collage with layered parallax | Matched | |
| Client marquee with velocity and direction | Approximated | Source uses logo files; here text names |
| Large scribble behind client titles | Approximated | Own "hello" stroke, scrubbed by scroll |
| Oval title reveal | Matched | |
| Card fan: scroll spread, hover lift and push | Matched | Resting transforms from measured values; hover amounts are close estimates |
| Footer gradient and notched card | Matched | Own path, recomputed in pixels |
| Footer figure, signature, marquee, links | Approximated | Placeholder figure and stroke |
| Rolling character hover on buttons and links | Matched | |
| Small animated Rive icons throughout | Not replicated | They need the source's Rive files. Static SVGs stand in |
| 3D models in the source's WebGL layer | Not replicated | The source assets are not reused. Placeholder renders stand in |
| Inner page: giant stats, floating object, table, countdown | Approximated | One page stands in for the source's inner pages. Calendar, partnerships, and legal pages are not built |
| Phone layout | Approximated | Same structure and tap-to-lock reveal. Page runs about a third longer because the gallery images stack larger |
| Tablet | Approximated | Uses the phone layout below 992px |
| Landscape phone blocker | Not replicated | Deliberately left out so the page stays usable |

## Fallbacks

- Reduced motion: no smooth scrolling, no draws or drift, and the gallery stacks vertically. The frame still follows scroll, because the visitor controls it.
- No WebGL: the hero shows a static image, and the rest of the page works normally.
- Crossing the 992px breakpoint reloads the page, since the gallery and panels use different layouts on each side.

## Verified with

Headless Chromium on Apple M5 Pro, at 1440 x 900 and iPhone 13 emulation. Safari, Firefox, and physical phones were not tested.
