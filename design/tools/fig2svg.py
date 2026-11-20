"""Minimal Figma .fig (kiwi) -> SVG renderer for wireframe-style files. Usage: fig2svg.py <canvas.fig> <outdir>"""
import sys, zlib, struct, json, os, collections, html
sys.path.insert(0, os.path.dirname(__file__))
from kiwi import *
import zstandard

def load(path):
    d = open(path, 'rb').read()
    off = 12; chunks = []
    while off + 4 <= len(d):
        n = struct.unpack('<I', d[off:off+4])[0]; off += 4
        chunks.append(d[off:off+n]); off += n
    schema = parse_schema(zlib.decompress(chunks[0], -15))
    raw = chunks[1]
    data = zstandard.ZstdDecompressor().decompressobj().decompress(raw) if raw[:4] == b'(\xb5/\xfd' else zlib.decompress(raw, -15)
    root = next(i for i, x in enumerate(schema) if x['name'] == 'Message')
    return read_val(R(data), schema, root)

msg = load(sys.argv[1]); outdir = sys.argv[2]; os.makedirs(outdir, exist_ok=True)
nc = msg['nodeChanges']; blobs = msg['blobs']
gid = lambda g: f"{g['sessionID']}:{g['localID']}"
nodes = {gid(n['guid']): n for n in nc}
kids = collections.defaultdict(list)
for n in nc:
    p = n.get('parentIndex')
    if p: kids[gid(p['guid'])].append(n)
for k in kids: kids[k].sort(key=lambda n: n['parentIndex']['position'])

def blob(i):
    b = blobs[i]; b = b['bytes'] if isinstance(b, dict) else b
    return bytes(b)

def path_from_blob(i):
    b = blob(i); p = 0; out = []
    def f():
        nonlocal p
        v = struct.unpack('<f', b[p:p+4])[0]; p += 4; return round(v, 3)
    while p < len(b):
        c = b[p]; p += 1
        if c == 0: out.append('Z')
        elif c == 1: out.append(f'M{f()} {f()}')
        elif c == 2: out.append(f'L{f()} {f()}')
        elif c == 3: out.append(f'Q{f()} {f()} {f()} {f()}')
        elif c == 4: out.append(f'C{f()} {f()} {f()} {f()} {f()} {f()}')
        else: break
    return ' '.join(out)

def color(paints, default=None):
    for p in (paints or []):
        if p.get('visible', True) and p['type'] == 'SOLID':
            c = p['color']; a = p.get('opacity', 1.0) * c.get('a', 1.0)
            return f"rgb({round(c['r']*255)},{round(c['g']*255)},{round(c['b']*255)})", a
    return default

def merged(n, ov):
    if not ov: return n
    m = dict(n)
    for k, v in ov.items():
        if k in ('guidPath',): continue
        m[k] = v
    return m

def fmt(t):
    return f"matrix({t['m00']} {t['m10']} {t['m01']} {t['m11']} {t['m02']} {t['m12']})"

uid = [0]
def render(n, overrides, derived, prefix, out, instance_depth=0):
    key = n.get('overrideKey') or n['guid']
    path = prefix + (gid(key),)
    ov = overrides.get(path)
    dv = derived.get(path, {})
    m = merged(n, ov)
    if 'size' in dv: m = {**m, 'size': dv['size']}
    if 'transform' in dv: m = {**m, 'transform': dv['transform']}
    if not m.get('visible', True) or m.get('opacity', 1) == 0: return
    t = m.get('transform', {'m00':1,'m01':0,'m02':0,'m10':0,'m11':1,'m12':0}); sz = m.get('size', {'x': 0, 'y': 0})
    w, h = sz['x'], sz['y']; ty = m['type']
    attrs = f'transform="{fmt(t)}"' + (f' opacity="{m["opacity"]}"' if m.get('opacity', 1) != 1 else '')
    out.append(f'<g {attrs}>')
    fill = color(m.get('fillPaints')); stroke = color(m.get('strokePaints')); sw = m.get('strokeWeight', 0) if stroke else 0
    def style():
        s = f'fill="{fill[0]}" fill-opacity="{fill[1]}"' if fill else 'fill="none"'
        if stroke and sw:
            s += f' stroke="{stroke[0]}" stroke-opacity="{stroke[1]}" stroke-width="{sw*(2 if m.get("strokeAlign","CENTER") in ("INSIDE","OUTSIDE") else 1)}"'
            if m.get('dashPattern'): s += f' stroke-dasharray="{" ".join(str(x*sw) for x in m["dashPattern"])}"'
            s += f' stroke-linecap="{ {"ROUND":"round","SQUARE":"square"}.get(m.get("strokeCap"),"butt")}" stroke-linejoin="{ {"ROUND":"round","BEVEL":"bevel"}.get(m.get("strokeJoin"),"miter")}"'
        return s
    cr = m.get('cornerRadius', 0) or 0
    clip = ''
    if ty in ('FRAME', 'SYMBOL', 'INSTANCE', 'ROUNDED_RECTANGLE', 'RECTANGLE', 'ELLIPSE'):
        uid[0] += 1; cid = f'c{uid[0]}'
        if ty == 'ELLIPSE': shape = f'<ellipse cx="{w/2}" cy="{h/2}" rx="{w/2}" ry="{h/2}" {style()}/>'
        else:
            rr = min(cr, w/2, h/2)
            shape = f'<rect width="{w}" height="{h}" rx="{rr}" {style()}/>'
        if ty in ('FRAME', 'SYMBOL', 'INSTANCE', 'ROUNDED_RECTANGLE', 'RECTANGLE', 'ELLIPSE'):
            # inside-stroke approximated by clipping to the shape
            if stroke and sw and m.get('strokeAlign') == 'INSIDE':
                out.append(f'<clipPath id="s{cid}"><rect width="{w}" height="{h}" rx="{min(cr,w/2,h/2)}"/></clipPath>')
                shape = shape.replace('/>', f' clip-path="url(#s{cid})"/>')
        out.append(shape)
        if ty in ('FRAME','SYMBOL','INSTANCE') and not m.get('frameMaskDisabled', False):
            out.append(f'<clipPath id="{cid}"><rect width="{w}" height="{h}" rx="{min(cr,w/2,h/2)}"/></clipPath><g clip-path="url(#{cid})">')
            clip = '</g>'
    elif ty in ('VECTOR', 'BOOLEAN_OPERATION', 'LINE', 'STAR', 'REGULAR_POLYGON'):
        geoms = []
        for fg in (m.get('fillGeometry') or dv.get('fillGeometry') or []): geoms.append(('fill', fg))
        for sg in (m.get('strokeGeometry') or dv.get('strokeGeometry') or []): geoms.append(('stroke', sg))
        if ty == 'LINE':
            out.append(f'<line x1="0" y1="0" x2="{w}" y2="0" {style()}/>')
        for kind, g in geoms:
            try: d = path_from_blob(g['commandsBlob'])
            except Exception: continue
            if kind == 'fill' and fill:
                out.append(f'<path d="{d}" fill="{fill[0]}" fill-opacity="{fill[1]}" fill-rule="{"evenodd" if g.get("windingRule")=="ODD" else "nonzero"}"/>')
            elif kind == 'stroke' and stroke:
                out.append(f'<path d="{d}" fill="{stroke[0]}" fill-opacity="{stroke[1]}"/>')
    elif ty == 'TEXT':
        chars = (m.get('textData') or {}).get('characters', '')
        fs = m.get('fontSize', 14); fam = (m.get('fontName') or {}).get('family', 'Inter'); st = (m.get('fontName') or {}).get('style', 'Regular')
        weight = 700 if 'Bold' in st else 600 if 'Semi' in st else 500 if 'Medium' in st else 400
        italic = 'italic' if 'Italic' in st else 'normal'
        lh = m.get('lineHeight') or {}
        lhpx = lh['value'] if lh.get('units') == 'PIXELS' else lh['value']*fs if lh.get('units') == 'RAW' else lh['value']/100*fs if lh.get('units') == 'PERCENT' and lh['value'] else fs*1.2
        ah = m.get('textAlignHorizontal', 'LEFT'); av = m.get('textAlignVertical', 'TOP')
        anchor = {'LEFT': 'start', 'CENTER': 'middle', 'RIGHT': 'end'}.get(ah, 'start'); x = {'LEFT': 0, 'CENTER': w/2, 'RIGHT': w}.get(ah, 0)
        lines = chars.split('\n'); total = lhpx * len(lines)
        y0 = {'TOP': 0, 'CENTER': (h-total)/2, 'BOTTOM': h-total}.get(av, 0)
        col = fill[0] if fill else '#000'
        for i, ln in enumerate(lines):
            y = y0 + lhpx*i + lhpx/2 + fs*0.35
            out.append(f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="{fam}, Helvetica, Arial, sans-serif" font-size="{fs}" font-weight="{weight}" font-style="{italic}" fill="{col}">{html.escape(ln)}</text>')
    # children
    if ty == 'INSTANCE':
        sid = gid(m['symbolData']['symbolID']); sym = nodes.get(sid)
        o2 = dict(overrides); d2 = dict(derived)
        for o in m['symbolData'].get('symbolOverrides', []) or []:
            o2[path_prefix_key(prefix, key, o)] = o
        for dd in m.get('derivedSymbolData', []) or []:
            d2[path_prefix_key(prefix, key, dd)] = dd
        if sym and instance_depth < 8:
            for c in kids[sid]:
                render(c, o2, d2, path[:-1] + (gid(key),) if False else path, out, instance_depth+1)
    else:
        for c in kids[gid(n['guid'])]:
            render(c, overrides, derived, prefix, out, instance_depth)
    out.append(clip + '</g>')

def path_prefix_key(prefix, inst_key, o):
    return prefix + (gid(inst_key),) + tuple(gid(g) for g in o['guidPath']['guids'])

def export(node, name):
    out = []
    sz = node['size']; w, h = sz['x'], sz['y']
    # render node at origin
    n2 = dict(node); n2['transform'] = {'m00':1,'m01':0,'m02':0,'m10':0,'m11':1,'m12':0}
    render(n2, {}, {}, (), out)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect width="{w}" height="{h}" fill="#fff"/>' + ''.join(out) + '</svg>'
    open(os.path.join(outdir, name + '.svg'), 'w').write(svg)
    return w, h

page = next(n for n in nc if n.get('name') == 'Page 1')
manifest = []
for f in kids[gid(page['guid'])]:
    slug = f['name'].lower().replace(' ', '-')
    w, h = export(f, slug)
    manifest.append({'name': f['name'], 'file': slug, 'type': f['type'], 'w': w, 'h': h})
json.dump(manifest, open(os.path.join(outdir, 'manifest.json'), 'w'), indent=1)
print(len(manifest), 'exported')
