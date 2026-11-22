# src 조각을 합쳐 index.html을 만듦: head(기존 index.html의 <style> 앞부분) + CSS 4개 + body + JS 2개
import pathlib
root=pathlib.Path(__file__).resolve().parent.parent
idx=(root/'index.html').read_text()
head=idx[:idx.index('<style>')]
base=(root/'src/live_base.css')
if not base.exists(): base.write_text(idx[idx.index('<style>')+7:idx.index('/* 확장: 큰 배우 사진')] if '/* 확장: 큰 배우 사진' in idx else '')
css='\n'.join((root/f'src/{n}').read_text() for n in ['live_base.css','live_ext.css','live_v2.css','live_deck.css'])
body=(root/'src/live_body.html').read_text()
js=(root/'src/live_ext.js').read_text()+'\n'+(root/'src/live_v2.js').read_text()+'\n'+(root/'src/live_deck.js').read_text()+'\n'+(root/'src/live_insight.js').read_text()+'\n'+(root/'src/live_cinema.js').read_text()
k=body.rindex('}\n</script>')
body=body[:k]+js+'\n'+body[k:]
(root/'index.html').write_text(head+'<style>\n'+css+'\n</style>\n</head>\n<body>\n'+body+'\n</body>\n</html>\n')
print('built')
