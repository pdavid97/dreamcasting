import json,urllib.request,re,time,sys
ANON=open('/home/claude/dreamcasting/src/live_body.html').read().split("ANON='")[1].split("'")[0]
U='https://dnzcvbidppzaogtmwamc.supabase.co/functions/v1/tmdb'
def call(b):
    for i in range(3):
        try:
            r=urllib.request.Request(U,data=json.dumps(b).encode(),headers={'Content-Type':'application/json','apikey':ANON,'Authorization':'Bearer '+ANON,'Origin':'https://pdavid97.github.io'})
            return json.load(urllib.request.urlopen(r,timeout=60))
        except Exception as e: print('retry',e,file=sys.stderr);time.sleep(2)
    return {}
C=json.load(open('cands.json'))
norm=lambda s:re.sub(r'[\s\-\.·]','',(s or '').lower())
# 1) tmdb_id 있는 사람 상세
ids=[x['tmdb_id'] for x in C if x['tmdb_id']]
D={}
for i in range(0,len(ids),40): D.update(call({'pids':ids[i:i+40]}))
# 2) 없는 사람 검색
need=[x for x in C if not x['tmdb_id']]
qs=set()
for x in need:
    qs.add(re.sub(r'\s*\(.*\)$','',x['name']))
    if x['name_en'] and re.search('[A-Za-z]',x['name_en']): qs.add(x['name_en'])
qs=list(qs);S={}
for i in range(0,len(qs),20): S.update(call({'who':qs[i:i+20]}))
cand_ids=set()
for v in S.values():
    for r in v or []: cand_ids.add(r['id'])
cand_ids=[i for i in cand_ids if str(i) not in D]
for i in range(0,len(cand_ids),40): D.update(call({'pids':cand_ids[i:i+40]}))
json.dump({'D':D,'S':S},open('tm.json','w'),ensure_ascii=False)
print(len(D),len(S))
