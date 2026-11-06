// The small logos in the overview's intro, all as white shapes so they sit evenly on the dark page.
// Run from the repo root: node draft/tools/build-logos.mjs
// Sources in toolkit/sources: Regis's wordmark from regis.org, Columbia's from Wikimedia Commons (public domain),
// the Summer Science Program's from ssp.org, the NeurIPS logo from neurips.cc, and Lucide's eye-off icon (ISC)
// standing in for the stealth startup, whose own logo isn't public.
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../../toolkit/x.js'));
const sharp = require('sharp');
const SRC = path.join(here, '../../toolkit/sources'), OUT = path.join(here, '../media/logos');
const H = 96;
const LOGOS = { regis: 'regis.svg', columbia: 'columbia.svg', ssp: 'ssp.svg', neurips: 'neurips-logo.svg', stealth: 'eye-off.svg' };
fs.mkdirSync(OUT, { recursive: true });
for (const [name, file] of Object.entries(LOGOS)) {
  let svg = fs.readFileSync(path.join(SRC, file), 'utf8');
  if (name === 'stealth') svg = svg.replace(/stroke-width="2"/, 'stroke-width="1.6"').replace(/width="24"\s+height="24"/, 'width="240" height="240"');
  // Drawn large, trimmed to its edges, then every visible pixel made white.
  const big = await sharp(Buffer.from(svg), { density: 600 }).resize({ height: H * 3, fit: 'inside', withoutEnlargement: false }).ensureAlpha().png().toBuffer();
  const trimmed = await sharp(big).trim({ threshold: 1 }).resize({ height: H }).toBuffer();
  const { width, height } = await sharp(trimmed).metadata();
  const alpha = await sharp(trimmed).extractChannel('alpha').toBuffer();
  const info = await sharp({ create: { width, height, channels: 3, background: '#ffffff' } }).joinChannel(alpha).webp({ quality: 90, alphaQuality: 90 }).toFile(path.join(OUT, `${name}.webp`));
  console.log(name, info.width, 'x', info.height, info.size, 'bytes');
}
