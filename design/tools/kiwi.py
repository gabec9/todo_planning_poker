import struct, sys, json
class R:
    def __init__(s,b): s.b=b; s.i=0
    def byte(s): v=s.b[s.i]; s.i+=1; return v
    def varuint(s):
        r=0;sh=0
        while True:
            b=s.byte(); r|=(b&0x7f)<<sh; sh+=7
            if b<0x80: return r
    def varint(s):
        v=s.varuint(); return (~(v>>1)) if v&1 else (v>>1)
    def varint64(s): return s.varint()
    def float(s):
        if s.b[s.i]==0: s.i+=1; return 0.0
        v=s.b[s.i]|s.b[s.i+1]<<8|s.b[s.i+2]<<16|s.b[s.i+3]<<24; s.i+=4
        v=((v<<23)|(v>>9))&0xffffffff
        return struct.unpack('<f',struct.pack('<I',v))[0]
    def string(s):
        j=s.b.index(0,s.i); v=s.b[s.i:j].decode('utf8','replace'); s.i=j+1; return v

def parse_schema(b):
    r=R(b); n=r.varuint(); defs=[]
    for _ in range(n):
        name=r.string(); kind=r.byte(); fc=r.varuint(); fields=[]
        for _ in range(fc):
            fn=r.string(); t=r.varint(); arr=r.byte(); val=r.varuint()
            fields.append(dict(name=fn,type=t,array=arr,value=val))
        defs.append(dict(name=name,kind=kind,fields=fields))
    return defs
BUILTIN={-1:'bool',-2:'byte',-3:'int',-4:'uint',-5:'float',-6:'string',-7:'int64',-8:'uint64'}
def read_val(r,defs,t):
    if t<0:
        k=BUILTIN[t]
        if k=='bool': return bool(r.byte())
        if k=='byte': return r.byte()
        if k=='int': return r.varint()
        if k=='uint': return r.varuint()
        if k=='float': return r.float()
        if k=='string': return r.string()
        if k in('int64','uint64'): return r.varint()
    d=defs[t]
    if d['kind']==0:
        v=r.varuint()
        for f in d['fields']:
            if f['value']==v: return f['name']
        return v
    if d['kind']==1:
        return {f['name']:read_arr(r,defs,f) for f in d['fields']}
    out={}
    while True:
        fid=r.varuint()
        if fid==0: return out
        f=next(f for f in d['fields'] if f['value']==fid)
        out[f['name']]=read_arr(r,defs,f)
def read_arr(r,defs,f):
    if f['array']:
        n=r.varuint(); return [read_val(r,defs,f['type']) for _ in range(n)]
    return read_val(r,defs,f['type'])
