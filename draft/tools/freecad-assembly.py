# Reads a folder of FreeCAD .FCStd files and lists every solid in an assembly, placed where the assembly puts it.
# FreeCAD isn't needed: each .FCStd is a zip with Document.xml (the tree and positions) and one .brp shape per body.
# Usage: python3 -I freecad-assembly.py <folder> <assembly file name> <scratch folder>
# Prints JSON: [{label, brp (path to the shape in the scratch folder), pos [x,y,z], q [x,y,z,w]}], in tree order.
import json, os, sys, zipfile
import xml.etree.ElementTree as ET

SRC, TOP, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
cache = {}

def load(doc):
    doc = doc.replace('.FCStd', '')
    if doc in cache: return cache[doc]
    with zipfile.ZipFile(os.path.join(SRC, doc + '.FCStd')) as z:
        dest = os.path.join(OUT, doc)
        for n in z.namelist():
            if n.endswith('.brp') or n == 'Document.xml':
                os.makedirs(dest, exist_ok=True)
                with open(os.path.join(dest, os.path.basename(n)), 'wb') as f: f.write(z.read(n))
    root = ET.parse(os.path.join(OUT, doc, 'Document.xml')).getroot()
    types = {o.get('name'): o.get('type') for o in root.find('Objects').findall('Object')}
    objs = {}
    for od in root.find('ObjectData').findall('Object'):
        p = {}
        for pr in od.find('Properties').findall('Property'):
            name = pr.get('name')
            pl = pr.find('PropertyPlacement')
            if pl is not None: p[name] = {k: float(pl.get(k)) for k in ('Px', 'Py', 'Pz', 'Q0', 'Q1', 'Q2', 'Q3')}
            for tag in ('XLink', 'XLinkSub'):
                x = pr.find(tag)
                if x is not None and x.get('name'): p[name] = ('x', x.get('file'), x.get('name'))
            lk = pr.find('Link')
            if lk is not None and lk.get('value'): p[name] = ('l', lk.get('value'))
            ll = pr.find('LinkList')
            if ll is not None: p[name] = ('ll', [e.get('value') or e.get('name') for e in ll.findall('Link')])
            for tag in ('Integer', 'Bool', 'String'):
                e = pr.find(tag)
                if e is not None and e.get('value') is not None: p[name] = e.get('value')
            part = pr.find('Part')
            if part is not None and part.get('file'): p[name] = ('f', part.get('file'))
        objs[od.get('name')] = (types.get(od.get('name')), p)
    cache[doc] = (doc, objs)
    return cache[doc]

# Rigid transforms as (position, quaternion x y z w).
def qmul(a, b):
    x1, y1, z1, w1 = a; x2, y2, z2, w2 = b
    return (w1*x2 + x1*w2 + y1*z2 - z1*y2, w1*y2 - x1*z2 + y1*w2 + z1*x2, w1*z2 + x1*y2 - y1*x2 + z1*w2, w1*w2 - x1*x2 - y1*y2 - z1*z2)
def qrot(q, v):
    x, y, z, w = q; vx, vy, vz = v
    tx, ty, tz = 2*(y*vz - z*vy), 2*(z*vx - x*vz), 2*(x*vy - y*vx)
    return (vx + w*tx + y*tz - z*ty, vy + w*ty + z*tx - x*tz, vz + w*tz + x*ty - y*tx)
I = ((0, 0, 0), (0, 0, 0, 1))
def P(p): return ((p['Px'], p['Py'], p['Pz']), (p['Q0'], p['Q1'], p['Q2'], p['Q3'])) if p else I
def comp(a, b): r = qrot(a[1], b[0]); return ((a[0][0] + r[0], a[0][1] + r[1], a[0][2] + r[2]), qmul(a[1], b[1]))
def inv(a): q = (-a[1][0], -a[1][1], -a[1][2], a[1][3]); r = qrot(q, a[0]); return ((-r[0], -r[1], -r[2]), q)

out = []
def emit(doc, name, xf, label):
    sh = load(doc)[1][name][1].get('Shape')
    if isinstance(sh, tuple) and sh[0] == 'f':
        out.append({'label': label, 'brp': os.path.join(OUT, load(doc)[0], sh[1]), 'pos': xf[0], 'q': xf[1]}); return True
    return False
def shape_of(doc, name, xf, label):
    O = load(doc)[1]; ty, p = O[name]
    if ty == 'App::Link':  # a link's own placement replaces the linked object's, so follow it without adding that
        ln = p['LinkedObject']
        return shape_of(ln[1] or doc, ln[2], xf, label) if ln[0] == 'x' else shape_of(doc, ln[1], xf, label)
    if ty == 'Assembly::AssemblyLink': return expand(doc, name, xf, label)
    if ty == 'App::Part':  # a bought part made of several bodies, each saved in place inside the part
        for c in p['Group'][1]:
            if not O[c][0].startswith('Sketcher'): emit(doc, c, xf, label + '/' + O[c][1].get('Label', c))
        return
    # Saved shapes already carry their own placement, so take it off before applying the assembly's.
    if not emit(doc, name, comp(xf, inv(P(p.get('Placement')))), label): print('no shape:', doc, name, ty, file=sys.stderr)
def expand(doc, name, xf, label):
    O = load(doc)[1]; g = O[name][1].get('Group')
    for c in (g[1] if isinstance(g, tuple) else []):
        if c not in O: continue
        cty, cp = O[c]
        if cty in ('Assembly::JointGroup', 'App::DocumentObjectGroup', 'App::FeaturePython'): continue
        xc = comp(xf, P(cp.get('Placement')))
        if cty == 'Assembly::AssemblyLink': expand(doc, c, xc, cp.get('Label', c))
        else: shape_of(doc, c, xc, cp.get('Label', c))

expand(TOP, 'Assembly', I, 'root')
json.dump(out, sys.stdout)
