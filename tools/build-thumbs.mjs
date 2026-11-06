// The overview's card pictures for the hardware projects and the protein classifier, each cropped by hand.
// Run from the repo root: node tools/build-thumbs.mjs [id ...]
// The cards' frames run from about square on a laptop to 4:3 on a phone, so each picture is cut a little wider
// than square with its subject in the middle, and the card's cover crop only ever takes a strip of background.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp');
const HOME = os.homedir(), D = `${HOME}/Downloads`, THUMBS = path.join(here, '../media/thumbs'), TOOLKIT = path.join(here, '../toolkit');
const W = 920, H = 800;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'thumbs-'));
const run = (...a) => execFileSync(a[0], a.slice(1), { stdio: ['ignore', 'ignore', 'pipe'] });

// Sources: each returns the path of a full-size image.
const heic = (p) => { const o = path.join(tmp, `${path.basename(p)}.jpg`); run('sips', '-s', 'format', 'jpeg', p, '--out', o); return o; };
const frame = (src, t) => { const o = path.join(tmp, `${path.basename(src)}-${t}.png`); run('ffmpeg', '-v', 'error', '-y', '-ss', String(t), '-i', src, '-frames:v', '1', o); return o; };
// The seesaw was filmed in HDR; macOS converts it to standard video once and build-video.mjs keeps the copy too.
const sdr = (name) => { const o = path.join(TOOLKIT, 'frames', `${name}-sdr.mov`); if (!fs.existsSync(o)) run('avconvert', '-s', `${D}/${name}.MOV`, '-p', 'Preset1920x1080', '-o', o, '--replace'); return o; };
const deckImage = (page, index) => { const pre = path.join(tmp, 'deck'); run('pdfimages', '-j', '-f', String(page), '-l', String(page), `${D}/SRP Micromanipulator Presentation - Lucas Ciordas.pdf`, pre); return `${pre}-${String(index).padStart(3, '0')}.jpg`; };

// `crop` is in the source's pixels. A photo too tall for the card's shape gets `widen`: the frame is filled out
// sideways with the colours down the photo's left edge (here plain wall and table), blended in at the seams.
// A graph sits on white with `margin` around it.
const THUMB = {
  'robot-dog': { src: () => heic(`${D}/maker portfolio b-roll/quadrued pic2.HEIC`), crop: { left: 130, top: 0, width: 3420, height: 2974 } },
  // The beam tipped up towards the servo with the ball rolling back on it, from the clip on the project page.
  'pid-seesaw': { src: () => frame(sdr('IMG_1275'), 4.9), crop: { left: 545, top: 0, width: 1242, height: 1080 } },
  'micromanipulator': { src: () => deckImage(2, 0), crop: { left: 0, top: 0, width: 1536, height: 1820 }, widen: true },
  'ship-in-a-bottle': { src: () => frame(`${D}/old_clips/17_ship_finished_on_books.mp4`, 1.2), crop: { left: 398, top: 0, width: 1242, height: 1080 } },
  // Fig. 3.1 of the protein figures: how long the proteins in each class are.
  'protein-classifier': { src: () => path.join(TOOLKIT, 'sources/protein-figures.png'), crop: { left: 300, top: 1030, width: 1370, height: 860 }, graph: true, margin: 60 },
};

const build = async (id) => {
  const t = THUMB[id], src = t.src();
  const cut = await sharp(src).rotate().extract(t.crop).flatten({ background: '#ffffff' }).png().toBuffer();
  let img;
  if (t.graph) {
    const inner = await sharp(cut).resize(W - 2 * t.margin, H - 2 * t.margin, { fit: 'inside' }).png().toBuffer();
    img = sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite([{ input: inner, gravity: 'centre' }]);
  } else if (t.widen) {
    const h = H, w = Math.round((t.crop.width / t.crop.height) * h);
    const fg = await sharp(cut).resize(w, h).png().toBuffer();
    const edge = await sharp(cut).extract({ left: 0, top: 0, width: 24, height: t.crop.height }).resize(1, H, { fit: 'fill' }).png().toBuffer();
    const bg = await sharp(edge).resize(W, H, { fit: 'fill', kernel: 'nearest' }).blur(6).png().toBuffer();
    // Feather the photo's left and right edges into the blurred fill.
    const f = Math.round(w * 0.08);
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${f / w}" stop-color="#fff"/><stop offset="${1 - f / w}" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
    const feathered = await sharp(fg).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    img = sharp(bg).composite([{ input: feathered, gravity: 'centre' }]);
  } else img = sharp(cut).resize(W, H, { fit: 'cover' });
  await img.webp({ quality: 74, effort: 5 }).toFile(path.join(THUMBS, `${id}.webp`));
  console.log(id);
};

const ids = process.argv.slice(2);
for (const id of ids.length ? ids : Object.keys(THUMB)) await build(id);
fs.rmSync(tmp, { recursive: true, force: true });
