// Stamps the page's styles and scripts with a short code from their contents, so a browser fetches a changed
// file at once instead of reusing its saved copy for up to ten minutes. Run from the repo root before
// publishing: node tools/stamp.mjs
import crypto from 'node:crypto';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel) => crypto.createHash('sha1').update(fs.readFileSync(path.join(root, rel))).digest('hex').slice(0, 8);
const scripts = ['js', 'js/projects'].flatMap((d) => fs.readdirSync(path.join(root, d)).filter((f) => f.endsWith('.js')).map((f) => `${d}/${f}`)).sort();
// Every script import goes through the import map, so each one is asked for under its stamped address.
const map = { three: './lib/three.module.js', ...Object.fromEntries(scripts.map((s) => [`./${s}`, `./${s}?v=${code(s)}`])) };
const file = path.join(root, 'index.html');
let html = fs.readFileSync(file, 'utf8');
html = html.replace(/href="css\/site\.css(\?v=\w+)?"/, `href="css/site.css?v=${code('css/site.css')}"`);
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, `<script type="importmap">${JSON.stringify({ imports: map })}</script>`);
html = html.replace(/src="js\/main\.js(\?v=\w+)?"/, `src="js/main.js?v=${code('js/main.js')}"`);
fs.writeFileSync(file, html);
console.log('stamped', scripts.length, 'scripts and the stylesheet');
