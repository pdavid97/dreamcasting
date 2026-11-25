/* 배우 페이지 팬 참여: 오늘의 응원, 인생작 투표, 이 배역 어때요 */
IC.crown='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z"/></svg>';
function fanZone(pid,name){const F=PAGE.fan||{};const fans=F.fans||[];
 return `<section class="fz" id="fz">
 <div class="cheer">
  <button class="cheer-b${F.mine?' on':''}" data-act="cheer" data-pid="${pid}" ${F.mine?'aria-pressed="true"':''}>${IC.heart}<b>${F.mine?'오늘 응원 완료':'오늘의 응원 보내기'}</b><small>${F.mine?'내일 또 와 주세요':'하루 한 번, 랭킹에 바로 반영'}</small></button>
  <div class="cheer-st">
   <span><b class="num">${fmt(F.today||0)}</b><small>오늘 응원</small></span>
   <span><b class="num">${fmt(F.week||0)}</b><small>이번 주</small></span>
   <span><b class="num">${F.rank?F.rank+'위':'-'}</b><small>주간 응원 랭킹${F.ranked?` (${fmt(F.ranked)}명 중)`:''}</small></span>
   <span><b class="num">${F.streak||0}일</b><small>내 연속 응원</small></span>
  </div>
 </div>
 ${fans.length?`<div class="fz-fans"><small>이번 달 ${esc(name)} 응원 왕</small>${fans.map((f,i)=>`<a href="#u/${encodeURIComponent(f.nick)}"><span class="fz-rk">${i+1}</span>${esc(f.nick)}<em>${f.n}일</em></a>`).join('')}</div>`:`<p class="dl" style="margin:8px 0 0">아직 이번 달 응원 기록이 없어요. 첫 응원 왕이 되어 보세요.</p>`}
 </section>`}
function dreamRoles(pid,name){const L=(PAGE.fan&&PAGE.fan.dream)||[];if(!L.length)return '';
 return `<section id="dream"><div class="sh"><h2>${esc(name)} 님, 이 배역은 어때요?</h2><span class="sub">투표 중인데 아직 후보가 아닌 배역</span></div>
 <div class="dream">${L.map(r=>`<article class="dr"${r.poster?` style="--bg:url('${esc(r.poster)}')"`:''}><div class="dr-t"><small>${esc(r.title)}</small><b>${esc(r.ch)} 역</b><span>${r.orig?`원작 ${esc(r.orig)}, `:''}후보 ${r.cands}명</span></div>
  <div class="dr-a"><button class="b sm buy" data-act="dream-add" data-rid="${r.rid}" data-nm="${esc(name)}">후보로 올리기</button><a class="b sm" href="#${esc(r.tid)}">보러 가기</a></div></article>`).join('')}</div>
 <p class="dl">후보로 올리면 내 한 표가 함께 들어가요. 배역 성별과 국적권이 맞는 작품만 골라 보여 드려요.</p></section>`}
function bestWorks(name){const F=PAGE.fan||{},B=F.best||[],tot=F.best_total||0;
 return `<section id="bestw"><div class="sh"><h2>팬이 뽑은 ${esc(name)} 인생작</h2><span class="sub">${fmt(tot)}명 참여</span></div>
 ${B.length?`<ol class="bw">${B.map((b,i)=>{const pct=tot?b.n/tot:0,mine=+F.my_best===+b.tmdb_id;return `<li class="${mine?'mine':''}"><button data-act="wk-open" data-m="${esc(b.media)}" data-id="${b.tmdb_id}" class="bw-p">${b.poster?`<img src="${esc(b.poster)}" alt="" loading="lazy">`:''}</button><div><b>${i+1}. ${esc(b.title)}</b>${mine?' <span class="pick">내 픽</span>':''}<div class="vb"><span><i style="width:${(pct*100).toFixed(1)}%"></i></span><b>${(pct*100).toFixed(0)}% ${fmt(b.n)}명</b></div></div></li>`}).join('')}</ol>`:'<p class="empty3">아직 투표가 없어요. 위 크레딧에서 작품 옆 왕관을 눌러 첫 인생작을 골라 주세요.</p>'}
 </section>`}
function refreshFan(){if(!PAGE||PAGE.kind!=='a')return;const name=PAGE.name;
 const z=$('#fz');if(z)z.outerHTML=fanZone(PAGE.pid,name);
 const bw=$('#bestw');if(bw)bw.outerHTML=bestWorks(name);
 const dr=$('#dream');if(dr){const h=dreamRoles(PAGE.pid,name);if(h)dr.outerHTML=h;else dr.remove()}
 document.querySelectorAll('.fc-best').forEach(b=>{const w=PAGE.works[+b.dataset.i];b.classList.toggle('on',!!(w&&PAGE.fan&&+PAGE.fan.my_best===+w.id))})}
function burst(el){const r=el.getBoundingClientRect();for(let i=0;i<14;i++){const s=document.createElement('span');s.className='burst';s.textContent='♥';const a=Math.random()*Math.PI*2,d=50+Math.random()*70;
 s.style.cssText=`left:${r.left+r.width/2}px;top:${r.top+r.height/2}px;--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d-30}px;font-size:${12+Math.random()*14}px`;document.body.appendChild(s);setTimeout(()=>s.remove(),900)}}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
 if(a==='cheer'){if(needLogin())return;if(PAGE.fan&&PAGE.fan.mine){toast('오늘 응원은 이미 보냈어요. 내일 또 만나요');return}
  burst(b);b.classList.add('on');try{PAGE.fan=Object.assign(PAGE.fan||{},await rpc('cheer',{pid:+b.dataset.pid}));track('cheer',{m:{pid:+b.dataset.pid}});refreshFan();toast(PAGE.fan.streak>1?`${PAGE.fan.streak}일 연속 응원 중이에요`:'응원을 보냈어요')}catch(err){b.classList.remove('on');toast(errMsg(err))}return}
 if(a==='best'){e.stopPropagation();if(needLogin())return;const w=PAGE.works[+b.dataset.i];if(!w)return;const m=w.type==='영화'?'movie':'tv';
  try{PAGE.fan=Object.assign(PAGE.fan||{},await rpc('pick_best',{pid:PAGE.pid,tid:+w.id,med:m,ttl:w.title,pst:w.poster||null}));track('best_pick',{m:{pid:PAGE.pid,id:w.id}});refreshFan();burst(b);toast(`${w.title}, 내 인생작으로 골랐어요`)}catch(err){toast(errMsg(err))}return}
 if(a==='dream-add'){if(needLogin())return;b.disabled=true;
  try{await rpc('add_candidate',{rid:+b.dataset.rid,nm:b.dataset.nm,pitch:null});track('dream_add',{r:+b.dataset.rid});toast('후보로 올리고 한 표 넣었어요');const card=b.closest('.dr');if(card){card.classList.add('done');b.textContent='후보 등록 완료'}}catch(err){b.disabled=false;toast(errMsg(err))}return}
});

/* 배우 페이지: 엔딩 크레딧(수상, 출연작), 자주 함께한 배우 */
IC.laurel='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M7 20c-3-2-4.5-5.5-4-9.5M17 20c3-2 4.5-5.5 4-9.5"/><path d="M4.2 14.5c1.3.2 2.4-.3 3-1.3M3.3 10.6c1.2.5 2.4.2 3.2-.7M4.3 6.8c1 .7 2.3.7 3.2 0M19.8 14.5c-1.3.2-2.4-.3-3-1.3M20.7 10.6c-1.2.5-2.4.2-3.2-.7M19.7 6.8c-1 .7-2.3.7-3.2 0"/><path d="M12 6.5l1.2 2.5 2.7.3-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.3z"/></svg>';
function crNorm(t){return String(t||'').replace(/[\s:,.!?'"《》<>()\-]/g,'').toLowerCase()}
function crFind(ws,t){const k=crNorm(t);return k?ws.find(w=>crNorm(w.title)===k)||null:null}
function crTopic(w){if(typeof TOPICS==='undefined'||!w||!w.id)return null;const kn=w.type==='영화'?'영화':'드라마',now=Date.now();return TOPICS.find(t=>t.work&&+t.work.tmdb_id===+w.id&&(!t.work.kind||t.work.kind===kn)&&(!t.opens_at||Date.parse(t.opens_at)<=now))||null}
function crClean(ch){return String(ch||'').replace(/\s*\(voice\)|\s*\(uncredited\)/gi,'').trim()}
function credRoll(name,awards,works,prof){
 const ws=(works||[]).filter(w=>w&&w.title),H=PAGE&&PAGE.hon,pid=PAGE&&PAGE.pid;
 if(!ws.length&&!(awards||[]).length)return '';
 const yrs=ws.map(w=>+w.year).filter(y=>y>1900&&y<=NOW_Y),y0=yrs.length?Math.min(...yrs):null;
 const disp=esc(dispName(ORIG[name]||name).replace(/\s*\(.*\)$/,''));
 const mOf=w=>w.type==='영화'?'movie':'tv';
 /* 본인 수상: 수상 정보를 받았으면 작품 id로, 아직이면 작품명으로 붙임. 작품과 이어지지 않는 상은 맨 끝에 따로 */
 const mine={},etc=[];
 if(H&&H.p){H.p.forEach(a=>{const w=a.id?ws.find(x=>+x.id===+a.id&&mOf(x)===a.m):null;if(w)(mine[w.id]=mine[w.id]||[]).push(a);else etc.push(a)})}
 else (awards||[]).filter(a=>a&&a.name).forEach(a=>{const w=a.work?crFind(ws,a.work):null;const x={n:a.name,y:a.year||''};if(w)(mine[w.id]=mine[w.id]||[]).push(x);else etc.push(Object.assign(x,a.work?{wk:a.work}:{}))});
 const hon=w=>(H&&H.w&&H.w[mOf(w)+':'+w.id])||[];
 const nAw=Object.values(mine).reduce((s,x)=>s+x.length,0)+etc.length,nHon=ws.filter(w=>hon(w).length).length;
 const lau=`<i class="ic">${IC.laurel}</i>`,star='<i class="ic st">★</i>';
 const row=w=>{const m=mOf(w),ch=crClean(w.ch),tp=crTopic(w),pi=(PAGE&&PAGE.works||[]).indexOf(w),wb=`data-act="wk-open" data-m="${m}" data-id="${w.id}"${pi>=0?` data-i="${pi}"`:''}`,i=ws.indexOf(w),my=mine[w.id]||[],hw=hon(w);
  return `<div class="cr-it cw${my.length?' won':''}${hw.length?' hon':''}">
  <button class="cr-po" ${wb} aria-label="${esc(w.title)} 자세히">${w.poster?`<img src="${esc(w.poster)}" alt="" loading="lazy">`:`<span>${esc(w.title.slice(0,6))}</span>`}</button>
  <div class="cr-tx"><em>${esc(w.year||'공개 예정')}${w.year&&+w.year<=NOW_Y?`<button class="cr-rate" ${wb}>☆ 연기 평가</button>`:''}</em><button class="cr-ln b1" ${wb}>${esc(w.title)}</button>
   ${ch?(tp?`<a class="cr-ln" href="#${esc(tp.id)}" title="광장의 ${esc(tp.title)} 가상 캐스팅">${esc(ch)} 역</a>`:`<button class="cr-ln" ${wb}>${esc(ch)} 역</button>`):''}
   ${my.map(a=>`<span class="cr-aw me">${lau}${esc(a.n)}${a.y?` <small>${esc(a.y)}</small>`:''}</span>`).join('')}
   ${hw.map(a=>`<span class="cr-aw wk">${star}작품 수상: ${esc(a.n)}${a.y?` <small>${esc(a.y)}</small>`:''}</span>`).join('')}
   <span class="cr-act">${heartBtn(m,w.id,w.title,w.year,w.poster,'person:'+pid)}<button class="fc-best${PAGE&&PAGE.fan&&+PAGE.fan.my_best===+w.id?' on':''}" data-act="best" data-i="${i}" aria-label="${esc(w.title)}을 내 인생작으로" title="내 인생작으로">${IC.crown}</button></span>
  </div></div>`};
 const list=ws.slice().sort((a,b)=>(+b.year||9999)-(+a.year||9999));
 const body=`<div class="cr-name"><small>starring</small><b>${disp}</b></div>
  ${list.length?`<div class="cr-sec"><b>필모그래피</b></div>${list.map(row).join('')}`:''}
  ${etc.length?`<div class="cr-sec">${lau}<b>그 밖의 수상</b></div>${etc.map(a=>`<div class="cr-it aw"><em>${esc(a.y||'')}</em><b>${esc(a.n)}</b>${a.wk?`<span>《${esc(a.wk)}》</span>`:''}</div>`).join('')}`:''}
  <div class="cr-end"><small>and many more to come</small></div>`;
 return `<section class="cred" id="cred"><div class="cr-stat">
  ${nAw?`<span class="gold">${lau}<b class="num">${nAw}</b><small>수상</small></span>`:''}
  <span><b class="num">${ws.length}</b><small>작품</small></span>
  ${nHon?`<span class="gold"><i class="ic st">★</i><b class="num">${nHon}</b><small>작품상 받은 작품</small></span>`:y0?`<span><b class="num">${y0}</b><small>첫 작품</small></span>`:''}</div>
  <div class="cr-win" data-act="cr-toggle" role="region" aria-label="${disp} 필모그래피와 수상 크레딧, 눌러서 멈춤"><div class="cr-roll"><div class="cr-pg">${body}</div><div class="cr-pg" aria-hidden="true">${body}</div></div></div>
  <p class="cr-src">누르면 멈춰요. 포스터와 작품명은 작품 상세로, 배역은 광장 판이나 작품 상세로. 수상: Wikidata, 출연작: TMDB${prof&&prof.tmdb?`, <a href="${esc(prof.tmdb)}" target="_blank" rel="noopener">TMDB 전체 필모</a>`:''}</p>
  ${prof&&prof.bio?`<details class="talk"><summary>소개</summary><p class="bio">${esc(prof.bio)}</p></details>`:''}</section>`}
async function loadHonors(pid,prof){const tp=prof&&prof.tmdb&&(String(prof.tmdb).match(/person\/(\d+)/)||[])[1];const ws=(PAGE&&PAGE.works)||[];
 if(!tp&&!ws.length)return;
 try{const r=await fetch(SB_URL+'/functions/v1/honors',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ANON,apikey:ANON},body:JSON.stringify({person:tp?+tp:null,works:ws.slice(0,120).map(w=>[w.type==='영화'?'movie':'tv',+w.id])})});
  const d=await r.json();if(!r.ok||d.error||!PAGE||PAGE.pid!==pid)return;if(!d.p_ok&&!Object.keys(d.w||{}).length)return;
  PAGE.hon={p:d.p_ok?d.p:null,w:d.w||{}};if(!PAGE.hon.p)delete PAGE.hon.p;
  const c=$('#cred');if(!c)return;const keep=c.querySelector('.cr-win.hold');c.outerHTML=credRoll(PAGE.name||'',PAGE.awards||[],ws,PAGE.prof);if(keep){const w=document.querySelector('#cred .cr-win');if(w)w.classList.add('hold')}bindCred()}catch(e){}}
function bindCred(){const w=document.querySelector('#cred .cr-win');if(!w)return;const pg=w.querySelector('.cr-pg');if(!pg)return;
 const h=pg.offsetHeight;if(h<=w.clientHeight+20){w.classList.add('still');return}
 w.style.setProperty('--crd',Math.max(20,Math.round(h/30))+'s');w.classList.add('run')}
document.addEventListener('click',e=>{const w=e.target.closest('[data-act="cr-toggle"]');if(!w||e.target.closest('a,button'))return;w.classList.toggle('hold')});

async function loadCostars(pid,name){let L=[];try{L=await rpc('costars',{pid,lim:12})||[]}catch(e){return}
 if(!PAGE||PAGE.pid!==pid)return;const box=$('#costar');if(!box||!L.length)return;
 try{await loadNames(L.map(x=>x.name))}catch(e){}
 if(!PAGE||PAGE.pid!==pid)return;
 const disp=n=>esc(dispName(n).replace(/\s*\(.*\)$/,''));
 box.innerHTML=`<div class="sh"><h2>${disp(name)} 님과 자주 함께한 배우</h2><span class="sub">같은 작품 주요 배역 기준</span></div>
 <div class="co">${L.map(x=>{const u=IMG['p:'+x.name]||x.photo||'',w=(x.works||[]).slice(0,3),h='#a/'+encodeURIComponent(x.name)+'~'+x.id;return `<div class="co-c"><a class="co-ph" href="${h}" aria-label="${disp(x.name)} 페이지"${u?` style="background-image:url('${esc(u)}')"`:''}>${u?'':esc(x.name[0])}</a><a class="co-nm" href="${h}"><b>${disp(x.name)}</b></a><em>${x.n}편 함께</em><span class="co-w">${w.map(v=>v.id?`<button data-act="wk-open" data-m="${esc(v.m||'movie')}" data-id="${v.id}">${esc(v.t)}</button>`:`<span>${esc(v.t)}</span>`).join('')}</span></div>`}).join('')}</div>`;
 box.hidden=false;flowRow(box.querySelector('.co'),'.co-c',0.022)}
(function(){const f=bindFilmCarousel;bindFilmCarousel=function(){f.apply(this,arguments);bindCred();
 const tr=$('#fcTrack');if(!tr||tr._flow)return;const orig=[...tr.querySelectorAll('.fc-c')],N=orig.length;if(N<3)return;
 const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
 /* 끝없이 흐르도록 카드 한 벌을 뒤에 복제(읽기 도구에서는 숨김) */
 if(!calm){orig.forEach(c=>{const k=c.cloneNode(true);k.classList.add('fc-dup');k.setAttribute('aria-hidden','true');k.querySelectorAll('button,a').forEach(x=>x.tabIndex=-1);tr.appendChild(k)});tr.classList.add('fc-run')}
 const cards=[...tr.querySelectorAll('.fc-c')],loopW=()=>cards[N].offsetLeft-cards[0].offsetLeft;
 const mark=()=>{const mid=tr.scrollLeft+tr.clientWidth/2;let b=0,bd=1e9;cards.forEach((c,i)=>{const d=Math.abs(c.offsetLeft+c.offsetWidth/2-mid);if(d<bd){bd=d;b=i}});
  cards.forEach((c,i)=>{c.classList.toggle('on',i===b);c.classList.toggle('lf',i<b);c.classList.toggle('rt',i>b)});
  const ix=$('#fcIdx'),yr=$('#fcYr');if(ix)ix.textContent=(b%N)+1;if(yr)yr.textContent=cards[b].dataset.year||''};
 tr.addEventListener('scroll',()=>requestAnimationFrame(mark),{passive:true});mark();tr._flow=1;if(calm)return;
 let hold=0,pos=tr.scrollLeft,last=0;const stop=ms=>hold=Date.now()+ms;
 ['pointerdown','wheel','touchstart','keydown','focusin'].forEach(ev=>tr.addEventListener(ev,()=>stop(5000),{passive:true}));
 tr.addEventListener('mouseenter',()=>stop(1e9));tr.addEventListener('mouseleave',()=>stop(800));
 const fc=tr.closest('.fc');if(fc)fc.addEventListener('click',e=>{if(e.target.closest('.fc-b,.fc-y'))stop(6000)},true);
 const step=t=>{if(!document.body.contains(tr))return;const dt=last?Math.min(64,t-last):16;last=t;
  const r=tr.getBoundingClientRect(),vis=r.bottom>0&&r.top<innerHeight&&!document.hidden;
  if(Date.now()>hold&&vis){if(Math.abs(tr.scrollLeft-pos)>2)pos=tr.scrollLeft;pos+=dt*0.045;const L=loopW();if(L>0&&pos>=L)pos-=L;tr.scrollLeft=pos}else pos=tr.scrollLeft;
  requestAnimationFrame(step)};
 requestAnimationFrame(step)}})();

/* 가로 줄을 끊김 없이 천천히 흘리기(카드 한 벌 복제). 손대면 5초 멈춤, 마우스 올리면 멈춤 */
function flowRow(tr,sel,speed){if(!tr||tr._flow)return;const orig=[...tr.querySelectorAll(sel)],N=orig.length;tr._flow=1;
 if(N<3||matchMedia('(prefers-reduced-motion: reduce)').matches)return;if(tr.scrollWidth<=tr.clientWidth+8)return;
 orig.forEach(c=>{const k=c.cloneNode(true);k.setAttribute('aria-hidden','true');k.querySelectorAll('button,a').forEach(x=>x.tabIndex=-1);tr.appendChild(k)});tr.classList.add('fc-run');
 const all=[...tr.querySelectorAll(sel)],loopW=()=>all[N].offsetLeft-all[0].offsetLeft;
 let hold=0,pos=tr.scrollLeft,last=0;const stop=ms=>hold=Date.now()+ms;
 ['pointerdown','wheel','touchstart','keydown','focusin'].forEach(ev=>tr.addEventListener(ev,()=>stop(5000),{passive:true}));
 tr.addEventListener('mouseenter',()=>stop(1e9));tr.addEventListener('mouseleave',()=>stop(800));
 const step=t=>{if(!document.body.contains(tr))return;const dt=last?Math.min(64,t-last):16;last=t;const r=tr.getBoundingClientRect(),vis=r.bottom>0&&r.top<innerHeight&&!document.hidden;
  if(Date.now()>hold&&vis){if(Math.abs(tr.scrollLeft-pos)>2)pos=tr.scrollLeft;pos+=dt*speed;const L=loopW();if(L>0&&pos>=L)pos-=L;tr.scrollLeft=pos}else pos=tr.scrollLeft;requestAnimationFrame(step)};
 requestAnimationFrame(step)}

/* 트리비아: 작품과 배우마다 모아 둔 사실, 누르면 그 작품, 배우, 판으로 */
const TV_IC={pair:'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5M12 20c0-3 2-5 4-5s6 2 6 5',chart:'M4 20V10M10 20V4M16 20v-7M22 20H2',globe:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20',ticket:'M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3zM14 4v12',mask:'M4 5h16v6a8 8 0 0 1-16 0zM8 10h2M14 10h2M9 15c2 1 4 1 6 0',star:'M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z',vote:'M4 12l5 5L20 6',genre:'M4 4h16v16H4zM4 9h16M9 4v16',film:'M3 5h18v14H3zM7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4'};
function triviaHTML(L,title,inModal){if(!L||!L.length)return '';const go=inModal?' data-act="wk-go"':'';
 const lk=x=>x.a?`<a class="tv-l" href="#a/${encodeURIComponent(x.a)}"${go}>${esc(x.n||x.a)}</a>`:x.w?`<button class="tv-l" data-act="wk-open" data-m="${esc(x.w[0])}" data-id="${+x.w[1]}">《${esc(x.n||'')}》</button>`:x.tp?`<a class="tv-l hot" href="#${esc(x.tp)}"${go}>${esc(x.n||'')} 판</a>`:'';
 return `<div class="tv"><div class="tv-h"><b>${esc(title)}</b><small>${L.length}개</small></div><div class="tv-row">${L.map(x=>`<article class="tv-c"><i class="tv-i"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${TV_IC[x.i]||TV_IC.star}"/></svg></i><p>${esc(x.t)}</p>${(x.l||[]).length?`<div class="tv-ls">${x.l.map(lk).join('')}</div>`:''}</article>`).join('')}</div></div>`}
async function loadPersonTrivia(pid,name){let L=[];try{L=await rpc('person_trivia',{pid})||[]}catch(e){return}if(!PAGE||PAGE.pid!==pid||!L.length)return;
 const box=$('#trivia');if(!box)return;box.innerHTML=triviaHTML(L,`${dispName(name).replace(/\s*\(.*\)$/,'')} 님에 대해 알고 계셨나요`);box.hidden=false}
(function(){const f=renderWork;renderWork=function(){f.apply(this,arguments);const d=WK;if(!d)return;const key=d.media+':'+d.id;
 (d._tv?Promise.resolve(d._tv):rpc('work_trivia',{med:d.media,tid:+d.id})).then(L=>{d._tv=L||[];if(!WK||WK.media+':'+WK.id!==key||!L||!L.length)return;const box=$('#wkBox');if(!box||box.querySelector('.tv'))return;
  const at=box.querySelector('.wk-sec');const h=`<div class="wk-sec wk-tv">${triviaHTML(L,'이 작품, 알고 계셨나요',true)}</div>`;if(at)at.insertAdjacentHTML('beforebegin',h);else box.insertAdjacentHTML('beforeend',h)}).catch(()=>{})}})();
