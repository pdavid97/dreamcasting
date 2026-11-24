import json,re
C=json.load(open('cands.json'));T=json.load(open('tm.json'));D=T['D'];S=T['S']
n=lambda s:re.sub(r'[\s\-\.·\']','',(s or '').lower())
out=[]
for x in C:
    base=re.sub(r'\s*\(.*\)$','',x['name'])
    if x['tmdb_id']:
        d=D.get(str(x['tmdb_id']));out.append(dict(x,how='id',tm=d));continue
    keys={n(base)}|({n(x['name_en'])} if x['name_en'] else set())|{n(a) for a in (x['aliases'] or [])}
    best=None;cands=[]
    for q in [base,x['name_en']]:
        for r in S.get(q or '',[]) or []:
            d=D.get(str(r['id']))
            if not d: continue
            names={n(d['name'])}|{n(a) for a in d['aka']}
            ok=bool(keys&names)
            cands.append((ok,d['dep']=='Acting',d['pop'],d))
    cands.sort(key=lambda t:(t[0],t[1],t[2]),reverse=True)
    if cands and cands[0][0]: best=cands[0][3]
    out.append(dict(x,how='search' if best else 'none',tm=best,alts=[(c[0],c[3]['name'],c[3]['dep'],round(c[3]['pop'],1),bool(c[3]['p'])) for c in cands[:3]]))
json.dump(out,open('dec.json','w'),ensure_ascii=False)
import collections
print(collections.Counter((o['how'],bool(o['tm'] and o['tm']['p'])) for o in out))
for o in out:
    if o['how']!='id' and not (o['tm'] and o['tm']['p']): print(o['name'],'|',o['name_en'],'|',o.get('alts'))
