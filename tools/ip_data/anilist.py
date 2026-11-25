import json,urllib.request,time,sys
W=json.load(open('anime_works.json'))
Q='''query($s:String){Page(perPage:1){media(search:$s,sort:POPULARITY_DESC){id type format title{romaji english native} siteUrl popularity
 characters(perPage:25,sort:ROLE){edges{role node{id name{full native} } voiceActors(language:JAPANESE){id name{full native}} vaKo:voiceActors(language:KOREAN){id name{full native}}}}}}}'''
def q(s):
    for a in range(4):
        try:
            r=urllib.request.Request('https://graphql.anilist.co',data=json.dumps({'query':Q,'variables':{'s':s}}).encode(),headers={'Content-Type':'application/json','Accept':'application/json','User-Agent':'dreamcasting/1.0 (https://pdavid97.github.io/dreamcasting/)'})
            return json.load(urllib.request.urlopen(r,timeout=30))['data']['Page']['media']
        except urllib.error.HTTPError as e:
            if e.code==429:time.sleep(61);continue
            return []
        except Exception:time.sleep(3)
    return []
out={}
for w in W:
    s=w['title_en'] or w['title']
    m=q(s);time.sleep(2.2)
    if m:out[w['key']]=m[0]
print(len(out),file=sys.stderr)
json.dump(out,open('anilist.json','w'),ensure_ascii=False)
