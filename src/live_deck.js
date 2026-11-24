
/* ================= 카드 덱(첫 화면): 화제성과 내 취향 순으로 한 장에 질문 하나 ================= */
/* ---- 화면 행동 기록(데이터 플라이휠 입력) ---- */
const UXQ=[];let uxTimer=null;
function track(k,o={}){UXQ.push({k,t:o.t||null,r:o.r||null,c:o.c||null,ms:o.ms!=null?Math.round(o.ms):null,m:o.m||null});if(UXQ.length>=20)flushUx();else if(!uxTimer)uxTimer=setTimeout(flushUx,5000)}
function flushUx(){clearTimeout(uxTimer);uxTimer=null;if(!UXQ.length)return;const evs=UXQ.splice(0,50);rpc('log_ux',{sid:SID,evs}).catch(()=>{})}
addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){cardLeave();flushUx()}});

let DECK=[],DI=0,DR=0,DECKV=false,deckBusy=false,cardAt=0,cardKey='',DONE_T=null;
const SLOT={male_lead:'남주',female_lead:'여주',male_sub:'남자 서브',female_sub:'여자 서브',lead:'주연',support:'조연'};
const WHY={fan:'내가 팬인 배우가 후보',taste:'내 취향과 맞는 작품',buzz:'이번 주 화제'};
const PENDING_K='dcPending1';
function pend(){try{return JSON.parse(localStorage.getItem(PENDING_K)||'[]')}catch(e){return[]}}
function setPend(a){try{localStorage.setItem(PENDING_K,JSON.stringify(a))}catch(e){}}

async function loadDeck(){if(deckBusy)return;deckBusy=true;try{loadRounds();DECK=passSort(onbSort(await rpc('vote_deck',{lim:24})||[])).slice(0,16);
 const keep=DECK.findIndex(d=>d.id===(DECK[DI]||{}).id);DI=Math.max(0,keep);
 const names=DECK.flatMap(d=>d.roles.flatMap(r=>[...(r.orig?[r.orig]:[]),...r.cands.map(c=>c.name)]));if(DECKV)renderDeck();await loadNames(names)}catch(e){}deckBusy=false;if(DECKV)renderDeck()}
function cardLeave(){if(cardKey&&cardAt){const [t,r]=cardKey.split('|');track('card_view',{t,r:+r||null,ms:performance.now()-cardAt});cardAt=0;cardKey=''}}
function curTopic(){return DECK[DI]}
function curRole(){const t=curTopic();if(!t)return null;return t.roles[DR]}
function firstOpenRole(t){const i=t.roles.findIndex(r=>!r.mine&&!pend().some(p=>p.rid===r.id));return i<0?t.roles.length:i}

function showDeck(on){DECKV=on;const d=$('#deck');if(!d)return;d.hidden=!on;['tabs','shelf'].forEach(id=>{const e=$('#'+id);if(e)e.hidden=on});const desk=document.querySelector('.desk');if(desk)desk.hidden=on;
 if(on){track('deck_view');if(!DECK.length)loadDeck();else renderDeck()}else cardLeave()}

function renderDeck(){const box=$('#deck');if(!box||!DECKV)return;const t=curTopic();cardLeave();
 if(!DECK.length){box.innerHTML=`<div class="dk-empty">${deckBusy?'카드를 고르는 중이에요':'지금 열린 투표가 없어요'}</div>`;return}
 if(!t){deckEnd(box);return}
 if(DR>=t.roles.length){renderDone(t);return}
 const r=t.roles[DR],p=pend().find(x=>x.rid===r.id),picked=r.mine||(p&&p.cid);
 const cands=r.cands.slice(0,10),more=r.cands.length-cands.length;
 const tot=r.cands.reduce((a,c)=>a+(c.votes||0),0);
 const news=(t.news||[])[0];
 box.innerHTML=`<div class="dk dk2">${storyRings()}
 <article class="dk-card" id="dkCard" style="${t.poster?`--bg:url('${esc(t.poster)}')`:''}">
  <header class="dk-head"><div><button class="dk-wk" data-act="works" aria-label="오늘의 작품 모두 보기">작품 ${DI+1} / ${DECK.length} <i aria-hidden="true">▾</i></button><small>${esc(verLabel(t.cat)||CATS.find(c=>c.id===t.cat)?.name||'')}${t.season>1?`, 시즌 ${t.season}`:''}, <b class="${new Date(t.closes_at)-Date.now()<864e5?'urg':''}">${roundLeft(t)}</b></small><h2><a class="dk-tl" href="#${esc(t.id)}">${esc(t.title)}</a></h2></div>
   <div class="dk-steps" aria-label="배역 진행">${t.roles.map((x,i)=>`<i class="${i<DR?'ok':i===DR?'on':''}" title="${esc(SLOT[x.slot]||'')} ${esc(x.ch)}"></i>`).join('')}</div></header>
  <div class="dk-q"><span class="slot">${esc(SLOT[r.slot]||'배역')}</span><h3>${esc(r.ch)} 역은 누구?</h3>${r.descr?`<p class="ds">${esc(r.descr)}</p>`:''}${dialHintOn()?'<p class="hint">돌려서 고르고, 맨 위 사진을 한 번 더 탭하면 확정</p>':''}</div>
  ${dialHTML(t,r,cands,picked,tot)}
  ${more>0?`<a class="dk-more" href="#${esc(t.id)}">후보 ${more}명 더</a>`:''}
 </article>
 <div class="dk-acts"><button class="dk-btn skip" data-act="dk-skip" aria-label="이 배역만 넘기기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg><span>${DR<t.roles.length-1?'이 배역 패스':'마지막 배역 패스'}</span></button><a class="dk-btn mid" href="#${esc(t.id)}" aria-label="작품 자세히"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg><span>작품 보기</span></a><button class="dk-btn next" data-act="dk-nexttopic" aria-label="이 작품 통째로 넘기기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l8 7-8 7M13 5l8 7-8 7"/></svg><span>${DECK[DI+1]?`다음: ${esc(DECK[DI+1].title)}`:'작품 패스'}</span></button></div>
 </div>`;
 cardAt=performance.now();cardKey=t.id+'|'+r.id;bindSwipe();bindDial();stripFocus()}

/* 오늘의 작품 캐러셀: 관심 있는 작품으로 바로 가고, 없으면 작품 추가 */
function dialHintOn(){try{return (+localStorage.getItem('dialVotes')||0)<3}catch(e){return true}}
function deckStrip(){return `<nav class="dkst" id="dkst" aria-label="오늘의 작품">${DECK.map((d,i)=>{const n=d.roles.length,m=d.roles.filter(r=>r.mine).length;return `<button class="st${i===DI?' on':''}${m===n?' done':''}" data-act="dk-goto" data-i="${i}" aria-label="${esc(d.title)}${m===n?', 투표 완료':m?`, ${m}/${n} 배역 투표`:''}"><span class="sp"${d.vposter||d.poster?` style="background-image:url('${esc(d.vposter||d.poster)}')"`:''}>${m===n?'<i>✓</i>':m?`<i>${m}/${n}</i>`:''}</span>${stTag(d)}<b>${esc(d.title)}</b></button>`}).join('')}<a class="st add" href="#make"><span class="sp">+</span><b>작품 추가</b></a></nav>`}
function stripFocus(){const st=$('#dkst'),on=st&&st.querySelector('.st.on');if(on)st.scrollLeft=Math.max(0,on.offsetLeft-st.clientWidth/2+on.clientWidth/2)}
function renderDone(t){const box=$('#deck');track('result_view',{t:t.id});
 box.innerHTML=`<div class="dk">${storyRings()}<div class="dk-top"><span class="dk-count">작품 ${DI+1} / ${DECK.length}</span></div>
 <article class="dk-card done" style="${t.poster?`--bg:url('${esc(t.poster)}')`:''}"><header class="dk-head"><div><small>내 캐스팅 완성</small><h2>${esc(t.title)}</h2></div></header>
 <div class="dk-res" id="dkRes">${t.roles.map(r=>{const mine=r.cands.find(c=>c.id===r.mine),tot=r.cands.reduce((a,c)=>a+(c.votes||0),0),top=[...r.cands].sort((a,b)=>(b.votes||0)-(a.votes||0))[0];
  return `<div class="rr"><span class="slot">${esc(SLOT[r.slot]||'')}</span><b>${esc(r.ch)}</b><span>${mine?`내 픽 <strong>${esc(mine.name)}</strong>${tot?` ${Math.round((mine.votes||0)/tot*100)}%`:''}`:'건너뜀, 투표하면 결과 공개'}</span>${mine&&top&&tot?`<small>1위 ${esc(top.name)} ${Math.round((top.votes||0)/tot*100)}%</small>`:''}</div>`}).join('')}</div>
 <div id="dkCombo" class="dk-combo">${t.seen?'내 조합 순위를 불러오는 중이에요':'한 배역 이상 투표하면 결과와 토론방이 열려요'}</div></article>
 <div class="dk-rel" id="dkRel"></div><div class="dk-acts"><a class="dk-btn mid" href="#${esc(t.id)}/talk">결과와 토론방</a><button class="dk-btn next" data-act="dk-nexttopic">다음 작품</button></div></div>`;
 relNext(t);
 if(t.seen)rpc('topic_combos',{tid:t.id}).then(cs=>{const el=$('#dkCombo');if(!el)return;const i=(cs||[]).findIndex(c=>c.mine);el.innerHTML=i>=0?`내 조합은 <b>${(cs||[]).length}개 조합 중 ${i+1}위</b>, 같은 조합 ${cs[i].users}명. 토론 ${cs[i].comments}개`:`모든 배역을 고르면 조합 순위에 올라가요. 지금 조합 ${(cs||[]).length}개`}).catch(()=>{})}

function nextRole(){const t=curTopic();if(!t)return;cardLeave();DR++;if(DR>=t.roles.length){}renderDeck()}
function nextTopic(){cardLeave();DI++;const t=curTopic();DR=t?firstOpenRole(t):0;renderDeck()}

async function deckPick(rid,cid){const t=curTopic(),r=curRole();if(!t||!r||r.id!==rid)return;track('cand_tap',{t:t.id,r:rid,c:cid});
 if(r.mine){toast('이 배역은 이미 투표했어요');nextRole();return}
 if(!USER||!PROF){if(pend().filter(p=>p.rid!==rid).length<3){await guestPick(t,r,cid);return}const a=pend().filter(p=>p.rid!==rid);a.push({tid:t.id,rid,cid,at:Date.now()});setPend(a);track('login_prompt',{t:t.id,r:rid,c:cid});openLoginSheet(true);renderDeck();return}
 try{await rpc('cast_vote_src',{rid,cid,src:'wheel'});castStamp();r.mine=cid;t.seen=true;try{localStorage.setItem('dialVotes',(+localStorage.getItem('dialVotes')||0)+1)}catch(e){}track('vote_done',{t:t.id,r:rid,c:cid});showUndo(rid,`${r.ch} 역 한 표 반영`);
  const card=$('#dkCard');if(card){card.classList.add('fly-r');await new Promise(o=>setTimeout(o,220))}
  // 결과 공개를 위해 덱을 새로 받아 득표를 채움
  const fresh=await rpc('vote_deck',{lim:16}).catch(()=>null);const ft=fresh&&fresh.find(x=>x.id===t.id);if(ft){Object.assign(t,{seen:ft.seen,roles:ft.roles})}
  nextRole()}catch(e){toast(errMsg(e))}}

async function flushPending(){if(!USER||!PROF)return;const a=pend();if(!a.length)return;setPend([]);let ok=0;
 for(const p of a){try{await rpc('cast_vote_src',{rid:p.rid,cid:p.cid,src:'wheel'});ok++;track('vote_done',{t:p.tid,r:p.rid,c:p.cid,m:{after_login:true}})}catch(e){}}
 if(ok){toast(`로그인 전에 고른 ${ok}표를 반영했어요`);track('login_done',{m:{flushed:ok}})}await loadDeck();const t=curTopic();if(t)DR=Math.min(DR+0,t.roles.length)}

function openLoginSheet(g){const m=$('#loginSheet');if(!m)return;const n=pend().length,h=$('#lsH'),pp=m.querySelector('p');if(h&&pp){if(g&&n){h.textContent=`${n}표를 골랐어요! 로그인하면 바로 저장돼요`;pp.textContent='7일 뒤 결과 발표 때 내 픽이 1위면 적중 포인트를 받아요. 구글 계정으로 3초면 끝나요.'}else{h.textContent='로그인하면 이 표가 바로 반영돼요';pp.textContent='고른 후보는 저장해 뒀어요. 구글 계정으로 3초면 끝나요.'}}m.classList.add('on');setTimeout(()=>{const b=m.querySelector('[data-act=login]');if(b)b.focus()},50)}

/* 스와이프: 왼쪽 = 건너뛰기, 오른쪽 = 다음 작품 */
function bindSwipe(){const c=$('#dkCard');if(!c)return;let x0=null,dx=0,id=null;
 c.addEventListener('pointerdown',e=>{if(e.target.closest('button,a,.dial'))return;x0=e.clientX;id=e.pointerId;c.setPointerCapture(id);c.style.transition='none'});
 c.addEventListener('pointermove',e=>{if(x0==null)return;dx=e.clientX-x0;c.style.transform=`translateX(${dx}px) rotate(${dx/25}deg)`});
 const end=()=>{if(x0==null)return;c.style.transition='';const t=curTopic(),r=curRole();
  if(dx<-90){track('skip',{t:t&&t.id,r:r&&r.id,m:{swipe:true}});c.classList.add('fly-l');setTimeout(nextRole,200)}
  else if(dx>90){track('topic_skip',{t:t&&t.id,m:{swipe:true}});c.classList.add('fly-r');setTimeout(nextTopic,200)}
  else c.style.transform='';x0=null;dx=0};
 c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end)}
addEventListener('keydown',e=>{if(!DECKV||e.target.closest('input,textarea,select'))return;
 if(DIAL&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();dialStep(e.key==='ArrowLeft'?-1:1);return}
 if(DIAL&&e.key==='Enter'&&!e.target.closest('button,a')){e.preventDefault();dialConfirm();return}
 if(e.key==='ArrowDown'){const t=curTopic(),r=curRole();track('skip',{t:t&&t.id,r:r&&r.id,m:{key:true}});nextRole()}if(e.key==='ArrowUp')nextTopic()});

/* ---- 다이얼: 원작 배우를 가운데, 가상 후보를 둘레에. 돌려서 12시 방향에 온 후보가 선택 대기, 가운데 버튼이나 다시 탭하면 확정 ---- */
let DIAL=null;
function dialHTML(t,r,cands,picked,tot){const ou=r.orig?IMG['p:'+r.orig]:null,N=cands.length+1;
 const start=Math.max(0,cands.findIndex(c=>c.id===picked));
 return `<div class="dial" id="dial" data-n="${N}" data-start="${start}" tabindex="0" role="listbox" aria-label="${esc(r.ch)} 후보 다이얼, 좌우 화살표로 돌리고 Enter로 한 표">
  <div class="dl-ring" aria-hidden="true">${Array.from({length:N},(_,i)=>`<i style="--a:${i*360/N}deg"></i>`).join('')}</div>
  ${cands.map((c,i)=>{const u=IMG['p:'+c.name],pct=r.mine&&tot?Math.round((c.votes||0)/tot*100):null;
   return `<button class="dl-c${picked===c.id?' sel':''}" data-i="${i}" data-rid="${r.id}" data-cid="${c.id}" data-name="${esc(c.name)}" data-age="${esc(ageTxt(c.name)||'')}" data-pct="${pct==null?'':pct}" data-recent="${esc(c.blurb&&c.blurb.recent?`최근작 《${c.blurb.recent.t}》${c.blurb.recent.y?` (${c.blurb.recent.y})`:''}`:'')}" data-why="${esc(JSON.stringify(((c.blurb&&c.blurb.reasons)||(c.blurb&&c.blurb.why?[{text:c.blurb.why}]:[])).slice(0,2)))}" data-tid="${esc(t.id)}" data-pick="${esc(c.pick||'')}" data-kind="${esc(c.kind||'')}" data-acted="${c.acted===false?0:1}" role="option" aria-label="${esc(c.name)}"><span class="ph"${u?` style="background-image:url('${esc(u)}')"`:''}>${u?'':esc(c.name[0])}</span>${pct!=null?`<em>${pct}%</em>`:''}<i class="dl-tap">탭해서 한 표</i></button>`}).join('')}
  <button class="dl-c dl-add" data-i="${cands.length}" data-rid="${r.id}" data-tid="${esc(t.id)}" data-add="1" data-name="내 후보 추가" role="option" aria-label="원하는 후보 직접 추가"><span class="ph">+</span><i class="dl-tap">탭해서 추가</i></button>
  <div class="dl-mid">
   ${r.orig?`<a class="dl-orig" href="#a/${encodeURIComponent(r.orig)}" aria-label="원작 ${esc(r.orig)} 배우 페이지"${ou?` style="background-image:url('${esc(ou)}')"`:''}>${ou?'':esc(r.orig[0])}</a>`:'<span class="dl-orig">?</span>'}
   ${r.orig?`<a class="dl-ol" href="#a/${encodeURIComponent(r.orig)}">원작 ${dispHTML(r.orig)}</a>`:'<small class="dl-ol">원작 배우 없음</small>'}
  </div>
 </div>
 <div class="dl-pick" aria-live="polite"><div class="dl-pn"><span class="dl-badge" id="dlPick" hidden></span><a id="dlName" class="dl-nm"></a><small id="dlMeta"></small></div><p class="dl-rc" id="dlRecent"></p><div class="dl-why" id="dlWhy"></div></div>`}
function bindDial(){const el=$('#dial');DIAL=null;if(!el)return;const n=+el.dataset.n,step=360/n;
 const D=DIAL={el,n,step,rot:-(+el.dataset.start)*step,vel:0,raf:0,focus:-1};
 const btns=[...el.querySelectorAll('.dl-c')];
 const lay=()=>{const W=el.clientWidth,R=W*0.385,cx=W/2,cy=W/2;
  btns.forEach((b,i)=>{const a=(D.rot+i*step-90)*Math.PI/180;let d=((D.rot+i*step)%360+540)%360-180;const k=Math.max(0,1-Math.abs(d)/step);
   b.style.transform=`translate(${cx+R*Math.cos(a)}px,${cy+R*Math.sin(a)}px) translate(-50%,-50%) scale(${0.8+0.55*k})`;b.style.zIndex=10+Math.round(k*10);b.style.opacity=(0.55+0.45*Math.max(k,1-Math.abs(d)/180)).toFixed(2)});
  const rg=el.querySelector('.dl-ring');rg.style.setProperty('--R',rg.clientWidth/2+'px');rg.style.transform=`rotate(${D.rot}deg)`;
  const f=((Math.round(-D.rot/step)%n)+n)%n;if(f!==D.focus){D.focus=f;btns.forEach((b,i)=>b.classList.toggle('on',i===f));const b=btns[f];
   const PK={classic:'정석',buzz:'화제',chem:'케미',wild:'와일드카드',user:'유저 추천',seed:'기본 후보'},KK={comedian:'개그맨',singer:'가수',idol:'아이돌',musical:'뮤지컬 배우',stage:'연극 배우',youtuber:'유튜버',influencer:'방송인'};
   const pb=$('#dlPick');if(pb){const k=b.dataset.pick;pb.className='dl-badge '+(k||'');pb.textContent=k?(PK[k]||'')+(k==='wild'&&KK[b.dataset.kind]?`, ${KK[b.dataset.kind]}`:''):'';pb.hidden=!k}
   if(b.dataset.add){$('#dlName').textContent='원하는 후보가 없나요?';$('#dlMeta').textContent='';$('#dlRecent').textContent='배우, 가수, 개그맨, 유튜버 누구든 올리고 바로 한 표를 줄 수 있어요.';$('#dlWhy').innerHTML=`<div class="dl-addf"><input id="dlNew" maxlength="20" placeholder="후보 이름" aria-label="새 후보 이름"><input id="dlPitch" maxlength="80" placeholder="추천 이유 한마디 (선택)" aria-label="추천 이유"><button class="b buy sm" data-act="dk-add" data-rid="${b.dataset.rid}">후보로 올리고 한 표</button></div>`;const pk0=el.parentNode.querySelector('.dl-pick');if(pk0){pk0.classList.remove('swap');void pk0.offsetWidth;pk0.classList.add('swap')}if(D.ticked)try{navigator.vibrate&&navigator.vibrate(6)}catch(e){}D.ticked=true;return}
   {const nm=$('#dlName');nm.textContent=dispName(b.dataset.name);nm.href='#a/'+encodeURIComponent(b.dataset.name)}$('#dlMeta').textContent=[b.dataset.age,b.dataset.pct!==''?`득표 ${b.dataset.pct}%`:''].filter(Boolean).join(', ');
   $('#dlRecent').innerHTML=workLinks(esc(b.dataset.recent||''));
   let rs=[];try{rs=JSON.parse(b.dataset.why||'[]')}catch(e){}
   $('#dlWhy').innerHTML=rs.map(x=>`<span class="dl-r">${workLinks(esc(x.text||''))}${x.src&&x.src.u?` <a class="dl-src" href="${esc(goURL(b.dataset.tid,'news','news',x.src.u))}" target="_blank" rel="noopener" title="${esc(x.src.t||'')}">출처</a>`:''}</span>`).join('');const pk=el.parentNode.querySelector('.dl-pick');if(pk){pk.classList.remove('swap');void pk.offsetWidth;pk.classList.add('swap')}
   if(D.ticked)try{navigator.vibrate&&navigator.vibrate(6)}catch(e){}D.ticked=true;el.classList.remove('tick');void el.offsetWidth;el.classList.add('tick')}};
 const snap=(target)=>{cancelAnimationFrame(D.raf);const go=()=>{const d=target-D.rot;if(Math.abs(d)<0.3){D.rot=target;lay();return}D.rot+=d*0.22;lay();D.raf=requestAnimationFrame(go)};go()};
 const nearest=()=>Math.round(D.rot/step)*step;
 D.snap=snap;D.lay=lay;
 const ang=e=>{const r=el.getBoundingClientRect();return Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2))*180/Math.PI};
 let a0=null,moved=0,tgt=null,last=0,lt=0,pid=null;
 el.addEventListener('pointerdown',e=>{cancelAnimationFrame(D.raf);a0=ang(e);moved=0;tgt=e.target.closest('.dl-c');last=a0;lt=performance.now();D.vel=0;pid=e.pointerId;el.setPointerCapture(pid);el.classList.add('drag')});
 el.addEventListener('pointermove',e=>{if(a0==null)return;const a=ang(e);let d=a-last;if(d>180)d-=360;if(d<-180)d+=360;const now=performance.now();D.vel=d/Math.max(1,now-lt);last=a;lt=now;moved+=Math.abs(d);D.rot+=d;lay()});
 const up=e=>{if(a0==null)return;a0=null;el.classList.remove('drag');
  if(moved<4){if(tgt){const i=+tgt.dataset.i;if(i===D.focus){dialConfirm();return}let tr=-i*step;tr+=Math.round((D.rot-tr)/360)*360;snap(tr);track('dial_focus',{m:{tap:true}})}return}
  // 관성: 손을 뗀 속도만큼 더 돌다가 가장 가까운 칸에 멈춤
  let v=D.vel*16;const spin=()=>{v*=0.93;D.rot+=v;lay();if(Math.abs(v)>0.4)D.raf=requestAnimationFrame(spin);else snap(nearest())};D.raf=requestAnimationFrame(spin);track('dial_spin',{m:{deg:Math.round(moved)}})};
 el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
 el.addEventListener('wheel',e=>{e.preventDefault();dialStep(e.deltaY>0||e.deltaX>0?1:-1)},{passive:false});
 lay();addEventListener('resize',lay,{once:true})}
function dialStep(k){const D=DIAL;if(!D)return;cancelAnimationFrame(D.raf);D.snap(Math.round(D.rot/D.step)*D.step-k*D.step)}
function dialConfirm(){const D=DIAL;if(!D||D.focus<0)return;const b=D.el.querySelectorAll('.dl-c')[D.focus];if(!b)return;if(b.dataset.add){const i=$('#dlNew');if(i)i.focus();track('cand_add_open',{t:b.dataset.tid,r:+b.dataset.rid});return}b.classList.add('pop');deckPick(+b.dataset.rid,+b.dataset.cid)}

/* ================= 결과와 토론방(작품 화면 하단) ================= */
let TALK={tid:null,combos:[],open:null,thread:[],myv:{}};
async function loadTalk(tid){TALK.tid=tid;const box=$('#talkBox');if(!box)return;
 try{TALK.combos=await rpc('topic_teams',{tid})||[]}catch(e){TALK.combos=[]}renderTalk()}
function comboLine(p){return (D?D.roles:[]).filter(r=>p[r.id]).map(r=>`<span class="cl"><small>${esc(SLOT[r.slot]||r.ch)}</small>${esc(p[r.id])}</span>`).join('')}
function renderTalk(){const box=$('#talkBox');if(!box||!D)return;const t=topic(),seen=D.seen;
 if(!seen){box.innerHTML=`<div class="talk0"><b>캐스팅 팀 순위는 투표한 사람에게 열려요</b><p class="sub">배역 하나라도 투표하면 득표율, 내 팀과 광장 민심 팀, 팀 공감 순위를 볼 수 있어요. 토론은 토론 탭에서 누구나 읽을 수 있어요.</p><a class="b buy" href="#">카드로 투표하기</a></div>`;return}
 const cs=TALK.combos,RS=(D.roles||[]).filter(r=>!isSync(r)&&!isOpt(r));
 const mySh=USER&&(D.sheets||[]).find(x=>x.user_id===USER.id);
 const myTeam=RS.map(r=>{const v=D.myVote[r.id],c=v&&(D.cands[r.id]||[]).find(x=>x.candidate_id===v.candidate_id),pk=mySh&&mySh.picks&&mySh.picks[r.id];
  /* 꾸민 팀을 저장했으면 그 배우와 시절이 내 팀의 최종 모습. 투표와 다르면 내 표를 함께 보여 줌 */
  const pc=pk&&pk.c&&(D.cands[r.id]||[]).find(x=>String(x.candidate_id)===String(pk.c)),pn=pk?(pk.n||(pc&&pc.name)||null):null,name=pn||(c?c.name:null);
  const era=name&&pk&&pk.y?{...pk,_nm:name}:null;return {r,name,era,vote:pn&&c&&c.name!==pn?c.name:null}});
 {renderTalk.tried=renderTalk.tried||new Set();const miss=myTeam.map(x=>x.name).filter(n=>n&&!(('p:'+n) in IMG)&&!renderTalk.tried.has(n));miss.forEach(n=>renderTalk.tried.add(n));if(miss.length&&typeof loadNames==='function')loadNames(miss).then(()=>renderTalk()).catch(()=>{})}eraPosters(myTeam.map(x=>x.era).filter(Boolean));
 const done=myTeam.filter(x=>x.name).length,lead=RS.map(r=>{const c=(D.cands[r.id]||[]).reduce((a,x)=>!a||x.votes>a.votes?x:a,null);return {r,name:c&&c.votes?c.name:null}});
 const same=myTeam.every((x,i)=>x.name&&x.name===lead[i].name);
 crowdTeams.my=myTeam.map(x=>x.name);
 const teamRow=(L,gap)=>`<div class="team">${L.map((x,i)=>`<a class="tm${x.name?'':' empty'}" ${x.name?`href="#a/${encodeURIComponent(x.name)}"`:gap?`href="javascript:void 0" data-act="team-gap" data-i="${D.roles.indexOf(x.r)}" data-rid="${x.r.id}"`:''}>${(()=>{const ep=x.era&&eraPosterOf(x.era);const u=ep||(x.name&&IMG['p:'+x.name]);return `<span class="av${ep?' era':''}"${u?` style="background-image:url('${esc(u)}')"`:''}>${x.name?'':'?'}</span>`})()}<small>${esc(SLOT[x.r.slot]||x.r.ch)}</small><b>${x.name?esc(x.name):gap?'고르기':'미정'}</b>${x.vote?`<em class="tvote">내 표: ${esc(x.vote)}</em>`:''}${x.era?`<em class="tera">${esc(x.era.w?'《'+x.era.w+'》':x.era.y+'년')} ${x.era.w?x.era.y:''}</em>`:''}</a>`).join('')}</div>`;
 box.innerHTML=`<div class="sh"><h2>캐스팅 팀</h2><span class="sub">배역별 표가 모여 만들어진 팀, 그리고 팀에 대한 공감</span></div>
 <div class="teams2">
  <article class="tcard mine"><div class="th2"><b>내 캐스팅 팀</b>${mySh?'<small class="tsrc">꾸민 팀 기준</small>':''}<span>${done===RS.length?'완성':`${RS.length-done}개 배역 남음`}</span></div>${teamRow(myTeam,true)}
   ${done===RS.length?(same?'<p class="tnote">광장 민심 팀과 똑같아요. 민심을 정확히 읽었네요.</p>':`<p class="tnote">광장 민심 팀과 ${myTeam.filter((x,i)=>x.name!==lead[i].name).length}자리가 달라요.</p>`):'<p class="tnote">남은 배역도 고르면 내 팀이 공감 순위에 올라가요.</p>'}</article>
  <article class="tcard lteam"><div class="th2"><b>광장 민심 팀 TOP 3</b><span>배역별 득표로 만든 조합</span></div>${crowdTeams(RS).map((T,k)=>`<div class="ct3${k?'':' first'}"><div class="ct3h"><em>${k+1}위</em><span>득표 점수 ${T.score}%</span>${T.same?'<b>내 팀과 같아요</b>':''}</div>${teamRow(T.list)}</div>`).join('')||teamRow(lead)}</article>
 </div>
 <div class="sh" style="margin-top:16px"><h3>팀 공감 순위</h3><span class="sub">같은 팀을 고른 사람 + 공감한 사람</span></div>
 ${cs.length?`<ol class="combos">${cs.map((c,i)=>`<li class="${c.mine?'mine':''}${TALK.open===c.ckey?' open':''}"><div class="cbtn2"><span class="rk">${i+1}</span><button class="cbtn" data-act="talk-open" data-k="${c.ckey}" aria-expanded="${TALK.open===c.ckey}"><span class="cls">${comboLine(c.picks)}</span><span class="cn">같은 팀 ${fmt(c.users)}명${c.mine?', 내 팀':''}, 토론 ${fmt(c.comments)}</span></button><button class="tlike${c.liked?' on':''}" data-act="team-like" data-k="${c.ckey}" aria-pressed="${!!c.liked}" aria-label="이 팀에 공감">${IC.heart}<b>${fmt((c.likes||0)+c.users)}</b></button></div>${TALK.open===c.ckey?`<div class="thread" id="thread">${threadHTML(c)}</div>`:''}</li>`).join('')}</ol>`:'<p class="empty3">모든 배역을 고른 사람이 아직 없어요. 남은 배역도 투표하면 내 팀이 순위에 올라가요.</p>'}`}
function threadHTML(c){if(!USER)return '<p class="sub">로그인하면 토론방을 볼 수 있어요.</p>';
 const all=TALK.thread,top=all.filter(x=>!x.parent_id).sort((a,b)=>b.rank_score-a.rank_score||(b.up-b.down)-(a.up-a.down)||new Date(b.created_at)-new Date(a.created_at));
 const kids=id=>all.filter(x=>x.parent_id===id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
 const item=(x,reply)=>{const mv=TALK.myv[x.id]||0;const body=x.hidden?`<details class="folded"><summary>비추천이 많아 접힌 글이에요. 펼치기</summary>${esc(x.body)}</details>`:`<p>${esc(x.body)}</p>`;
  return `<div class="tc${reply?' re':''}"><small><b>${esc(x.nickname)}</b> ${new Date(x.created_at).toLocaleDateString('ko-KR')}</small>${body}
  <div class="tv"><button class="${mv===1?'on':''}" data-act="tvote" data-id="${x.id}" data-v="1" aria-label="추천">▲ ${fmt(x.up)}</button><button class="${mv===-1?'on dn':''}" data-act="tvote" data-id="${x.id}" data-v="-1" aria-label="비추천">▼ ${fmt(x.down)}</button>${reply?'':`<button data-act="treply" data-id="${x.id}">답글</button>`}${x.mine?`<button data-act="tdel" data-id="${x.id}">삭제</button>`:''}</div>
  <div class="tr-form" id="tr${x.id}" hidden><input type="text" maxlength="500" placeholder="답글 쓰기"><button class="b sm" data-act="tpost" data-parent="${x.id}">등록</button></div></div>`};
 return `<div class="tform"><textarea id="tNew" maxlength="500" rows="2" placeholder="이 조합에 대한 생각. 근거를 들면 추천을 더 받아요"></textarea><button class="b sm buy" data-act="tpost">글 쓰기</button></div>
 <p class="dl">추천이 많은 글이 위로 올라가요. 비추천이 5개 이상이면서 추천의 두 배를 넘으면 접히고, 욕설은 등록되지 않아요.</p>
 ${top.map(x=>item(x)+kids(x.id).map(k=>item(k,true)).join('')).join('')||'<p class="empty3">첫 의견을 남겨 주세요</p>'}`}
async function openThread(k){TALK.open=TALK.open===k?null:k;if(TALK.open&&USER){track('thread_open',{t:TALK.tid,m:{k}});
  const [{data},{data:mv}]=await Promise.all([sb.from('v_thread').select('*').eq('topic_id',TALK.tid).eq('ckey',k).order('created_at').limit(300),sb.from('thread_votes').select('comment_id,v')]);
  TALK.thread=data||[];TALK.myv={};(mv||[]).forEach(x=>TALK.myv[x.comment_id]=x.v)}renderTalk()}

document.addEventListener('click',async e=>{const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
 if(a==='dk-pick'){e.preventDefault();deckPick(+b.dataset.rid,+b.dataset.cid);return}
 if(a==='dk-add'){const t=curTopic(),r=curRole(),rid=+b.dataset.rid,nm=($('#dlNew')||{value:''}).value.trim(),pitch=($('#dlPitch')||{value:''}).value.trim();if(!nm){toast('후보 이름을 적어 주세요');return}
  if(!USER||!PROF){track('login_prompt',{t:t&&t.id,r:rid,m:{add:true}});openLoginSheet();return}
  try{const cid=await rpc('add_candidate',{rid,nm,pitch:pitch||null});track('cand_add',{t:t&&t.id,r:rid,c:cid,m:{pitch:!!pitch}});toast(`${nm} 후보를 올리고 한 표 반영`);if(r&&r.id===rid&&!r.mine)r.mine=cid;
   const fresh=await rpc('vote_deck',{lim:16}).catch(()=>null);const ft=fresh&&t&&fresh.find(x=>x.id===t.id);if(ft)Object.assign(t,{seen:ft.seen,roles:ft.roles});const c=$('#dkCard');if(c){c.classList.add('fly-r');await new Promise(o=>setTimeout(o,220))}nextRole()}catch(err){toast(errMsg(err))}return}
 if(a==='dk-skip'){const t=curTopic(),r=curRole();track('skip',{t:t&&t.id,r:r&&r.id});const c=$('#dkCard');if(c){c.classList.add('fly-l');setTimeout(nextRole,200)}else nextRole();return}
 if(a==='dk-goto'){cardLeave();DI=+b.dataset.i;const t=curTopic();DR=t?firstOpenRole(t):0;track('topic_jump',{t:t&&t.id});renderDeck();scrollTo({top:0,behavior:'smooth'});return}
 if(a==='dk-nexttopic'){const t=curTopic();track('topic_skip',{t:t&&t.id});if(t&&!t.done)markPass(t.id);nextTopic();return}
 if(a==='dk-restart'){DI=0;DR=0;await loadDeck();const t=curTopic();if(t)DR=firstOpenRole(t);renderDeck();return}
 if(a==='sheet-close'){$('#loginSheet').classList.remove('on');return}
 if(a==='talk-open'){setTTab('talk','c'+b.dataset.k);$('#tTabs').scrollIntoView({behavior:'smooth',block:'start'});return}
 if(a==='team-like'){if(needLogin())return;const c=TALK.combos.find(x=>x.ckey===b.dataset.k);if(!c)return;if(c.mine){toast('내 팀에는 공감 대신 이미 한 표가 들어가 있어요');return}try{const on=await rpc('like_team',{tid:TALK.tid,ck:c.ckey});c.liked=on;c.likes=(c.likes||0)+(on?1:-1);track('team_like',{t:TALK.tid,m:{on}});renderTalk()}catch(e){toast(errMsg(e))}return}
 if(a==='tvote'){if(needLogin())return;try{const r=await rpc('vote_thread',{cid:+b.dataset.id,val:+b.dataset.v});const x=TALK.thread.find(y=>y.id===+b.dataset.id);if(x){x.up=r.up;x.down=r.down;x.hidden=r.hidden;const mv=TALK.myv[x.id]||0;TALK.myv[x.id]=mv===+b.dataset.v?0:+b.dataset.v}renderTalk()}catch(err){toast(errMsg(err))}return}
 if(a==='treply'){const f=$('#tr'+b.dataset.id);if(f){f.hidden=!f.hidden;if(!f.hidden)f.querySelector('input').focus()}return}
 if(a==='tpost'){if(needLogin())return;const parent=b.dataset.parent?+b.dataset.parent:null;const inp=parent?$('#tr'+parent).querySelector('input'):$('#tNew');const txt=inp.value.trim();if(!txt)return toast('내용을 적어 주세요');
  try{await rpc('post_thread',{tid:TALK.tid,ck:TALK.open,parent,txt});track('thread_post',{t:TALK.tid,m:{reply:!!parent}});inp.value='';const k=TALK.open;TALK.open=null;await openThread(k);const c=TALK.combos.find(x=>x.ckey===k);if(c)c.comments++;renderTalk()}catch(err){toast(errMsg(err))}return}
 if(a==='tdel'){try{await rpc('delete_thread',{cid:+b.dataset.id});toast('삭제했어요');await loadTopic();renderTFeed();loadTalk(SEL)}catch(err){toast(errMsg(err))}return}
});

/* ===== 7일 롤링 라운드: 매일 새 판이 열리고, 7일 뒤 마감과 결과 발표 ===== */
let RB={results:[],opened:[],closing:[]};
async function loadRounds(){try{RB=await rpc('round_board',{})||RB;if(DECKV)renderDeck();const ns=(RB.results||[]).flatMap(r=>(r.roles||[]).map(x=>x.win).filter(Boolean));if(ns.length){await loadNames(ns);if(DECKV)renderDeck()}}catch(e){}}
function roundLeft(t){const ms=new Date(t.closes_at)-Date.now(),h=Math.ceil(ms/36e5);return ms<=0?'마감':h<=24?`오늘 자정 마감`:`마감 D-${Math.ceil(ms/864e5)}`}
const isNewT=d=>d.opens_at&&Date.now()-new Date(d.opens_at)<864e5;
function stTag(d){const ms=new Date(d.closes_at)-Date.now();return isNewT(d)?`<em class="tg n">${d.season>1?`시즌 ${d.season}`:'NEW'}</em>`:ms>0&&ms<864e5?'<em class="tg c">오늘 마감</em>':''}
function roundBanner(){const rs=(RB.results||[]).filter(r=>Date.now()-new Date(r.at)<2*864e5);
 if(!rs.length){const c=RB.closing||[];return c.length?`<p class="rbn-line">⏰ 오늘 자정 마감: ${c.map(x=>`<a href="#${esc(x.tid)}">${esc(x.title)}</a>`).join(', ')}</p>`:''}
 return `<section class="rbn" aria-label="결과 발표"><div class="rbn-h"><b>📣 결과 발표</b><small>7일 투표가 끝난 판이에요</small></div><div class="rbn-row">${rs.map(r=>{const mine=(r.roles||[]).filter(x=>x.mine),hit=mine.filter(x=>x.mine===x.win).length;
  return `<button class="rbn-c" data-act="rres" data-t="${esc(r.tid)}" data-s="${r.season}"${r.poster?` style="--bg:url('${esc(r.poster)}')"`:''}><small>${r.season>1?`시즌 ${r.season}`:'결과'}</small><b>${esc(r.title)}</b><span>${mine.length?(hit?`🎯 ${hit}/${mine.length} 적중${r.pts?`, +${r.pts}P`:''}`:`내 픽 ${mine.length}개, 적중 없음`):'결과 보기'}</span></button>`}).join('')}</div></section>`}
function openResult(tid,season){const r=(RB.results||[]).find(x=>x.tid===tid&&String(x.season)===String(season));if(!r)return;
 const mine=r.roles.filter(x=>x.mine),hit=mine.filter(x=>x.mine===x.win).length;
 const ov=document.createElement('div');ov.className='rres-ov';ov.innerHTML=`<div class="rres" role="dialog" aria-label="${esc(r.title)} 결과"><button class="x" data-act="rres-x" aria-label="닫기">×</button>
  <header${r.poster?` style="--bg:url('${esc(r.poster)}')"`:''}><small>${r.season>1?`시즌 ${r.season} `:''}최종 결과, ${fmt(r.voters||0)}명 참여</small><h3>${esc(r.title)}</h3>
  ${mine.length?`<p class="sc"><b>${hit}</b><span>/ ${mine.length} 적중</span>${r.pts?`<em>+${r.pts}P</em>`:''}</p>`:''}</header>
  <ol>${r.roles.map(x=>{const pct=x.total?Math.round(x.v/x.total*100):0,ok=x.mine&&x.mine===x.win,u=x.win&&IMG['p:'+x.win];return `<li class="${ok?'ok':x.mine?'no':''}"><span class="av"${u?` style="background-image:url('${esc(u)}')"`:''}>${u?'':esc((x.win||'?')[0])}</span>
   <div><small>${esc(x.ch)}</small><b>${x.win?`<a href="#a/${encodeURIComponent(x.win)}">${dispHTML(x.win)}</a>`:'투표 없음'}</b><i style="--p:${pct}%"></i><span>${pct}%${x.mine?(ok?' 🎯 내 픽 적중':`, 내 픽 ${dispHTML(x.mine)}`):''}</span></div></li>`}).join('')}</ol>
  <p class="nx">언더독 보너스: 내가 골랐을 때 1위가 아니던 배우가 최종 1위면 +10P를 더 드려요. 이 작품은 이틀 뒤 새 시즌으로 다시 열려요.</p>
  <a class="b buy" href="#${esc(tid)}" data-act="rres-x">작품 페이지에서 자세히</a></div>`;
 document.body.appendChild(ov);ov.addEventListener('click',e=>{if(e.target===ov||e.target.closest('[data-act="rres-x"]'))ov.remove()})}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act="rres"]');if(!b)return;openResult(b.dataset.t,b.dataset.s);try{track('round_result',{t:b.dataset.t})}catch(err){}});

/* 작품을 다 고른 뒤: 같은 작품의 다른 판, 원작 배우나 내 픽이 후보인 배역으로 이어 주기 */
async function relNext(t){const el=$('#dkRel');if(!el)return;const x=await rpc('duel_next',{skip:[],prefer:t.id}).catch(()=>null);if(!x||!x.why||!$('#dkRel'))return;
 const why=x.why.replace(/(\S+)이\(가\)/,(m,n)=>jj(n,'이','가')),v=verLabel(x.cat);const di=DECK.findIndex(d=>d.id===x.tid);
 el.innerHTML=`<small>🔗 이어서 고르기</small><a class="rel" ${di>=0?`href="#" data-act="dk-goto" data-i="${di}"`:`href="#${esc(x.tid)}"`}><b>《${esc(x.title)}》${v?` ${esc(v)}`:''} ${esc(x.ch)} 역</b><span>${esc(why)}</span><i>→</i></a>`}
/* 덱을 끝까지 본 뒤: 막다른 화면 대신 다음 할 일 */
function deckEnd(box){const rs=(RB.results||[]).slice(0,3),cl=RB.closing||[];const open=(TOPICS||[]).filter(x=>isOpen(x)&&!DECK.some(d=>d.id===x.id)).slice(0,6);
 const tile=(href,ic,b,s,act)=>`<a class="de-t" href="${href}"${act||''}><span>${ic}</span><b>${b}</b><small>${s}</small></a>`;
 box.innerHTML=`<div class="dk">${storyRings()}<div class="dk-end"><div class="de-h"><span>🎬</span><b>오늘 카드는 여기까지!</b><p>내일 0시에 새 판이 열려요. 그 전에 이건 어때요?</p></div>
  <div class="de-grid">${tile('#vs','⚡','VS 한판','두 명 중 한 명만, 빠르게')}${USER?tile('#me','📅','주간 결산','이번 주 내 캐스팅 돌아보기',' data-act="upg" data-k="week"'):tile('#','🗳️','표 저장하기','로그인하면 결과 알림',' data-act="dk-login"')}${tile('#make','➕','작품 제안','보고 싶은 판을 직접 열기')}${tile('#','🔁','처음부터 다시','넘긴 카드 다시 보기',' data-act="dk-restart"')}</div>
  ${cl.length?`<h3>⏰ 오늘 자정 마감</h3><div class="de-list">${cl.map(x=>`<a href="#${esc(x.tid)}">${esc(x.title)}<i>→</i></a>`).join('')}</div>`:''}
  ${open.length?`<h3>덱에 없던 작품</h3><div class="de-list">${open.map(x=>`<a href="#${esc(x.id)}">${esc(x.title)}${verLabel(x.cat)?` <small>${esc(verLabel(x.cat))}</small>`:''}<i>→</i></a>`).join('')}</div>`:''}</div></div>`;
 stripFocus()}
document.addEventListener('click',e=>{if(e.target.closest('[data-act="dk-login"]')){e.preventDefault();openLoginSheet(true)}});

/* 넘긴 작품은 3일 동안 덱 뒤로 보내고, 그 자리는 아직 안 본 작품으로 채움 */
function passMap(){try{return JSON.parse(localStorage.getItem('dk_pass')||'{}')}catch(e){return {}}}
function markPass(tid){const m=passMap(),now=Date.now();m[tid]=now;for(const k in m)if(now-m[k]>3*864e5)delete m[k];try{localStorage.setItem('dk_pass',JSON.stringify(m))}catch(e){}}
function passSort(deck){const m=passMap(),now=Date.now(),ok=t=>!(m[t.id]&&now-m[t.id]<3*864e5);return [...deck.filter(ok),...deck.filter(t=>!ok(t))]}

/* ===== 광장 v2: 위 스토리 줄, 가운데 카드 한 장, 작품 목록은 시트 ===== */
/* 오늘의 소식 육각 띠: 테두리 색 = 남은 시간, 위 두 변 = 화제/새 소식/박빙, 아래 두 변 = 내 참여 */
const HXP={t:[29,0],r1:[58,16.75],r2:[58,50.25],b:[29,67],l2:[0,50.25],l1:[0,16.75]};
function hxSeg(a,b,c){return `<line x1="${HXP[a][0]}" y1="${HXP[a][1]}" x2="${HXP[b][0]}" y2="${HXP[b][1]}" class="${c}"/>`}
function hexInfo(d){const ms=new Date(d.closes_at)-Date.now(),day=864e5,bz=DECK.map(x=>+x.buzz||0).sort((a,b)=>b-a),cut=bz[Math.max(0,Math.ceil(bz.length*.2)-1)]||1e9;
 const st=ms>0&&ms<day?'cls':(d.opens_at&&Date.now()-new Date(d.opens_at)<2*day)?'new':'live';
 const news=(d.news||[]).some(n=>Date.now()-new Date(n.d)<day);const hot=(+d.buzz||0)>=cut&&(+d.buzz||0)>0;
 const rs=d.roles||[],mine=rs.filter(r=>r.mine).length;
 const tight=rs.some(r=>{if(!r.mine)return false;const v=(r.cands||[]).map(c=>+c.votes||0).sort((a,b)=>b-a),t=v.reduce((a,b)=>a+b,0);return t>=5&&v.length>1&&(v[0]-v[1])/t<=.05});
 const pips=[hot&&'hot',news&&'news',tight&&'tight'].filter(Boolean).slice(0,2);
 return {st,pips,part:!USER||!rs.length?null:mine===0?0:mine<rs.length?1:2,left:ms}}
function hexSvg(pips,part){const top=[['l1','t'],['t','r1']],bot=[['r2','b'],['b','l2']];let o='';
 pips.forEach((p,k)=>o+=hxSeg(top[k][0],top[k][1],'pp '+p));
 if(part!=null){o+=hxSeg('r2','b','pt'+(part>=1?' on':''))+hxSeg('b','l2','pt'+(part>=2?' on':''))}
 return o?`<svg class="hxo" viewBox="-3 -3 64 73" aria-hidden="true">${o}</svg>`:''}
function storyRings(){const rs=(RB.results||[]).filter(r=>Date.now()-new Date(r.at)<2*864e5),out=[];
 const ring=(cls,bg,lab,attrs,txt,svg)=>`<button class="sr ${cls}" ${attrs} style="--fd:${(out.length%5)*0.7}s"><span class="rg"><span class="in"${bg?` style="background-image:url('${esc(bg)}')"`:''}>${txt||''}<em>${esc(lab)}</em></span></span>${svg||''}</button>`;
 for(const r of rs)out.push(ring('res',r.poster,r.title,`data-act="rres" data-t="${esc(r.tid)}" data-s="${r.season}" aria-label="${esc(r.title)} 결과 발표"`,'<b>발표</b>'));
 const pr={cls:0,new:1,live:2},items=DECK.map((d,i)=>({d,i,h:hexInfo(d)}));
 items.sort((a,b)=>pr[a.h.st]-pr[b.h.st]||(b.h.pips.length-a.h.pips.length)||(a.h.left-b.h.left));
 for(const {d,i,h} of items){const dd=Math.ceil(h.left/864e5),lab=h.st==='cls'?'D-0':h.st==='new'?(d.season>1?'S'+d.season:'NEW'):'D-'+Math.max(1,dd);
  const say=[h.st==='cls'?'오늘 마감':h.st==='new'?'새 판':'진행 중',h.pips.includes('hot')&&'화제',h.pips.includes('news')&&'새 소식',h.pips.includes('tight')&&'박빙',h.part===2?'투표 완료':h.part===1?'일부 투표':h.part===0?'아직 안 함':''].filter(Boolean).join(', ');
  out.push(ring(h.st,d.vposter||d.poster,d.title,`data-act="dk-goto" data-i="${i}" aria-label="${esc(d.title)}, ${say}"`,`<b>${lab}</b>`,hexSvg(h.pips,h.part)))}
 if(USER)out.push(ring('wk',null,'주간 결산','data-act="week-story"','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>'));
 out.push(ring('key',null,'색의 뜻','data-act="hex-key" aria-label="타일 색 설명 보기"','<b class="q">?</b>'));
 return `<nav class="srow hexrow" aria-label="오늘의 작품 지도">${out.join('')}</nav>`}
function openHexKey(){const old=$('#hexKey');if(old)old.remove();const el=document.createElement('div');el.id='hexKey';el.className='wsheet';
 const sw=(c,t,s)=>`<li><i class="hk ${c}"></i><span><b>${t}</b><small>${s}</small></span></li>`;
 el.innerHTML=`<div class="ws-in hk-in" role="dialog" aria-label="타일 색의 뜻"><div class="ws-h"><b>타일 색의 뜻</b><button class="x" data-act="hk-x" aria-label="닫기">✕</button></div>
 <h4>테두리: 남은 시간</h4><ul>${sw('cls','오늘 마감','24시간 안에 투표가 닫혀요')}${sw('res','결과 발표','최근 이틀 사이 결과가 나왔어요')}${sw('new','새 판','열린 지 이틀 안 된 판이나 새 시즌')}${sw('live','진행 중','마감까지 여유 있는 판')}</ul>
 <h4>위쪽 빛 조각: 지금 뜨는 이야기</h4><ul>${sw('p-hot','화제','뉴스와 검색 화제 점수 상위 20%')}${sw('p-news','새 소식','하루 안에 관련 기사가 나왔어요')}${sw('p-tight','박빙','1, 2위 차이 5% 이내. 내가 투표한 배역에서만 보여요')}</ul>
 ${USER?`<h4>아래쪽 선: 내 참여</h4><ul>${sw('pt0','비어 있음','아직 투표 안 한 작품')}${sw('pt1','반만 채움','일부 배역만 투표했어요')}${sw('pt2','다 채움','모든 배역 투표 완료')}</ul>`:''}</div>`;
 document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('on'));el.addEventListener('click',e=>{if(e.target===el||e.target.closest('[data-act="hk-x"]')){el.classList.remove('on');setTimeout(()=>el.remove(),250)}});try{track('hex_key',{})}catch(x){}}
document.addEventListener('click',e=>{if(e.target.closest('[data-act="hex-key"]'))openHexKey()});
function openWorks(){const old=$('#worksSheet');if(old)old.remove();const el=document.createElement('div');el.id='worksSheet';el.className='wsheet';
 el.innerHTML=`<div class="ws-in" role="dialog" aria-label="오늘의 작품"><div class="ws-h"><b>오늘의 작품 ${DECK.length}</b><button class="x" data-act="ws-x" aria-label="닫기">×</button></div><div class="ws-g">${DECK.map((d,i)=>{const n=d.roles.length,m=d.roles.filter(r=>r.mine).length;return `<button class="wc${i===DI?' on':''}" data-act="dk-goto" data-i="${i}"><span class="ps"${d.vposter||d.poster?` style="background-image:url('${esc(d.vposter||d.poster)}')"`:''}>${stTag(d)}${m?`<i>${m===n?'✓':m+'/'+n}</i>`:''}</span><b>${esc(d.title)}</b><small>${esc(verLabel(d.cat)||'')}${verLabel(d.cat)?', ':''}${roundLeft(d)}</small></button>`}).join('')}<a class="wc add" href="#make"><span class="ps">+</span><b>작품 추가</b><small>보고 싶은 판 열기</small></a></div></div>`;
 document.body.appendChild(el);el.addEventListener('click',e=>{if(e.target===el||e.target.closest('[data-act="ws-x"],[data-act="dk-goto"],a'))el.remove()})}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act="works"]');if(b){openWorks();return}const g=e.target.closest('[data-go="me"]');if(g)setTimeout(()=>{location.hash='me'},0)});
function castStamp(){const c=$('#dkCard');if(!c)return;const s=document.createElement('span');s.className='cast-stamp';s.textContent='CAST!';c.appendChild(s);setTimeout(()=>s.remove(),1400)}
document.addEventListener('click',e=>{const p=e.target.closest('.dk2 .dl-pick');if(p&&!e.target.closest('a'))p.classList.toggle('open')});

/* 꾸민 팀의 "작품 속 모습": 그 작품 포스터를 팀 카드 사진으로 */
var ERAP={};
function eraKey(p){return p.wi?'wi:'+p.wi:p.w?'w:'+p.w:''}
function eraPosterOf(p){const k=eraKey(p);return k&&(ERAT[k+'|'+(p._nm||'')]||ERAP[k])||''}
var ERAT={};
async function eraPosters(list){const need=list.filter(p=>{const k=eraKey(p);return k&&!(k in ERAP)});if(!need.length)return;need.forEach(p=>ERAP[eraKey(p)]='');
 try{const wis=need.filter(p=>p.wi).map(p=>+p.wi),titles=need.filter(p=>!p.wi&&p.w).map(p=>p.w.slice(0,40));const works=[],byTk={};
  if(wis.length){const {data}=await sb.from('work').select('id,tmdb_id,media').in('id',wis);for(const w of data||[])if(w.tmdb_id){const tk=(w.media==='movie'?'movie':'tv')+':'+w.tmdb_id;works.push(tk);byTk[tk]='wi:'+w.id}}
  const r=await fetch(SB_URL+'/functions/v1/tmdb',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ANON,apikey:ANON},body:JSON.stringify({works:works.slice(0,40),titles:titles.slice(0,30)})});
  if(r.ok){const d=await r.json();for(const tk in d.k||{})if(byTk[tk])ERAP[byTk[tk]]=d.k[tk];for(const t in d.w||{})ERAP['w:'+t]=d.w[t]}
  /* 그 배우가 태그된 그 작품 사진(TMDB tagged images)이 있으면 포스터 대신 사용 */
  const tkOf=p=>{if(p.wi){for(const tk in byTk)if(byTk[tk]==='wi:'+p.wi)return tk}for(const n in ERA){const w=(ERA[n]||[]).find(x=>x.t&&p.w&&x.t.slice(0,60)===p.w&&String(x.y)===String(p.y));if(w&&w.tk)return w.tk}return ''};
  try{await Promise.all([...new Set(need.map(p=>p._nm).filter(Boolean))].map(n=>eraWorks(n)))}catch(e){}
  await Promise.all(need.map(async p=>{const tk=tkOf(p);if(!tk||!p._nm)return;const u=await taggedShot(p._nm,tk);if(u)ERAT[eraKey(p)+'|'+p._nm]=u}));
  if(typeof renderTalk==='function')renderTalk()}catch(e){}}

var TAGS={};
async function taggedShot(nm,tk){const k=nm+'|'+tk;if(k in TAGS)return TAGS[k];TAGS[k]='';try{if(typeof loadOrig==='function')await loadOrig([nm]);const alt=(typeof ORIG!=='undefined'&&ORIG[nm])||'';
 const r=await fetch(SB_URL+'/functions/v1/tmdb',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ANON,apikey:ANON},body:JSON.stringify({tagged:nm,alt,tk})});if(r.ok){const d=await r.json();TAGS[k]=d.u||''}}catch(e){}return TAGS[k]}

/* 광장 민심 팀 TOP 3: 배역별 득표율 합이 큰 조합 3개 (배역마다 상위 3명 안에서 탐색, 한 배우가 두 배역을 맡지 않게) */
function crowdTeams(RS){const per=RS.map(r=>{const cs=(D.cands[r.id]||[]).filter(c=>c.votes>0),tot=cs.reduce((a,c)=>a+c.votes,0)||1;return cs.sort((a,b)=>b.votes-a.votes).slice(0,3).map(c=>({r,name:c.name,p:c.votes/tot}))});
 if(per.some(x=>!x.length))return [];let beams=[{list:[],sc:0}];
 for(const opts of per){const nb=[];for(const b of beams)for(const o of opts){if(b.list.some(x=>x.name===o.name))continue;nb.push({list:[...b.list,{r:o.r,name:o.name}],sc:b.sc+o.p})}beams=nb.sort((a,b)=>b.sc-a.sc).slice(0,12)}
 const my=crowdTeams.my||[];return beams.slice(0,3).map(b=>({list:b.list,score:Math.round(b.sc/RS.length*100),same:b.list.every((x,i)=>x.name===my[i])}))}
