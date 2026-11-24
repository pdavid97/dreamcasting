import json,re
O=json.load(open('orig.json'));O.update({"스와베 준이치":"諏訪部順一","하마베 미나미":"浜辺美波"});C=json.load(open('dec.json'));T=json.load(open('tm.json'));D=T['D'];S=T['S'];S2=T['S2']
D['1556940']={"id":1556940,"name":"Goo Seung-hyun","aka":["구승현","Goo Seung-Hyeon","Gu Seung-hyeon","具承贤"],"pob":"South Korea","dep":"Acting","pop":0.69,"p":""}
EN={'닉 조너스':'Nick Jonas','대니얼 헤니':'Daniel Henney','아리아나 디보스':'Ariana DeBose','앤드루 가필드':'Andrew Garfield','앨리샤 키스':'Alicia Keys','제이컵 엘로디':'Jacob Elordi','찰스 멜턴':'Charles Melton','티모테 샬라메':'Timothée Chalamet'}
HIDE={'도화':'TMDB에서 같은 사람을 찾지 못함','정성하':'TMDB에 사진 없음'}
H=lambda s:bool(re.search('[가-힣]',s or ''));HAN=lambda s:bool(re.search('[一-鿿]',s or ''))and not re.search('[぀-ヿ가-힣]',s or '')
LAT=lambda s:bool(s) and bool(re.fullmatch(r"[A-Za-zÀ-ÿĀ-žḀ-ỿ .'\-]+",s))
def pick_search(x):
    rs=[]
    for q in [re.sub(r'\s*\(.*\)$','',x['name']),x['name_en']]:
        for r in (S.get(q or '') or []):
            d=D.get(str(r['id']))
            if d and d['p'] and d['dep']=='Acting': rs.append(d)
    rs.sort(key=lambda d:-d['pop']); return rs[0] if rs else None
def lang_of(tm,x):
    r0=x.get('region')
    if re.search('Japan',((tm or {}).get('pob') or x.get('pob') or '')): return 'ja'
    pob0=((tm or {}).get('pob') or x.get('pob') or '')
    if r0=='kr':
        nm=((tm or {}).get('name') or '').split()
        SUR={'kim','lee','park','choi','jung','jeong','kang','cho','jo','yoon','yun','jang','lim','im','han','oh','seo','shin','kwon','hwang','ahn','an','song','yoo','yu','hong','jeon','go','ko','moon','mun','yang','son','bae','baek','heo','nam','noh','roh','ha','kwak','sung','cha','joo','woo','koo','gu','min','ryu','yoo','na','jin','ji','uhm','byeon','gong','yeo','do','chun','seol','sul','lim','namkoong','jun','kong','hyun','pyo','won','choo','tak','ra','wi','ok','bang','byun','chae','ma'}
        if pob0 and not re.search('Korea|서울|부산',pob0) and len(nm)>=2 and LAT(' '.join(nm)) and nm[0].lower() not in SUR: return 'en'
        return 'ko'
    if r0 in('cn','tw','hk'): return 'zh'
    pob=(tm or {}).get('pob') or x.get('pob') or ''
    if re.search('Korea|대한민국|서울|부산',pob): return 'ko'
    if re.search('China|Taiwan|Hong Kong|Macau|中国|台灣|香港',pob): return 'zh'
    if re.search('Japan|日本',pob): return 'ja'
    if re.search('Thailand',pob): return 'th'
    if re.search(r'\bIndia\b',pob): return 'in'
    if pob: return 'en'
    r=x.get('region')
    return {'kr':'ko','cn':'zh','tw':'zh','hk':'zh'}.get(r,'ko' if H(x['name']) and r!='intl' else 'en')
rows=[]
for x in C:
    base=re.sub(r'\s*\(.*\)$','',x['name']).strip()
    tm=x['tm']
    if x['name'] in EN:
        r=(S2.get(EN[x['name']]) or [None])[0]; tm={'id':r['id'],'name':EN[x['name']],'aka':[r['name']],'pob':'','dep':'Acting','pop':r['pop'],'p':r['p']} if r else None
    elif x['how']!='id' and not (tm and tm['p']) and x['name'] not in HIDE: tm=pick_search(x)
    ok=bool(tm and tm['p']) and x['name'] not in HIDE
    aka=(tm or {}).get('aka',[])+(x['aliases'] or [])
    tname=(tm or {}).get('name') or ''
    en=tname if LAT(tname) else next((a for a in aka if LAT(a)),'') or (x['name_en'] if LAT(x['name_en']) else '')
    ko=base if H(base) else next((a for a in aka if H(a) and len(a)<=12),'')
    lg=lang_of(tm,x)
    if x['name'] in EN: lg='en'
    if lg=='ko': nat=ko or base; disp=f'{nat} ({en})' if en and en.lower()!=nat.lower() else nat
    elif lg=='zh':
        nat=O.get(x['name']) or (base if HAN(base) else next((a for a in aka if HAN(a) and 2<=len(a)<=4),''))
        disp=f'{nat} ({en})' if nat and en else (nat or en or base)
    elif lg in('ja','th','in'):
        pat={'ja':'[぀-ヿ一-鿿]','th':'[฀-๿]','in':'[ऀ-෿]'}[lg]
        nat=O.get(x['name']) or base if re.search(pat,base) or O.get(x['name']) else next((a for a in aka if re.search(pat,a)),'')
        disp=f'{nat} ({en})' if nat and en else (nat or en or base)
    else:
        nat=en or base; disp=f'{en} ({ko})' if en and ko else (en or ko or base)
    rows.append(dict(name=x['name'],tmdb_id=(tm or {}).get('id'),photo=(tm or {}).get('p') or None,en=en or None,native=nat or None,lang=lg,disp=disp,ok=ok,note=HIDE.get(x['name']) or (None if ok else 'TMDB 사진 없음')))
json.dump(rows,open('rows.json','w'),ensure_ascii=False)
import collections;print(collections.Counter((r['lang'],r['ok']) for r in rows))
for r in rows:
    if not r['ok']: print('숨김',r['name'],r['note'])
import random;random.seed(1)

