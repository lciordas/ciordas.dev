# Circuit template

A portfolio template with a lime loader, a pointer-painted hero, a pinned horizontal gallery, and a notched footer.

## Fill it in

1. Open `content.js`. All text, links, colors, project lists, and image paths are there.
2. Replace the files in `assets/placeholders/` with your own, or point `content.js` at new paths.
3. To use a real portrait in the hero, set `hero.portrait` and `hero.portraitReveal` to two aligned images with transparent backgrounds.
4. To replace the monogram, change `mark.d` in `content.js`. Keep the shape chunky, because it becomes the loader's reveal hole. Set `mark.focus` to a point inside a stroke.

Wrap a word in `<em>` inside any headline string to set it in the display serif and accent color.

## Preview

Serve the `templates` folder, since browsers block modules on `file://` pages:

```sh
cd templates
python3 -m http.server 8000
```

Then open `http://localhost:8000/03-circuit/`. The pages are `index.html`, `work.html`, and `elements.html`.

## Publish

The pages load libraries from `../_vendor`, so publish `_vendor` alongside this folder. No build step is needed.

## Reuse a single effect

`elements.html` demonstrates each effect with its usage line. Copy the file from `elements/` along with `elements/_core.js`, and load gsap, ScrollTrigger, SplitText, and Lenis on the page. `topo-stage.js` and `float-object.js` also need `js/figure.js` and the three import map.

## Handwritten strokes

`elements/scribble.js` draws generated strokes. Pass your own SVG path to `mountScribble(el, { d, viewBox, width })` to use a real signature.

## Regenerating placeholders

`tools/placeholders.html` renders the placeholder art in the browser. It is only a helper, and you can delete the `tools` folder.
