// All sound is synthesised. Nothing plays until the visitor turns it on.
export function createSound() {
  let ctx = null, master, windGain, windFilter, droneGain, enabled = false;
  function boot() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = .985 * b + .015 * w; d[i] = b * 7; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 420; windFilter.Q.value = .7;
    windGain = ctx.createGain(); windGain.gain.value = .22;
    src.connect(windFilter); windFilter.connect(windGain); windGain.connect(master); src.start();
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .07; lg.gain.value = 170; lfo.connect(lg); lg.connect(windFilter.frequency); lfo.start();
    droneGain = ctx.createGain(); droneGain.gain.value = .05; droneGain.connect(master);
    [55, 82.4, 110.3].forEach((f, i) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = [.6, .3, .18][i]; o.connect(g); g.connect(droneGain); o.start(); });
  }
  function blip(freq = 880, dur = .06, vol = .05, type = 'square') {
    if (!enabled || !ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * .5), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
  }
  function whoosh(vol = .22, dur = .9) {
    if (!enabled || !ctx) return;
    const t = ctx.currentTime, len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2800, t + dur * .6);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  return {
    get enabled() { return enabled; },
    toggle() {
      boot(); enabled = !enabled;
      if (ctx.state === 'suspended') ctx.resume();
      master.gain.setTargetAtTime(enabled ? .8 : 0, ctx.currentTime, .25);
      return enabled;
    },
    setSpeed(v) { if (!ctx) return; windFilter.Q.setTargetAtTime(.7 + Math.min(1.6, v * .4), ctx.currentTime, .15); windGain.gain.setTargetAtTime(.2 + Math.min(.45, v * .1), ctx.currentTime, .2); },
    blip, whoosh,
  };
}
