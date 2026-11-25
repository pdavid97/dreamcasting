import json,urllib.request,urllib.parse,time,sys
def sp(q):
    for a in range(5):
        try:
            r=urllib.request.Request("https://query.wikidata.org/sparql",data=urllib.parse.urlencode({'query':q,'format':'json'}).encode(),headers={'User-Agent':'dreamcasting/1.0 (https://pdavid97.github.io/dreamcasting/)','Accept':'application/sparql-results+json','Content-Type':'application/x-www-form-urlencoded'})
            return json.load(urllib.request.urlopen(r,timeout=180))['results']['bindings']
        except urllib.error.HTTPError as e:
            print('http',e.code,file=sys.stderr)
            if e.code in (429,503,500,502):time.sleep(65);continue
            raise
CAST='''?w p:P161 ?st. ?st ps:P161 ?a. ?st pq:P453 ?c.
 OPTIONAL{?a wdt:P4985 ?atm} OPTIONAL{?w wdt:P4947 ?wtm} OPTIONAL{?w wdt:P4983 ?wtv} OPTIONAL{?w wdt:P577 ?d}
 SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". ?w rdfs:label ?wL. ?a rdfs:label ?aL. ?c rdfs:label ?cL. ?src rdfs:label ?srcL. ?u rdfs:label ?uL. }'''
SEL='SELECT DISTINCT ?grp ?w ?wL ?wtm ?wtv ?d ?a ?aL ?atm ?c ?cL ?src ?srcL ?uL WHERE {'
Q={
'universe':SEL+'''VALUES (?grp ?u) {("mcu" wd:Q642878)} {?w wdt:P1434 ?u} UNION {?w wdt:P179/wdt:P1434 ?u} '''+CAST+'} LIMIT 6000',
'dc':SEL+'''?u rdfs:label ?ul. VALUES ?ul {"DC Extended Universe"@en "DC Universe"@en} BIND("dc" AS ?grp) {?w wdt:P1434 ?u} UNION {?w wdt:P179/wdt:P1434 ?u} '''+CAST+'} LIMIT 6000',
'disney':SEL+'''BIND("disney" AS ?grp) ?w wdt:P144 ?src. ?src wdt:P31/wdt:P279* wd:Q202866. ?src wdt:P272 ?pc. VALUES ?pc {wd:Q1047410 wd:Q191224 wd:Q127552} FILTER NOT EXISTS {?w wdt:P31 wd:Q202866} '''+CAST+'} LIMIT 6000',
'musical':SEL+'''BIND("musical" AS ?grp) ?w wdt:P144 ?src. {?src wdt:P31/wdt:P279* wd:Q2743} UNION {?src wdt:P31/wdt:P279* wd:Q25379} FILTER NOT EXISTS {?w wdt:P31 wd:Q202866} '''+CAST+'} LIMIT 8000',
'anime':SEL+'''BIND("anime" AS ?grp) ?w wdt:P144 ?src. VALUES ?st0 {wd:Q1107 wd:Q8274 wd:Q20650540 wd:Q63952888 wd:Q21198342} ?src wdt:P31 ?st0. FILTER NOT EXISTS {?w wdt:P31 wd:Q202866} FILTER NOT EXISTS {?w wdt:P31 wd:Q1107} FILTER NOT EXISTS {?w wdt:P31 wd:Q20650540} FILTER NOT EXISTS {?w wdt:P31 wd:Q63952888} '''+CAST+'} LIMIT 8000',
}
out={}
for k,q in Q.items():
    t=time.time();R=sp(q);out[k]=R;print(k,len(R),round(time.time()-t),'s',flush=True);json.dump(out,open('raw.json','w'),ensure_ascii=False);time.sleep(62)
