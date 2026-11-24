import json,urllib.request,os,concurrent.futures as cf
from face import face
R=json.load(open('rows.json'));seen={};rows=[]
for r in R:
    if r['name'] in seen: continue
    seen[r['name']]=1;rows.append(r)
def get(r):
    if not r['photo']: return
    fn='img/'+r['photo'].strip('/')
    if not os.path.exists(fn):
        try: urllib.request.urlretrieve('https://image.tmdb.org/t/p/w500'+r['photo'],fn)
        except Exception as e: print('dl',r['name'],e); return
with cf.ThreadPoolExecutor(12) as ex: list(ex.map(get,rows))
bad=[]
for r in rows:
    r['face']=face('img/'+r['photo'].strip('/')) if r['photo'] else None
    if r['photo'] and not r['face']: bad.append(r['name'])
json.dump(rows,open('rows2.json','w'),ensure_ascii=False)
print(len(rows),'얼굴 못찾음',len(bad),bad)
lowc=[(r['name'],r['face'][6]) for r in rows if r['face'] and r['face'][6]<0.8];print('낮은 신뢰',lowc)
