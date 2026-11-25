# src 조각을 합쳐 index.html을 만듦: head(기존 index.html의 <style> 앞부분) + CSS 4개 + body + JS 2개
import pathlib
root=pathlib.Path(__file__).resolve().parent.parent
idx=(root/'index.html').read_text()
head=idx[:idx.index('<style>')]
base=(root/'src/live_base.css')
if not base.exists(): base.write_text(idx[idx.index('<style>')+7:idx.index('/* 확장: 큰 배우 사진')] if '/* 확장: 큰 배우 사진' in idx else '')
css='\n'.join((root/f'src/{n}').read_text() for n in ['live_base.css','live_ext.css','live_v2.css','live_deck.css','live_nav.css','live_app.css','live_c2.css'])
# 모바일 디자인을 모든 화면의 기본으로: 480px 이상을 겨냥한 모바일 규칙(max-width)은 항상 적용, 데스크탑 전용 규칙(min-width)은 뺌
import re
def mobile_only(c):
    out=[];i=0
    while True:
        m=re.search(r'@media\s*\(([^{]*)\{',c[i:])
        if not m: out.append(c[i:]);break
        a=i+m.start();out.append(c[i:a]);q=m.group(1)
        j=i+m.end();d=1
        while d:
            d+=(c[j]=='{')-(c[j]=='}');j+=1
        inner=c[i+m.end():j-1]
        mx=re.search(r'max-width:\s*(\d+)px',q);mn=re.search(r'min-width',q)
        if mn: pass
        elif mx and int(mx.group(1))>=480: out.append(inner)
        else: out.append(c[a:j])
        i=j
    return ''.join(out)
css=mobile_only(css)
body=(root/'src/live_body.html').read_text()
js=(root/'src/live_ext.js').read_text()+'\n'+(root/'src/live_v2.js').read_text()+'\n'+(root/'src/live_deck.js').read_text()+'\n'+(root/'src/live_insight.js').read_text()+'\n'+(root/'src/live_cinema.js').read_text()+'\n'+(root/'src/live_nav.js').read_text()+'\n'+(root/'src/live_fan.js').read_text()+'\n'+(root/'src/live_onb.js').read_text()+'\n'+(root/'src/live_topic.js').read_text()+'\n'+(root/'src/live_shelves.js').read_text()+'\n'+(root/'src/live_reel.js').read_text()+'\n'+(root/'src/live_vs.js').read_text()+'\n'+(root/'src/live_home.js').read_text()+'\n'+(root/'src/live_c2.js').read_text()
k=body.rindex('}\n</script>')
body=body[:k]+js+'\n'+body[k:]
(root/'index.html').write_text(head+'<style>\n'+css+'\n</style>\n</head>\n<body>\n'+body+'\n</body>\n</html>\n')
print('built')
