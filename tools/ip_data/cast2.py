import json,time
from concurrent.futures import ThreadPoolExecutor
exec(open('disc.py').read().split('G={')[0])
W=json.load(open('works.json'));ks=list(W['works'])
chunks=[ks[i:i+10] for i in range(0,len(ks),10)]
out={}
def f(c):return call({'cast':c})
with ThreadPoolExecutor(4) as ex:
    for d in ex.map(f,chunks):out.update({k:v for k,v in (d or {}).items() if v})
json.dump(out,open('cast.json','w'),ensure_ascii=False)
print(len(out),sum(len(v['cast']) for v in out.values()))
print([ (k,v['t']) for k,v in out.items() if 'Wicked' in (v.get('te') or '') or '위키드' in (v.get('t') or '') or 'Rent'==v.get('te')])
