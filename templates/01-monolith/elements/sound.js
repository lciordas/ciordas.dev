// sound: a speaker icon whose waves and cross draw themselves, and a small generated
// soundscape. Nothing plays until the visitor's first click or key press.
const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="speaker" d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z"/><path class="wave wave-1" pathLength="1" d="M15.4 9.1a4 4 0 0 1 0 5.8"/><path class="wave wave-2" pathLength="1" d="M17.8 6.6a7.4 7.4 0 0 1 0 10.8"/><path class="cross cross-1" pathLength="1" d="M16 9.6l5 4.8"/><path class="cross cross-2" pathLength="1" d="M21 9.6l-5 4.8"/></svg>`;

export function mountSound(button, options = {}) {
  const { startOn = true, volume = 0.5 } = options;
  button.innerHTML = ICON;
  let on = startOn, ctx = null, master = null;
  const render = () => {
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.setAttribute('aria-label', on ? 'Mute sound' : 'Unmute sound');
    if (ctx) master.gain.setTargetAtTime(on ? volume : 0, ctx.currentTime, 0.25);
  };
  const noiseBuffer = () => {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  };
  let noise;
  const boot = () => {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    noise = noiseBuffer();
    // Wind
    const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 180; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    n.connect(f); f.connect(g); g.connect(master); n.start();
    // Drone
    [55, 82.4, 110.3].forEach((hz, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz; o.detune.value = i * 3;
      const og = ctx.createGain(); og.gain.value = 0.045 / (i + 1);
      o.connect(og); og.connect(master); o.start();
    });
    render();
  };
  const once = () => { boot(); removeEventListener('pointerdown', once); removeEventListener('keydown', once); };
  addEventListener('pointerdown', once); addEventListener('keydown', once);
  button.addEventListener('click', () => { boot(); on = !on; ctx?.resume(); render(); });
  render();
  const hit = (freq = 900, q = 1.5, dur = 0.12, gain = 0.12) => {
    if (!ctx || !on) return;
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  };
  const tone = (freq, dur = 0.6, gain = 0.06) => {
    if (!ctx || !on) return;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq; o.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + dur);
    const g = ctx.createGain(); const t = ctx.currentTime; g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  };
  return {
    tick: () => hit(1700, 5, 0.05, 0.05),
    crack: () => hit(2400, 2, 0.16, 0.08),
    shatter: () => { hit(500, 0.6, 0.7, 0.26); hit(2600, 1.2, 0.42, 0.14); tone(120, 0.8, 0.14); },
    reform: () => { hit(800, 0.8, 0.4, 0.14); tone(170, 0.5, 0.08); },
    get isOn() { return on; },
  };
}
