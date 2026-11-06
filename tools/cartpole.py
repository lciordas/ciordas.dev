"""Runs EvoGrad's CartPole example and records what tools/build-cartpole.mjs draws.

Evolves controllers for Gymnasium's CartPole-v1 the way examples/gymnasium/Gymnasium.ipynb in lciordas/evograd does
(same config file and overrides, all cores), keeping the fittest network of every generation. A run stops once a network
scores 495 over its 3 episodes, which doesn't guarantee it balances from every start, so the example is run five times
and the run whose final network does best from 100 seeded starts is kept. Its champions that improve on every earlier
one (averaged over those starts) are then played from one shared start, chosen so each lasts about its average.
Writes toolkit/sources/cartpole.json: every run's summary, the kept run's per-generation history and tests, and the
shown champions' networks and episodes, step by step.

Setup, once (Python 3.13: on 3.14 EvoGrad's parallel evaluation fails, since itertools.count no longer pickles):
  gh repo clone lciordas/evograd <dir>/evograd
  python3.13 -m venv <dir>/venv
  <dir>/venv/bin/pip install -r <dir>/evograd/requirements.txt gymnasium
Run from the repo root:
  <dir>/venv/bin/python tools/cartpole.py <dir>/evograd
then node tools/build-cartpole.mjs. Evolution is random, so each run differs; the one shown is the one last recorded.
"""
import json, os, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVOGRAD = os.path.abspath(sys.argv[1])
OUT = os.path.join(ROOT, 'toolkit/sources/cartpole.json')
GYM = os.path.join(EVOGRAD, 'examples/gymnasium')
sys.path.insert(0, os.path.join(EVOGRAD, 'src')); sys.path.insert(0, GYM)
os.chdir(GYM)  # the notebook loads its config from here

import numpy as np
import gymnasium as gym
from evograd.run import Config
from trial_cartpole import Trial_CartPole

class Recorded(Trial_CartPole):
    """The example's trial, also keeping each generation's fittest network (pruned, as the notebook plays it)."""
    def _reset(self):
        self.champions, self.history = [], []
        return super()._reset()
    def _generation_report(self):
        best = self._population.get_fittest_individual()
        fits = [i.fitness for i in self._population.individuals]
        pruned = best.prune()
        self.champions.append(pruned)
        self.history.append(dict(gen=self._generation_counter, max=round(float(best.fitness), 2), mean=round(float(np.mean(fits)), 2),
                                 species=len(self._population._species_manager.species),
                                 hidden=int(pruned._network.number_nodes - config.num_inputs - config.num_outputs),
                                 connections=int(pruned._network.number_connections_enabled)))
    def _final_report(self):
        pass

# The notebook's configuration. Its num_episodes_average = 1000 sets an attribute Config never reads, so each network
# is still scored over the .ini's 3 episodes.
config = Config('config_gymnasium.ini')
config.position_penalty_coeff = 100
config.num_episodes_average = 1000
config.fitness_threshold = 495
env = gym.make('CartPole-v1')  # 500-step episodes, 50 steps a second
act = lambda net, obs: int(np.argmax(net._network.forward_pass(obs.tolist())))

def episode(net, seed):
    """One episode from a seeded start: the observation (cart position and velocity, pole angle and angular velocity)
    before every step, the action taken on it (0 push left, 1 push right), the final observation, and how it ended."""
    obs, _ = env.reset(seed=seed)
    observed, actions, done = [], [], False
    while not done:
        a = act(net, obs)
        observed.append([round(float(v), 5) for v in obs]); actions.append(a)
        obs, _, terminated, truncated, _ = env.step(a)
        done = terminated or truncated
    observed.append([round(float(v), 5) for v in obs])
    end = 'limit' if not terminated else ('track' if abs(obs[0]) > env.unwrapped.x_threshold else 'angle')
    return dict(steps=len(actions), end=end, obs=observed, actions=actions)

def tests(net):
    """Steps balanced from each of 100 seeded starts (Gymnasium's reset(seed=0) to reset(seed=99))."""
    return [episode(net, s)['steps'] for s in range(100)]

def ladder(lengths):
    """The generations shown: the first, then each one whose network beats every earlier one's average over the 100
    starts by at least a tenth, up to the first that balances from all of them. More than five, and the first, the last and three
    spread evenly between are kept."""
    shown, best = [0], np.mean(lengths[0])
    for g, ls in enumerate(lengths[1:], 1):
        if np.mean(ls) >= 1.1 * best or min(ls) == 500: shown.append(g); best = np.mean(ls)
        if min(ls) == 500: break
    if len(shown) > 5: shown = [shown[round(i * (len(shown) - 1) / 4)] for i in range(5)]
    return shown

runs, best = [], None
for r in range(5):
    t0 = time.time()
    trial = Recorded(config); trial.run(num_jobs=-1)
    seconds = time.time() - t0
    trial.lengths = [tests(net) for net in trial.champions]
    final = trial.lengths[-1]
    run = dict(run=r + 1, generations=len(trial.champions) - 1, seconds=round(seconds, 1), mean=float(np.mean(final)),
               min=min(final), full=int(sum(n == 500 for n in final)), hidden=trial.history[-1]['hidden'],
               connections=trial.history[-1]['connections'], ladder=ladder(trial.lengths))
    print(run, flush=True); runs.append(run)
    # Kept: the run whose final network does best from the 100 starts; among equals, the one whose ladder has the
    # most steps (the clearest progression), then the shortest.
    key = (run['mean'], len(run['ladder']), -run['generations'])
    if best is None or key > best[0]: best = (key, run, trial)

_, run, trial = best
for h, ls in zip(trial.history, trial.lengths):
    h.update(test_mean=float(np.mean(ls)), test_min=min(ls), test_full=int(sum(n == 500 for n in ls)))
shown = run['ladder']
# The shared start: of the 100, one where the networks shown last longer generation by generation, as their
# averages do; among those, the one where each lasts closest to its own average (in ratio), so no single episode
# flatters or undersells its network. If none qualifies, Gymnasium's seed 0.
def fit(seed):
    ls = [trial.lengths[g][seed] for g in shown]
    if any(b <= a for a, b in zip(ls, ls[1:]) if a < 500): return None
    return sum(abs(np.log(l / np.mean(trial.lengths[g]))) for g, l in zip(shown, ls))
scores = {s: fit(s) for s in range(100) if fit(s) is not None}
START = min(scores, key=scores.get) if scores else 0
episodes = [dict(gen=g, network=trial.champions[g].genome.to_dict(), test_mean=float(np.mean(trial.lengths[g])),
                 test_full=int(sum(n == 500 for n in trial.lengths[g])), **episode(trial.champions[g], START)) for g in shown]
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(dict(population=config.population_size, start_seed=START, runs=runs, kept=run['run'], history=trial.history,
               episodes=episodes), open(OUT, 'w'), default=str)
print('kept run', run['run'], 'start', START, 'shown', [(e['gen'], e['steps'], e['end'], e['test_mean']) for e in episodes], '->', OUT)
print(trial.champions[-1])
