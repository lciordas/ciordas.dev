// Gathers project photos, graphs, short clips and list thumbnails into media/projects and media/thumbs.
// Run from the repo root: node tools/build-media.mjs
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../toolkit/x.js'));
const sharp = require('sharp');
const D = `${os.homedir()}/Downloads`, OLD = `${D}/old_clips`, BROLL = `${D}/maker portfolio b-roll`, MAKER = `${D}/maker_portfolio_v1.mp4`;
const DECK = `${D}/SRP Micromanipulator Presentation - Lucas Ciordas.pdf`;
const OUT = path.join(here, '../media/projects'), THUMBS = path.join(here, '../media/thumbs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'media-'));
const run = (...a) => execFileSync(a[0], a.slice(1), { stdio: ['ignore', 'ignore', 'pipe'] });
let n = 0;
const temp = (ext) => path.join(tmp, `${n++}.${ext}`);

// Sources: each returns the path of a full-size image.
const file = (p) => p;
// Clips filmed upright came with black bars, so those are trimmed off.
const frame = (src, t) => { const o = temp('png'), raw = temp('png'); run('ffmpeg', '-v', 'error', '-y', '-ss', String(t), '-i', src, '-frames:v', '1', raw); return sharp(raw).trim({ threshold: 18 }).toFile(o).then(() => o); };
const heic = (p) => { const o = temp('jpg'); run('sips', '-s', 'format', 'jpeg', p, '--out', o); return o; };
const deckImage = (page, index) => { const pre = path.join(tmp, `deck${n++}`); run('pdfimages', '-j', '-f', String(page), '-l', String(page), DECK, pre); return `${pre}-${String(index).padStart(3, '0')}.jpg`; };

// Outputs.
const still = async (id, name, src, { width = 1280, trim = false, flat = false, crop = null } = {}) => {
  const dir = path.join(OUT, id); fs.mkdirSync(dir, { recursive: true });
  let img = sharp(src).rotate();
  if (crop) img = sharp(await img.extract(crop).png().toBuffer());
  if (flat) img = img.flatten({ background: '#ffffff' });
  if (trim) img = sharp(await img.png().toBuffer()).trim({ threshold: 12 });
  await img.resize({ width, withoutEnlargement: true }).webp({ quality: 76, effort: 5 }).toFile(path.join(dir, `${name}.webp`));
};
const clip = (id, name, src, ss, t, vf = 'scale=960:-2') => {
  const dir = path.join(OUT, id); fs.mkdirSync(dir, { recursive: true });
  run('ffmpeg', '-v', 'error', '-y', ...(ss ? ['-ss', String(ss)] : []), ...(t ? ['-t', String(t)] : []), '-i', src, '-an', '-vf', `fps=30,${vf},pad=ceil(iw/2)*2:ceil(ih/2)*2`, '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '26', '-preset', 'slow', '-movflags', '+faststart', path.join(dir, `${name}.mp4`));
};
// The overview's project cards. Photos fill a square; graphs fit inside it on white so nothing is cut off.
const thumb = async (id, src, { position = 'centre', flat = false, crop = null } = {}) => {
  fs.mkdirSync(THUMBS, { recursive: true });
  let img = sharp(src).rotate();
  if (crop) img = sharp(await img.extract(crop).png().toBuffer());
  if (flat) img = img.flatten({ background: '#ffffff' });
  await img.resize(840, 840, flat ? { fit: 'contain', background: '#ffffff' } : { fit: 'cover', position }).webp({ quality: 72, effort: 5 }).toFile(path.join(THUMBS, `${id}.webp`));
};

// Hardware.
const dogPic = heic(`${BROLL}/quadrued pic2.HEIC`);
await thumb('robot-dog', dogPic);
await thumb('pid-seesaw', await frame(MAKER, 24.2));
await still('robot-dog', 'side', dogPic, { width: 1600 });
await still('robot-dog', 'front', heic(`${BROLL}/quadrupedpic1.HEIC`), { width: 1600 });
await still('robot-dog', 'quarter', heic(`${BROLL}/quadrued pic3.HEIC`), { width: 1600 });
await still('robot-dog', 'legs', await frame(`${OLD}/14_dog_leg_designs_graphic.mp4`, 2), { width: 1600 });
await still('robot-dog', 'sketches', await frame(`${OLD}/12_dog_leg_sketches.mp4`, 1), { width: 1600 });
clip('robot-dog', 'leg-test', `${OLD}/15_dog_leg_prototype_test.mp4`, 0, 0, 'scale=1280:-2');
clip('robot-dog', 'prototype', `${OLD}/16_dog_robot_moving.mp4`, 0, 0, 'scale=1280:-2');
clip('pid-seesaw', 'lego', `${OLD}/03_seesaw_lego_ball_balancing.mp4`, 0, 0, 'scale=1280:-2');
await still('pid-seesaw', 'lego-arduino', await frame(`${OLD}/05_seesaw_lego_with_arduino.mp4`, 1.5), { width: 1600 });
clip('pid-seesaw', 'wood', `${OLD}/06_seesaw_v2_wood_poke_test.mp4`, 0, 0, 'scale=1280:-2');

const microPhoto = deckImage(2, 0);
await still('micromanipulator', 'assembly', microPhoto, { width: 900 });
await still('micromanipulator', 'microstepping', `${D}/microstepping_comparison.png`, { width: 1400, flat: true });
await still('micromanipulator', 'encoder', await frame(`${OLD}/39_encoder_magnet_board.mp4`, 0.8), { width: 900 });
await still('micromanipulator', 'bench', await frame(`${OLD}/35_stepper_breadboard_pico_vertical.mp4`, 2), { width: 900 });
await thumb('micromanipulator', microPhoto);

const shipDone = await frame(`${OLD}/17_ship_finished_on_books.mp4`, 1.2);
// The ship and most of the bottle, 16:9, cut from the untrimmed frame.
const shipRaw = temp('png'); run('ffmpeg', '-v', 'error', '-y', '-ss', '1.2', '-i', `${OLD}/17_ship_finished_on_books.mp4`, '-frames:v', '1', shipRaw);
await still('ship-in-a-bottle', 'finished', shipRaw, { width: 1000, crop: { left: 330, top: 130, width: 1150, height: 646 } });
// The ship's build video comes from build-ship.mjs.
await thumb('ship-in-a-bottle', shipRaw, { crop: { left: 410, top: 0, width: 1000, height: 1000 } });

// Other projects: one photo each.
const ev = await frame(`${OLD}/11_ev_closeup.mp4`, 1.4);
const cannon = await frame(`${OLD}/28_cannon_closeup_vertical.mp4`, 2);
await still('other', 'electric-vehicle', ev, { width: 640 });
await still('other', 'cannon', cannon, { width: 640 });

// Software.
const board = await frame(`${OLD}/46_chess_board_game.mp4`, 2.5);
clip('chess-engine', 'game', `${OLD}/46_chess_board_game.mp4`);
await still('chess-engine', 'minimax', await frame(`${OLD}/45_chess_minimax_diagram.mp4`, 0.5), { width: 1000 });
await still('chess-engine', 'code', await frame(`${OLD}/44_chess_code_editor.mp4`, 1.5), { width: 1200 });
await thumb('chess-engine', board);

const EG = `${D}/evograd_networks`;
for (const [name, f] of [['xor', 'xor_network'], ['sine', 'sine_regression_network'], ['damped-sine', 'damped_sine_network']]) await still('hybrid-networks', name, `${EG}/${f}.png`, { width: 1400, flat: true });
await thumb('hybrid-networks', `${EG}/xor_network.png`, { flat: true });

const T = `${D}/tennis_`;
for (const [name, f] of [['win-probability', 'bayesian_win_prob_evolution_static_vs_bayesian'], ['match-importance', 'point_importance_importance_during_one_match'], ['serve', 'point_importance_serve_win_prob_vs_importance_logistic'], ['distribution', 'point_importance_importance_distribution_all_scores_bo5'], ['top-points', 'point_importance_top100_most_important_points_bo5']]) await still('tennis-simulation', name, `${T}${f}.png`, { width: 1400, flat: true });
await thumb('tennis-simulation', `${T}bayesian_win_prob_evolution_static_vs_bayesian.png`, { flat: true });

const poster = await frame(`${OLD}/49_svm_poster_closeup.mp4`, 1.2);
await still('protein-classifier', 'poster', poster, { width: 1000 });
await still('protein-classifier', 'notebook', await frame(`${OLD}/47_svm_jupyter_notebook_plots.mp4`, 3), { width: 1200 });
await thumb('protein-classifier', poster);

// Figures from the papers, leaving out the first pages with everyone's addresses.
// The NeurIPS paper's cover and slides, its figures included, come from build-paper.mjs.
// The asteroid paper's slide and overview card come from build-ssp.mjs.

fs.rmSync(tmp, { recursive: true, force: true });
const total = (d) => fs.readdirSync(d, { recursive: true }).reduce((a, f) => { const p = path.join(d, f); return a + (fs.statSync(p).isFile() ? fs.statSync(p).size : 0); }, 0);
console.log('projects MB', (total(OUT) / 1e6).toFixed(1), 'thumbs KB', (total(THUMBS) / 1e3).toFixed(0));
