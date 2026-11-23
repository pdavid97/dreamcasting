
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

async function loadDeck(){if(deckBusy)return;deckBusy=true;try{DECK=await rpc('vote_deck',{lim:16})||[];
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
 if(!t){box.innerHTML=`<div class="dk-empty"><b>오늘 준비한 카드를 다 봤어요</b><p>새 카드는 매일 화제성과 내 취향으로 다시 골라요.</p><button class="b buy" data-act="dk-restart">처음부터 다시</button> <a class="b" href="#explore">작품 둘러보기</a></div>`;return}
 if(DR>=t.roles.length){renderDone(t);return}
 const r=t.roles[DR],p=pend().find(x=>x.rid===r.id),picked=r.mine||(p&&p.cid);
 const cands=r.cands.slice(0,10),more=r.cands.length-cands.length;
 const tot=r.cands.reduce((a,c)=>a+(c.votes||0),0);
 const news=(t.news||[])[0];
 box.innerHTML=`<div class="dk">
 <div class="dk-top"><span class="dk-count">작품 ${DI+1} / ${DECK.length}</span><span class="dk-why ${t.why}">${WHY[t.why]||''}${t.nnews?`, 7일 기사 ${t.nnews}건`:''}${t.trending?', 이번 주 인기작':''}</span></div>
 <article class="dk-card" id="dkCard" style="${t.poster?`--bg:url('${esc(t.poster)}')`:''}">
  <header class="dk-head"><div><small>${esc(CATS.find(c=>c.id===t.cat)?.name||'')}, 마감 D-${Math.max(0,Math.ceil((new Date(t.closes_at)-new Date())/864e5))}</small><h2>${esc(t.title)}</h2></div>
   <div class="dk-steps" aria-label="배역 진행">${t.roles.map((x,i)=>`<i class="${i<DR?'ok':i===DR?'on':''}" title="${esc(SLOT[x.slot]||'')} ${esc(x.ch)}"></i>`).join('')}</div></header>
  <div class="dk-q"><span class="slot">${esc(SLOT[r.slot]||'배역')}</span><h3>${esc(r.ch)} 역은 누구?</h3>${r.descr?`<p>${esc(r.descr)}</p>`:''}<p class="hint">${r.orig?`원작 ${esc(r.orig)}, `:''}${r.age?`배역 나이 ${esc(r.age)}, `:''}돌려서 고르고, 맨 위 사진을 한 번 더 탭하면 확정</p></div>
  ${dialHTML(t,r,cands,picked,tot)}
  ${more>0?`<a class="dk-more" href="#${esc(t.id)}">후보 ${more}명 더 보기</a>`:''}
  ${news?`<a class="dk-news" href="${esc(goURL(t.id,'news','news',news.u))}" target="_blank" rel="noopener">${esc(news.t)}${news.s?` <small>${esc(news.s)}</small>`:''}</a>`:''}
 </article>
 <div class="dk-acts"><button class="dk-btn skip" data-act="dk-skip" aria-label="이 배역 건너뛰기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button><a class="dk-btn mid" href="#${esc(t.id)}" aria-label="작품 자세히">자세히</a><button class="dk-btn next" data-act="dk-nexttopic" aria-label="다음 작품">다음 작품</button></div>
 <p class="dk-tip">사진을 돌려 고르고 맨 위 사진을 탭하면 다음 배역으로 넘어가요. 카드 위쪽을 옆으로 밀면 건너뛰어요. 투표 결과는 이 작품에 투표한 사람에게만 보여요.</p>
 </div>`;
 cardAt=performance.now();cardKey=t.id+'|'+r.id;bindSwipe();bindDial()}

function renderDone(t){const box=$('#deck');track('result_view',{t:t.id});
 box.innerHTML=`<div class="dk"><div class="dk-top"><span class="dk-count">작품 ${DI+1} / ${DECK.length}</span></div>
 <article class="dk-card done" style="${t.poster?`--bg:url('${esc(t.poster)}')`:''}"><header class="dk-head"><div><small>내 캐스팅 완성</small><h2>${esc(t.title)}</h2></div></header>
 <div class="dk-res" id="dkRes">${t.roles.map(r=>{const mine=r.cands.find(c=>c.id===r.mine),tot=r.cands.reduce((a,c)=>a+(c.votes||0),0),top=[...r.cands].sort((a,b)=>(b.votes||0)-(a.votes||0))[0];
  return `<div class="rr"><span class="slot">${esc(SLOT[r.slot]||'')}</span><b>${esc(r.ch)}</b><span>${mine?`내 픽 <strong>${esc(mine.name)}</strong>${tot?` ${Math.round((mine.votes||0)/tot*100)}%`:''}`:'건너뜀, 투표하면 결과 공개'}</span>${mine&&top&&tot?`<small>1위 ${esc(top.name)} ${Math.round((top.votes||0)/tot*100)}%</small>`:''}</div>`}).join('')}</div>
 <div id="dkCombo" class="dk-combo">${t.seen?'내 조합 순위를 불러오는 중이에요':'한 배역 이상 투표하면 결과와 토론방이 열려요'}</div></article>
 <div class="dk-acts"><a class="dk-btn mid" href="#${esc(t.id)}/talk">결과와 토론방</a><button class="dk-btn next" data-act="dk-nexttopic">다음 작품</button></div></div>`;
 if(t.seen)rpc('topic_combos',{tid:t.id}).then(cs=>{const el=$('#dkCombo');if(!el)return;const i=(cs||[]).findIndex(c=>c.mine);el.innerHTML=i>=0?`내 조합은 <b>${(cs||[]).length}개 조합 중 ${i+1}위</b>, 같은 조합 ${cs[i].users}명. 토론 ${cs[i].comments}개`:`모든 배역을 고르면 조합 순위에 올라가요. 지금 조합 ${(cs||[]).length}개`}).catch(()=>{})}

function nextRole(){const t=curTopic();if(!t)return;cardLeave();DR++;if(DR>=t.roles.length){}renderDeck()}
function nextTopic(){cardLeave();DI++;const t=curTopic();DR=t?firstOpenRole(t):0;renderDeck()}

async function deckPick(rid,cid){const t=curTopic(),r=curRole();if(!t||!r||r.id!==rid)return;track('cand_tap',{t:t.id,r:rid,c:cid});
 if(r.mine){toast('이 배역은 이미 투표했어요');nextRole();return}
 if(!USER||!PROF){const a=pend().filter(p=>p.rid!==rid);a.push({tid:t.id,rid,cid,at:Date.now()});setPend(a);track('login_prompt',{t:t.id,r:rid,c:cid});openLoginSheet();renderDeck();return}
 try{await rpc('cast_vote_src',{rid,cid,src:'wheel'});r.mine=cid;t.seen=true;track('vote_done',{t:t.id,r:rid,c:cid});showUndo(rid,`${r.ch} 역 한 표 반영`);
  const card=$('#dkCard');if(card){card.classList.add('fly-r');await new Promise(o=>setTimeout(o,220))}
  // 결과 공개를 위해 덱을 새로 받아 득표를 채움
  const fresh=await rpc('vote_deck',{lim:16}).catch(()=>null);const ft=fresh&&fresh.find(x=>x.id===t.id);if(ft){Object.assign(t,{seen:ft.seen,roles:ft.roles})}
  nextRole()}catch(e){toast(errMsg(e))}}

async function flushPending(){if(!USER||!PROF)return;const a=pend();if(!a.length)return;setPend([]);let ok=0;
 for(const p of a){try{await rpc('cast_vote_src',{rid:p.rid,cid:p.cid,src:'wheel'});ok++;track('vote_done',{t:p.tid,r:p.rid,c:p.cid,m:{after_login:true}})}catch(e){}}
 if(ok){toast(`로그인 전에 고른 ${ok}표를 반영했어요`);track('login_done',{m:{flushed:ok}})}await loadDeck();const t=curTopic();if(t)DR=Math.min(DR+0,t.roles.length)}

function openLoginSheet(){const m=$('#loginSheet');if(!m)return;m.classList.add('on');setTimeout(()=>{const b=m.querySelector('[data-act=login]');if(b)b.focus()},50)}

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
   <span class="dl-orig"${ou?` style="background-image:url('${esc(ou)}')"`:''}>${ou?'':(r.orig?esc(r.orig[0]):'?')}</span>
   <small class="dl-ol">${r.orig?`원작 ${esc(r.orig)}`:'원작 배우 없음'}</small>
  </div>
 </div>
 <div class="dl-pick" aria-live="polite"><div class="dl-pn"><span class="dl-badge" id="dlPick" hidden></span><b id="dlName"></b><small id="dlMeta"></small></div><p class="dl-rc" id="dlRecent"></p><div class="dl-why" id="dlWhy"></div></div>`}
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
   $('#dlName').textContent=b.dataset.name;$('#dlMeta').textContent=[b.dataset.age,b.dataset.pct!==''?`득표 ${b.dataset.pct}%`:''].filter(Boolean).join(', ');
   $('#dlRecent').textContent=b.dataset.recent||'';
   let rs=[];try{rs=JSON.parse(b.dataset.why||'[]')}catch(e){}
   $('#dlWhy').innerHTML=rs.map(x=>`<span class="dl-r">${esc(x.text||'')}${x.src&&x.src.u?` <a class="dl-src" href="${esc(goURL(b.dataset.tid,'news','news',x.src.u))}" target="_blank" rel="noopener" title="${esc(x.src.t||'')}">출처</a>`:''}</span>`).join('');const pk=el.parentNode.querySelector('.dl-pick');if(pk){pk.classList.remove('swap');void pk.offsetWidth;pk.classList.add('swap')}
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
 if(!seen){box.innerHTML=`<div class="talk0"><b>결과와 토론방은 투표한 사람에게 열려요</b><p class="sub">배역 하나라도 투표하면 득표율, 캐스팅 조합 순위, 조합별 토론방을 볼 수 있어요.</p><a class="b buy" href="#">카드로 투표하기</a></div>`;return}
 const cs=TALK.combos,RS=(D.roles||[]).filter(r=>!isSync(r)&&!isOpt(r));
 const myTeam=RS.map(r=>{const v=D.myVote[r.id],c=v&&(D.cands[r.id]||[]).find(x=>x.candidate_id===v.candidate_id);return {r,name:c?c.name:null}});
 const done=myTeam.filter(x=>x.name).length,lead=RS.map(r=>{const c=(D.cands[r.id]||[]).reduce((a,x)=>!a||x.votes>a.votes?x:a,null);return {r,name:c&&c.votes?c.name:null}});
 const same=myTeam.every((x,i)=>x.name&&x.name===lead[i].name);
 const teamRow=(L,gap)=>`<div class="team">${L.map((x,i)=>`<a class="tm${x.name?'':' empty'}" ${x.name?`href="#a/${encodeURIComponent(x.name)}"`:gap?`href="javascript:void 0" data-act="team-gap" data-i="${D.roles.indexOf(x.r)}" data-rid="${x.r.id}"`:''}><span class="av"${x.name&&IMG['p:'+x.name]?` style="background-image:url('${esc(IMG['p:'+x.name])}')"`:''}>${x.name?'':'?'}</span><small>${esc(SLOT[x.r.slot]||x.r.ch)}</small><b>${x.name?esc(x.name):gap?'고르기':'미정'}</b></a>`).join('')}</div>`;
 box.innerHTML=`<div class="sh"><h2>캐스팅 팀</h2><span class="sub">배역별 표가 모여 만들어진 팀, 그리고 팀에 대한 공감</span></div>
 <div class="teams2">
  <article class="tcard mine"><div class="th2"><b>내 캐스팅 팀</b><span>${done===RS.length?'완성':`${RS.length-done}개 배역 남음`}</span></div>${teamRow(myTeam,true)}
   ${done===RS.length?(same?'<p class="tnote">광장 민심 팀과 똑같아요. 민심을 정확히 읽었네요.</p>':`<p class="tnote">광장 민심 팀과 ${myTeam.filter((x,i)=>x.name!==lead[i].name).length}자리가 달라요.</p>`):'<p class="tnote">남은 배역도 고르면 내 팀이 공감 순위에 올라가요.</p>'}</article>
  <article class="tcard lteam"><div class="th2"><b>광장 민심 팀</b><span>배역별 1위</span></div>${teamRow(lead)}</article>
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
 if(a==='dk-nexttopic'){const t=curTopic();track('topic_skip',{t:t&&t.id});nextTopic();return}
 if(a==='dk-restart'){DI=0;DR=0;await loadDeck();const t=curTopic();if(t)DR=firstOpenRole(t);renderDeck();return}
 if(a==='sheet-close'){$('#loginSheet').classList.remove('on');return}
 if(a==='talk-open'){openThread(b.dataset.k);return}
 if(a==='team-like'){if(needLogin())return;const c=TALK.combos.find(x=>x.ckey===b.dataset.k);if(!c)return;if(c.mine){toast('내 팀에는 공감 대신 이미 한 표가 들어가 있어요');return}try{const on=await rpc('like_team',{tid:TALK.tid,ck:c.ckey});c.liked=on;c.likes=(c.likes||0)+(on?1:-1);track('team_like',{t:TALK.tid,m:{on}});renderTalk()}catch(e){toast(errMsg(e))}return}
 if(a==='tvote'){if(needLogin())return;try{const r=await rpc('vote_thread',{cid:+b.dataset.id,val:+b.dataset.v});const x=TALK.thread.find(y=>y.id===+b.dataset.id);if(x){x.up=r.up;x.down=r.down;x.hidden=r.hidden;const mv=TALK.myv[x.id]||0;TALK.myv[x.id]=mv===+b.dataset.v?0:+b.dataset.v}renderTalk()}catch(err){toast(errMsg(err))}return}
 if(a==='treply'){const f=$('#tr'+b.dataset.id);if(f){f.hidden=!f.hidden;if(!f.hidden)f.querySelector('input').focus()}return}
 if(a==='tpost'){if(needLogin())return;const parent=b.dataset.parent?+b.dataset.parent:null;const inp=parent?$('#tr'+parent).querySelector('input'):$('#tNew');const txt=inp.value.trim();if(!txt)return toast('내용을 적어 주세요');
  try{await rpc('post_thread',{tid:TALK.tid,ck:TALK.open,parent,txt});track('thread_post',{t:TALK.tid,m:{reply:!!parent}});inp.value='';const k=TALK.open;TALK.open=null;await openThread(k);const c=TALK.combos.find(x=>x.ckey===k);if(c)c.comments++;renderTalk()}catch(err){toast(errMsg(err))}return}
 if(a==='tdel'){try{await rpc('delete_thread',{cid:+b.dataset.id});TALK.thread=TALK.thread.filter(x=>x.id!==+b.dataset.id);renderTalk()}catch(err){toast(errMsg(err))}return}
});
