/* ================= 작품 탭: 넷플릭스식 선반 (히어로 한 장 + 가로 줄) ================= */
var EXCAT=null;
function shPoster(t){return t.work&&(t.work.poster||t.work.backdrop)||tPoster(t)||''}
function shCard(t,o){o=o||{};const p=shPoster(t),ms=new Date(t.closes_at)-Date.now(),cls=t.closed_at||ms<=0;
 const tag=cls?'<em class="tg r">결과</em>':(t.opens_at&&Date.now()-new Date(t.opens_at)<864e5)?`<em class="tg n">${t.season>1?'시즌 '+t.season:'NEW'}</em>`:ms<864e5?'<em class="tg c">오늘 마감</em>':'';
 return `<a class="shc${o.wide?' wide':''}" href="#${esc(t.id)}"><span class="shp"${p?` style="background-image:url('${esc(p)}')"`:''}>${p?'':`<i>${esc(t.title)}</i>`}${tag}</span><b>${esc(t.title)}</b><small>${esc(verLabel(t.cat)||(CATS.find(c=>c.id===t.cat)||{}).name||'')}${cls?'':`, ${roundLeft(t)}`}</small></a>`}
function shRow(title,list,more,sub){if(!list.length)return '';return `<section class="shrow"><div class="shh"><h2>${title}</h2>${sub?`<small>${sub}</small>`:''}${more?`<button data-act="excat" data-c="${more}">모두</button>`:''}</div><div class="shs">${list.map(t=>shCard(t)).join('')}</div></section>`}
function renderShelves(){const box=$('#home');if(!box)return;const all=(TOPICS||[]).filter(t=>!t.opens_at||new Date(t.opens_at)<=new Date());
 const open=all.filter(t=>isOpen(t)),closed=all.filter(t=>!isOpen(t)).sort((a,b)=>new Date(b.closed_at||b.closes_at)-new Date(a.closed_at||a.closes_at));
 if(EXCAT){const c=CATS.find(x=>x.id===EXCAT)||{name:EXCAT};const l=all.filter(t=>t.cat===EXCAT);
  box.innerHTML=`<div class="exc"><button class="back" data-act="excat" data-c="" aria-label="선반으로 돌아가기">‹</button><div><h2>${esc(c.name)}</h2>${c.sub?`<small>${esc(c.sub)}</small>`:''}</div></div><div class="exg">${l.map(t=>shCard(t)).join('')||'<p class="empty3">아직 작품이 없어요</p>'}</div>`;return}
 const order=(typeof DECK!=='undefined'&&DECK.length)?DECK.map(d=>d.id):[];
 const rec=order.length?order.map(id=>open.find(t=>t.id===id)).filter(Boolean):open.slice().sort((a,b)=>(+b.buzz||0)-(+a.buzz||0));
 const hero=rec[0]||open[0];
 const soon=open.filter(t=>new Date(t.closes_at)-Date.now()<2*864e5).sort((a,b)=>new Date(a.closes_at)-new Date(b.closes_at));
 const fresh=open.filter(t=>t.opens_at&&Date.now()-new Date(t.opens_at)<3*864e5).sort((a,b)=>new Date(b.opens_at)-new Date(a.opens_at));
 const hb=hero&&((hero.work&&hero.work.backdrop)||shPoster(hero));
 box.innerHTML=`${hero?`<a class="exhero" href="#${esc(hero.id)}"${hb?` style="--bg:url('${esc(hb)}')"`:''}><span class="eh-in"><small>${USER?'내 취향 1순위':'오늘의 추천'}, ${esc(verLabel(hero.cat)||'')} ${roundLeft(hero)}</small><b>${esc(hero.title)}</b><span class="eh-cta">캐스팅하러 가기</span></span></a>`:''}
 ${shRow('⏰ 곧 마감',soon,'','이틀 안에 결과 발표')}
 ${shRow(USER?'💛 내 취향':'🔥 지금 뜨는 판',rec.slice(1,13),'')}
 ${shRow('✨ 새로 열린 판',fresh,'')}
 ${CATS.map(c=>shRow(esc(c.name),open.filter(t=>t.cat===c.id),c.id)).join('')}
 ${shRow('📣 결과 발표',closed.slice(0,12),'','지난 판의 1위')}
 <a class="exadd" href="#make"><b>+ 보고 싶은 작품 제안하기</b><small>새 판은 7일 동안 열려요</small></a>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act="excat"]');if(!b)return;EXCAT=b.dataset.c||null;renderShelves();scrollTo({top:0})});

/* 작품 상세 헤더를 포스터 히어로로 */
function topicHero(){const th=document.querySelector('#topicView .th'),t=typeof topic==='function'&&topic();if(!th||!t)return;const b=tBack(t);th.classList.add('hero');if(b)th.style.setProperty('--hb',`url('${b}')`);else th.style.removeProperty('--hb')}
