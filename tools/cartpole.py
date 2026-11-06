"""Runs EvoGrad's CartPole example and records what tools/build-cartpole.mjs draws.

Evolves controllers for Gymnasium's CartPole-v1 the way examples/gymnasium/Gymnasium.ipynb in lciordas/evograd does
(same config file and overrides, all cores), keeping the fittest network of every generation. A run stops once a network
scores 495 over its 3 episodes, which doesn't guarantee it balances from every start, so the example is run five times
and the run whose final network does best from 100 seeded starts is kept. Its first and last generations' champions
are then played from one shared start.
Writes toolkit/sources/cartpole.json: every run's summary, the kept run's per-generation history and tests, and the
two champions' networks and episodes, step by step.

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

tests = lambda net: [episode(net, s)['steps'] for s in range(100)]
runs, best = [], None
for r in range(5):
    t0 = time.time()
    trial = Recorded(config); trial.run(num_jobs=-1)
    seconds = time.time() - t0
    lengths = tests(trial.champions[-1])
    run = dict(run=r + 1, generations=len(trial.champions) - 1, seconds=round(seconds, 1), mean=float(np.mean(lengths)),
               min=min(lengths), full=int(sum(n == 500 for n in lengths)), hidden=trial.history[-1]['hidden'],
               connections=trial.history[-1]['connections'])
    print(run, flush=True); runs.append(run)
    if best is None or (run['mean'], -run['generations']) > (best[0]['mean'], -best[0]['generations']): best = (run, trial)

run, trial = best
for h, net in zip(trial.history, trial.champions):
    lengths = tests(net); h.update(test_mean=float(np.mean(lengths)), test_min=min(lengths), test_full=int(sum(n == 500 for n in lengths)))
START = 0  # the shared start: Gymnasium's reset(seed=0)
episodes = [dict(gen=g, network=trial.champions[g].genome.to_dict(), **episode(trial.champions[g], START)) for g in (0, len(trial.champions) - 1)]
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(dict(population=config.population_size, start_seed=START, runs=runs, kept=run['run'], history=trial.history,
               episodes=episodes), open(OUT, 'w'), default=str)
print('kept run', run['run'], 'shown', [(e['gen'], e['steps'], e['end']) for e in episodes], '->', OUT)
print(trial.champions[-1])
