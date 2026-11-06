"""Runs EvoGrad's 1D regression example three ways on one target and records what tools/build-evograd-fit.mjs draws.

The example is lciordas/evograd's examples/regression_1D (FunctionRegression1D.ipynb): its config file and the
notebook's overrides (population 100, up to 300 generations, stop at fitness 9.98, i.e. a mean squared error of 2e-4;
500 gradient steps per network per generation, Lamarckian; seeds 27). The target is a damped sine on [-3, 3], scaled
into the sigmoid's range. The three runs differ only in what EvoGrad is allowed to do:
  neat     - evolution alone (Trial_Regression1D), sigmoid nodes
  grad     - evolution, then gradient descent on every network's weights, biases and gains each generation
             (Trial_Regression1DGrad), sigmoid nodes
  legendre - as grad, with every node's activation a learnable Legendre expansion (10 coefficients, trained by the
             same gradient descent)
Writes toolkit/sources/evograd-regression.json: for each run, the best network's error every generation, its final fit
on the 100 sample points, its network, and for Legendre nodes the learned activation over the inputs it sees.

Setup and venv as in tools/cartpole.py. Run from the repo root (a few minutes):
  <dir>/venv/bin/python tools/evograd-regression.py <dir>/evograd
then node tools/build-evograd-fit.mjs.
"""
import json, os, random, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVOGRAD = os.path.abspath(sys.argv[1])
OUT = os.path.join(ROOT, 'toolkit/sources/evograd-regression.json')
EX = os.path.join(EVOGRAD, 'examples/regression_1D')
sys.path.insert(0, os.path.join(EVOGRAD, 'src')); sys.path.insert(0, EX)
os.chdir(EX)

import autograd.numpy as np
from evograd.run import Config
from evograd.activations import LegendreActivation, activations
from trial_regression1D import Trial_Regression1D
from trial_regression1D_grad import Trial_Regression1DGrad

target = lambda x: 0.5 + 0.4 * np.exp(-0.3 * (x + 3)) * np.sin(2 * x)
X_MIN, X_MAX = -3.0, 3.0

def record(base):
    class Recorded(base):
        def _reset(self):
            self.history = []
            return super()._reset()
        def _generation_report(self):
            best = self._population.get_fittest_individual()
            self.history.append(float(1 / best.fitness - 0.1))  # fitness is 1 / (0.1 + MSE)
        def _final_report(self):
            pass
    return Recorded

def node_curves(net):
    """Evaluate the network node by node on the sample points (z = gain * weighted sum + bias, then the activation),
    returning each Legendre node's activation sampled across the range of z it receives."""
    nodes = {str(d['id']): d for d in net['nodes']}
    cxns = [c for c in net['connections'] if c['enabled']]
    xs = np.linspace(X_MIN, X_MAX, 100)
    val, curves = {str(d['id']): xs for d in net['nodes'] if d['type'] == 'input'}, {}
    while len(val) < len(nodes):
        for k, d in nodes.items():
            ins = [c for c in cxns if str(c['to']) == k]
            if k in val or any(str(c['from']) not in val for c in ins): continue
            z = d['gain'] * sum((c['weight'] * val[str(c['from'])] for c in ins), np.zeros_like(xs)) + d['bias']
            if d['activation'] == 'legendre':
                f = LegendreActivation(len(d['activation_coeffs']) - 1)
                c = np.array(d['activation_coeffs']); val[k] = f(z, c)
                zs = np.linspace(z.min(), z.max(), 120)
                curves[k] = dict(type=d['type'], z=zs.tolist(), f=f(zs, c).tolist())
            else:
                val[k] = activations[d['activation']](z)
    return curves

runs = {}
for name in ('neat', 'grad', 'legendre'):
    config = Config('config_regression1D.ini')
    config.fitness_threshold = 9.98
    config.population_size = 100
    config.max_number_generations = 300
    config.enable_gradient = name != 'neat'
    config.lamarckian_evolution = True
    config.gradient_steps = 500
    if name == 'legendre': config.activation_initial = 'legendre'
    random.seed(27); np.random.seed(27)
    t0 = time.time()
    if name == 'neat':
        trial = record(Trial_Regression1D)(config, 'autograd', target, X_MIN, X_MAX); trial.run(num_jobs=1)
    else:
        trial = record(Trial_Regression1DGrad)(config, target, X_MIN, X_MAX); trial.run(num_jobs=-1)
    best = trial._population.get_fittest_individual()
    xs = np.linspace(X_MIN, X_MAX, 100).reshape(-1, 1)
    net = best.prune().genome.to_dict()
    runs[name] = dict(seconds=round(time.time() - t0, 1), generations=len(trial.history) - 1, mse=trial.history,
                      fit=[float(v) for v in np.array(best._network.forward_pass(xs)).flatten()], network=net,
                      hidden=sum(d['type'] == 'hidden' for d in net['nodes']),
                      connections=sum(c['enabled'] for c in net['connections']), curves=node_curves(net))
    print(name, {k: v for k, v in runs[name].items() if k in ('seconds', 'generations', 'hidden', 'connections')}, 'final MSE %.2e' % trial.history[-1], flush=True)

xs = np.linspace(X_MIN, X_MAX, 100)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(dict(x=xs.tolist(), target=[float(target(x)) for x in xs], runs=runs), open(OUT, 'w'), default=str)
print('->', OUT)
