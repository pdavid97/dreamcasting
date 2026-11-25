import json,time
exec(open('disc.py').read().split('G={')[0])
D=json.load(open('disc.json'));R=json.load(open('raw.json'))
works={}
for g,L in D.items():
    for x in L:works.setdefault(x['k'],set()).add(g)
gm={'universe':'mcu','dc':'dc','disney':'disney_live','musical':'musical_film','anime':'anime_live'}
wsrc={}
for g,L in R.items():
    for b in L:
        k=('movie:'+b['wtm']['value']) if 'wtm' in b else ('tv:'+b['wtv']['value']) if 'wtv' in b else None
        if not k:continue
        works.setdefault(k,set()).add(gm[g])
        if 'srcL' in b:wsrc[k]=(b['src']['value'].split('/')[-1],b['srcL']['value'])
# 대표 뮤지컬 영화 이름으로 보강
extra=['Wicked','Wicked: For Good','Rent','Les Misérables','The Phantom of the Opera','Chicago','Mamma Mia!','Dreamgirls','Hamilton','In the Heights','Into the Woods','West Side Story','Cats','Dear Evan Hansen','Hairspray','Evita','Sweeney Todd: The Demon Barber of Fleet Street','Mean Girls','The Color Purple','Matilda the Musical','Grease','Moulin Rouge!','Annie','Little Shop of Horrors','Jesus Christ Superstar','Cabaret','Fiddler on the Roof','The Sound of Music','My Fair Lady','Hedwig and the Angry Inch','The Prom','Cyrano','Everybody\'s Talking About Jamie','Tick, Tick... Boom!','A Chorus Line','Nine','Jersey Boys','The Producers','Mamma Mia! Here We Go Again','Beauty and the Beast','Aladdin','The Lion King','The Little Mermaid','Mulan','Cinderella','Snow White','Pinocchio','Lilo & Stitch','Dumbo','Lady and the Tramp','Peter Pan & Wendy','The Jungle Book','Alice in Wonderland','Maleficent','Cruella','Christopher Robin','Moana','How to Train Your Dragon','Ghost in the Shell','Alita: Battle Angel','Death Note','Cowboy Bebop','One Piece','Dragonball Evolution','Speed Racer','Edge of Tomorrow','Oldboy','Battle Angel']
print('works',len(works))
json.dump({'works':{k:sorted(v) for k,v in works.items()},'src':wsrc,'extra':extra},open('works.json','w'),ensure_ascii=False)
