// The logos in the overview's intro strip, in their own colours for a dark page.
// Run from the repo root: node draft/tools/build-logos.mjs
// Sources in toolkit/sources: Regis's wordmark from regis.org (its version for dark backgrounds), Columbia's from
// Wikimedia Commons (public domain; navy turned to Columbia blue so it shows on dark), the Summer Science
// Program's from ssp.org, the wide NeurIPS logo from neurips.cc (its dark grey lettering lightened), and LinkedIn's stealth startup badge.
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../../toolkit/x.js'));
const sharp = require('sharp');
const SRC = path.join(here, '../../toolkit/sources'), OUT = path.join(here, '../media/logos');
const H = 120;
const svg = (file, edit = (s) => s) => sharp(Buffer.from(edit(fs.readFileSync(path.join(SRC, file), 'utf8'))), { density: 600 });
// The badge is grey on black: its black becomes see-through, so it sits on the page like the others.
async function badge(file) {
  const { data, info } = await sharp(path.join(SRC, file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const l = Math.max(data[i], data[i + 1], data[i + 2]), a = Math.min(255, Math.max(0, (l - 14) * 4));
    out[j] = data[i]; out[j + 1] = data[i + 1]; out[j + 2] = data[i + 2]; out[j + 3] = a;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
}
const LOGOS = {
  regis: () => svg('regis.svg'),
  columbia: () => svg('columbia.svg', (s) => s.replace(/#000d74/gi, '#b9d9eb')),
  ssp: () => svg('ssp.svg'),
  neurips: () => svg('neurips-wide.svg', (s) => s.replace(/#323539/gi, '#d9d6e0')),
  stealth: () => badge('stealth-badge.jpg'),
};
fs.mkdirSync(OUT, { recursive: true });
for (const [name, make] of Object.entries(LOGOS)) {
  const big = await (await make()).ensureAlpha().png().toBuffer();
  const trimmed = await sharp(big).trim({ threshold: 1 }).png().toBuffer();
  const info = await sharp(trimmed).resize({ height: H, withoutEnlargement: false }).webp({ quality: 90, alphaQuality: 90 }).toFile(path.join(OUT, `${name}.webp`));
  console.log(name, info.width, 'x', info.height, info.size, 'bytes');
}
