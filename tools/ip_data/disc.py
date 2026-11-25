import json,urllib.request,time
KEY=open('key').read().strip()  # 공개 anon 키를 key 파일에 넣어 실행
def call(b):
    for a in range(3):
        try:
            r=urllib.request.Request('https://dnzcvbidppzaogtmwamc.supabase.co/functions/v1/tmdb',data=json.dumps(b).encode(),headers={'Authorization':'Bearer '+KEY,'Content-Type':'application/json'})
            return json.load(urllib.request.urlopen(r,timeout=60))
        except Exception as e:time.sleep(2)
    return {}
G={ # grp: list of (media, params, pages)
 'mcu':[('movie',{'kw':'180547'},3),('tv',{'kw':'180547'},2)],
 'dc':[('movie',{'kw':'229266|312528'},2),('tv',{'kw':'312528|229266'},2)],
 'disney_live':[('movie',{'kw':'245230','ng':'16'},4)],
 'fairytale_live':[('movie',{'kw':'179411','ng':'16'},2)],
 'musical_film':[('movie',{'kw':'10181','g':'10402'},4),('movie',{'kw':'165241|220201'},2)],
 'anime_live':[('movie',{'kw':'359095|222243|13141','ng':'16'},5),('tv',{'kw':'359095|13141','ng':'16'},4)],
 'webtoon_live':[('tv',{'kw':'288474|323477','ng':'16'},5),('movie',{'kw':'288474|323477','ng':'16'},3)],
 'game_live':[('movie',{'kw':'41645','ng':'16'},3),('tv',{'kw':'41645','ng':'16'},2)],
}
out={}
for g,specs in G.items():
    seen={}
    for m,p,n in specs:
        for pg in range(1,n+1):
            d=call({'disc':dict(m=m,page=pg,**p)})
            for x in d.get('res',[]):seen.setdefault(x['k'],x)
            if pg>=d.get('pages',0):break
    out[g]=list(seen.values());print(g,len(out[g]),[x['t'] for x in out[g][:6]],flush=True)
json.dump(out,open('disc.json','w'),ensure_ascii=False)
