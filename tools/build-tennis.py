# The tennis library's clip: one match simulated with tennis-lab (github.com/lciordas/tennis-lab), drawn point by point.
# The top chart is Player 1's chance of winning the match, from serve-win estimates updated with Bayesian statistics
# after every point (and, for comparison, from the fixed priors); the bottom chart is each point's importance, the
# difference between that chance if Player 1 wins the point and if he loses it (calcPointImportance in examples/7).
# Both come from tennis-lab's exact match probabilities. Run from the repo root with tennis-lab and matplotlib,
# scipy, fonttools and brotli installed in the same Python:
#   python tools/build-tennis.py
# The simulated match is saved to toolkit/sources/tennis-match.json, so later runs only redraw it (and don't need
# tennis-lab). The highlight is the site palette's: PALETTE=e python tools/build-tennis.py draws match-e.mp4 in palette e.
# Exact probabilities are slow from scratch, so tennis-lab's scripts/cache-prob-win-{game,tiebreak,set,match}.py
# should be run first (a grid over 0.5-0.8 is plenty for the serve-win values used here).
import json, os, random, re, subprocess, tempfile
import numpy as np
import matplotlib
matplotlib.use('Agg')
from matplotlib import font_manager as fm, pyplot as plt
from matplotlib.patches import Rectangle
from fontTools.ttLib import TTFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PALETTE_JS = open(os.path.join(ROOT, 'js/palette.js')).read()
DEFAULT = re.search(r"DEFAULT_PALETTE = '(\w+)'", PALETTE_JS).group(1)
KEY = os.environ.get('PALETTE') or DEFAULT
ACCENT = re.search(r"\n  " + KEY + r": \{\s*name: '[^']*', accent: '(#[0-9a-f]{6})'", PALETTE_JS).group(1)
OUT = os.path.join(ROOT, 'media/projects/tennis-simulation', 'match.mp4' if KEY == DEFAULT else f'match-{KEY}.mp4')
DATA = os.path.join(ROOT, 'toolkit/sources/tennis-match.json')
SEED = 64  # a close three-set match that ends in a final-set tiebreak

# Same model as examples/6 and 7: true serve-win probabilities generate the points, Beta priors are updated after each.
P1actual, P2actual = 0.66, 0.62
P1prior, alpha1, P2prior, alpha2 = 0.62, 100.0, 0.62, 100.0
if not os.path.exists(DATA):
    from tennis_lab.core.match import Match
    from tennis_lab.core.match_format import MatchFormat
    from tennis_lab.paths.match_probability import probabilityP1WinsMatch
    fmt = MatchFormat(bestOfSets=3)

def pwin(score, server, p1, p2):
    return float(probabilityP1WinsMatch(score, server, [p1], p2)[0])

def importance(match, p1, p2):  # calcPointImportance from examples/7, with the current estimates
    out = []
    for w in (1, 2):
        m = Match(match.servesNext, fmt, match.score)
        m.recordPoint(w)
        out.append(1.0 if (m.isOver and m.winner == 1) else 0.0 if m.isOver else pwin(m.score, m.servesNext, p1, p2))
    return out[0] - out[1]

def board(match):
    done = [s.score.games(1) for s in match.setHistory]
    cur, pts = None, None
    if match.currentSet is not None:
        cur = match.currentSet.score.games(1)
        if match.currentSet.currentGame is not None:
            pts = [x.replace('ad', 'AD') for x in match.currentSet.currentGame.score.asTraditional(1).split('-')]
        elif match.currentSet.tiebreaker is not None:
            pts = list(match.currentSet.tiebreaker.score.asPoints(1))
    return {'sets': [list(g) for g in done], 'games': list(cur) if cur else None, 'points': pts}

def simulate(seed):
    random.seed(seed)
    beta1 = ((1 - P1prior) * alpha1 + 2 * P1prior - 1) / P1prior
    beta2 = ((1 - P2prior) * alpha2 + 2 * P2prior - 1) / P2prior
    a1, b1, a2, b2 = alpha1, beta1, alpha2, beta2
    P1postr, P2postr = P1prior, P2prior
    match = Match(playerServing=1, matchFormat=fmt)
    rows = []
    while True:
        server = match.servesNext
        row = {'server': server, 'board': board(match),
               'dyn': pwin(match.score, server, P1postr, P2postr), 'static': pwin(match.score, server, P1prior, P2prior),
               'imp': importance(match, P1postr, P2postr), 'p1est': P1postr, 'p2est': P2postr}
        won = random.random() < (P1actual if server == 1 else P2actual)
        p1Won = (server == 1) == won
        row['p1won'] = p1Won
        rows.append(row)
        match.recordPoint(1 if p1Won else 2)
        if server == 1:
            if p1Won: a1 += 1
            else: b1 += 1
            P1postr = (a1 - 1) / (a1 + b1 - 2)
        else:
            if p1Won: b2 += 1
            else: a2 += 1
            P2postr = (a2 - 1) / (a2 + b2 - 2)
        if match.isOver: break
    final = {'board': board(match), 'winner': match.winner}
    return {'points': rows, 'final': final}


# The site's fonts, unpacked for matplotlib.
tmp = tempfile.mkdtemp()
def font(name):
    t = TTFont(os.path.join(ROOT, 'fonts', name + '.woff2')); t.flavor = None
    p = os.path.join(tmp, name + '.ttf'); t.save(p); fm.fontManager.addfont(p)
    return fm.FontProperties(fname=p)
BODY, MED, HEAD = font('hanken-grotesk-latin-400-normal'), font('hanken-grotesk-latin-500-normal'), font('barlow-condensed-latin-900-normal')

BG, INK, GLOW = '#171513', '#f4efe8', ACCENT
MUTED, DIM, FAINT, GRID = (0.957, 0.937, 0.91, 0.55), (0.957, 0.937, 0.91, 0.38), (0.957, 0.937, 0.91, 0.28), (0.957, 0.937, 0.91, 0.08)
W, H, FPS = 1600, 900, 30
PTS_PER_S, HOLD_S, FADE_S = 13.0, 2.6, 0.6

if os.path.exists(DATA): d = json.load(open(DATA))
else:
    d = simulate(SEED); os.makedirs(os.path.dirname(DATA), exist_ok=True); json.dump(d, open(DATA, 'w'))
pts = d['points']; N = len(pts)
win = np.array([p['dyn'] for p in pts] + [1.0 if d['final']['winner'] == 1 else 0.0])
stat = np.array([p['static'] for p in pts] + [win[-1]])
imp = np.array([p['imp'] for p in pts])
# Where each set starts, in points.
starts, prev = [], 0
for i, p in enumerate(pts):
    n = len(p['board']['sets'])
    if n > prev: starts.append(i); prev = n

plt.rcParams.update({'savefig.facecolor': BG, 'figure.facecolor': BG, 'axes.facecolor': BG, 'text.color': INK,
                     'axes.edgecolor': FAINT, 'xtick.color': MUTED, 'ytick.color': MUTED})
fig = plt.figure(figsize=(W / 100, H / 100), dpi=100)
L, R = 0.09, 0.955
axW = fig.add_axes([L, 0.37, R - L, 0.39])
axI = fig.add_axes([L, 0.095, R - L, 0.2], sharex=axW)
xmax = N + 9
for ax in (axW, axI):
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
    ax.spines['left'].set_color(FAINT); ax.spines['bottom'].set_color(FAINT)
    ax.tick_params(length=0, pad=8)
    for t in ax.get_xticklabels() + ax.get_yticklabels(): t.set_fontproperties(BODY); t.set_fontsize(15)
    ax.grid(True, axis='y', color=GRID, lw=1)
    ax.set_xlim(-1, xmax)
axW.set_ylim(-0.02, 1.02); axW.set_yticks([0, .25, .5, .75, 1]); axW.set_yticklabels(['0%', '25%', '50%', '75%', '100%'], fontproperties=BODY, fontsize=18)
axW.axhline(0.5, color=FAINT, lw=1, ls=(0, (4, 4)))
plt.setp(axW.get_xticklabels(), visible=False)
top = max(0.25, np.ceil(imp.max() / 0.05) * 0.05)
axI.set_ylim(0, top); axI.set_yticks(np.arange(0, top + 1e-9, 0.1)); axI.set_yticklabels([f'{v:.1f}' for v in np.arange(0, top + 1e-9, 0.1)], fontproperties=BODY, fontsize=18)
axI.set_xticks(range(0, N + 1, 25)); [t.set_fontproperties(BODY) or t.set_fontsize(15) for t in axI.get_xticklabels()]
axI.set_xlabel('Point', fontproperties=BODY, fontsize=18, color=MUTED, labelpad=6)
lab = dict(fontproperties=HEAD, fontsize=22, color=MUTED, ha='left', va='bottom')
fig.text(L, 0.775, 'P(PLAYER 1 WINS MATCH)', **lab)
fig.text(L, 0.305, 'POINT IMPORTANCE', **lab)
setArts = []
for s, i in enumerate(starts, start=2):
    setArts.append((i, [ax.axvline(i, color=FAINT, lw=1) for ax in (axW, axI)] + [axW.text(i + 1.2, 0.985, f'SET {s}', fontproperties=HEAD, fontsize=18, color=MUTED, va='top')]))
axW.text(0.2, 0.985, 'SET 1', fontproperties=HEAD, fontsize=18, color=MUTED, va='top')

lStat, = axW.plot([], [], color=DIM, lw=1.6, solid_capstyle='round')
lWin, = axW.plot([], [], color=GLOW, lw=2.8, solid_capstyle='round', solid_joinstyle='round')
head, = axW.plot([], [], 'o', ms=9, color=GLOW, mec=BG, mew=2)
headTxt = axW.text(0, 0, '', fontproperties=MED, fontsize=19, color=GLOW, va='center')
# Bars shade from the muted ink to the glow as a point matters more.
def shade(v):
    t = min(1.0, v / 0.25) ** 0.8; a, b = np.array([0.957, 0.937, 0.91]), np.array(matplotlib.colors.to_rgb(GLOW))
    return tuple(a + (b - a) * t) + (0.35 + 0.65 * t,)
bars = [Rectangle((i + 0.1, 0), 0.8, 0, color=shade(imp[i]), lw=0) for i in range(N)]
for b in bars: axI.add_patch(b)
# Legend, under the scoreboard on the left.
fig.text(L + 0.36, 0.925, '—', fontproperties=MED, fontsize=22, color=GLOW, va='center')
fig.text(L + 0.385, 0.925, 'Bayesian estimate', fontproperties=BODY, fontsize=18, color=INK, va='center')
fig.text(L + 0.36, 0.885, '—', fontproperties=MED, fontsize=22, color=DIM, va='center')
fig.text(L + 0.385, 0.885, 'Fixed prior', fontproperties=BODY, fontsize=18, color=MUTED, va='center')
est = fig.text(R, 0.885, '', fontproperties=BODY, fontsize=18, color=MUTED, ha='right', va='center')
fig.text(R, 0.925, 'SERVE-WIN ESTIMATES', fontproperties=HEAD, fontsize=18, color=MUTED, ha='right', va='center')

# Scoreboard: completed sets, then current set's games, then points.
sb = {}
COLS = [0.0, 0.13, 0.17, 0.21, 0.275]  # name, set1..3, points (offsets from L)
for r, (y, name) in enumerate(((0.925, 'PLAYER 1'), (0.865, 'PLAYER 2'))):
    sb[r, 'name'] = fig.text(L + 0.012, y, name, fontproperties=HEAD, fontsize=29, color=INK, va='center')
    sb[r, 'serve'] = fig.add_artist(plt.Line2D([L - 0.002], [y], marker='o', ms=8, color=GLOW, lw=0))
    for c in range(3): sb[r, c] = fig.text(L + COLS[1 + c], y, '', fontproperties=MED, fontsize=27, color=INK, va='center', ha='center')
    sb[r, 'pts'] = fig.text(L + COLS[4], y, '', fontproperties=MED, fontsize=27, color=GLOW, va='center', ha='center')
fig.add_artist(plt.Line2D([L + COLS[4] - 0.035, L + COLS[4] - 0.035], [0.845, 0.945], color=FAINT, lw=1))

def setBoard(state, server):
    sets = state['sets'] + ([state['games']] if state['games'] else [])
    for r in range(2):
        for c in range(3):
            if c < len(sets):
                g = sets[c][r]; done = c < len(state['sets'])
                sb[r, c].set_text(str(g)); sb[r, c].set_color(INK if (not done or sets[c][r] > sets[c][1 - r]) else '#8f8a84')
            else: sb[r, c].set_text('')
        sb[r, 'pts'].set_text(str(state['points'][r]) if state['points'] else '')
        sb[r, 'serve'].set_visible(server == r + 1)

play = int(np.ceil(N / PTS_PER_S * FPS)); hold = int(HOLD_S * FPS); fade = int(FADE_S * FPS)
ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '26', '-preset', 'slow',
                       '-movflags', '+faststart', OUT], stdin=subprocess.PIPE)
for f in range(play + hold + fade):
    k = min(N, f / FPS * PTS_PER_S)          # points played so far, fractional
    n = int(k); fr = k - n
    xs = np.arange(n + 1, dtype=float); ys = win[:n + 1].copy(); ss = stat[:n + 1].copy()
    if n < N and fr > 0:
        xs = np.append(xs, k); ys = np.append(ys, win[n] + (win[n + 1] - win[n]) * fr); ss = np.append(ss, stat[n] + (stat[n + 1] - stat[n]) * fr)
    lWin.set_data(xs, ys); lStat.set_data(xs, ss)
    head.set_data([xs[-1]], [ys[-1]])
    headTxt.set_position((xs[-1] + 1.6, ys[-1])); headTxt.set_text(f'{ys[-1] * 100:.0f}%')
    for i, b in enumerate(bars):
        g = 0 if i + 1 > k + 1 else min(1.0, (k - i + 1))   # grows in over one point
        b.set_height(imp[i] * max(0.0, g))
    for i, arts in setArts:
        for art in arts: art.set_visible(k >= i)
    state = d['final']['board'] if n >= N else pts[n]['board']
    setBoard(state, None if n >= N else pts[n]['server'])
    p = pts[min(n, N - 1)]
    est.set_text(f"P1 {p['p1est'] * 100:.1f}%    P2 {p['p2est'] * 100:.1f}%")
    a = 1.0 if f < play + hold else 1 - (f - play - hold + 1) / fade
    for art in [lWin, lStat, head, headTxt]: art.set_alpha(matplotlib.colors.to_rgba(art.get_color())[3] * a)
    for i, b in enumerate(bars): b.set_alpha(shade(imp[i])[3] * a)
    for key, art in sb.items():
        if key[1] in (0, 1, 2, 'pts'): art.set_alpha(a)
    fig.canvas.draw()
    ff.stdin.write(fig.canvas.buffer_rgba().tobytes())
ff.stdin.close(); ff.wait()
print(OUT, N, 'points,', round((play + hold + fade) / FPS, 1), 's')
