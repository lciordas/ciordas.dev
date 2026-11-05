# Portfolio templates

Three self-contained site templates. Each runs as static files with no build step.

| Folder | Style | Live path |
|---|---|---|
| `01-monolith` | Full-screen 3D project carousel around a stone | `/templates/01-monolith/` |
| `02-expedition` | Scroll-driven 3D flight through scenes | `/templates/02-expedition/` |
| `03-circuit` | Editorial scrolling page with layered reveals | `/templates/03-circuit/` |

## Filling one in

Edit that template's `content.js`. It holds the text, links, project lists, colors, and image paths.

## Reusing an effect

Each template has an `elements/` folder with one file per effect, and an `elements.html` page that demos them with a usage note.

## Before using one as a real portfolio

- Each `NOTES.md` lists what is matched, approximated, or missing compared with the design it studied.
- These closely follow other people's published designs, so change the design enough to make it your own.
- Remove the `robots` tag from the page when you want search engines to list it.

## Tabs

`switcher.js` draws the small tabs on the right edge of every page. Edit its `TABS` list to change them.
