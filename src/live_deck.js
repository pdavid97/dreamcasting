
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
 const names=DECK.flatMap(d=>d.roles.flatMap(r=>r.cands.map(c=>c.name)));if(DECKV)renderDeck();await loadNames(names)}catch(e){}deckBusy=false;if(DECKV)renderDeck()}
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
 const cands=r.cands.slice(0,6),more=r.cands.length-cands.length;
 const tot=r.cands.reduce((a,c)=>a+(c.votes||0),0);
 const news=(t.news||[])[0];
 box.innerHTML=`<div class="dk">
 <div class="dk-top"><span class="dk-count">${DI+1} / ${DECK.length}</span><span class="dk-why ${t.why}">${WHY[t.why]||''}${t.nnews?`, 7일 기사 ${t.nnews}건`:''}${t.trending?', 이번 주 인기작':''}</span></div>
 <article class="dk-card" id="dkCard" style="${t.poster?`--bg:url('${esc(t.poster)}')`:''}">
  <header class="dk-head"><div><small>${esc(CATS.find(c=>c.id===t.cat)?.name||'')}, 마감 D-${Math.max(0,Math.ceil((new Date(t.closes_at)-new Date())/864e5))}</small><h2>${esc(t.title)}</h2></div>
   <div class="dk-steps" aria-label="배역 진행">${t.roles.map((x,i)=>`<i class="${i<DR?'ok':i===DR?'on':''}" title="${esc(SLOT[x.slot]||'')} ${esc(x.ch)}"></i>`).join('')}</div></header>
  <div class="dk-q"><span class="slot">${esc(SLOT[r.slot]||'배역')}</span><h3>${esc(r.ch)} 역은 누구?</h3>${r.descr?`<p>${esc(r.descr)}</p>`:''}<p class="hint">${r.orig?`원작 ${esc(r.orig)}, `:''}${r.age?`배역 나이 ${esc(r.age)}, `:''}사진을 눌러 한 표</p></div>
  <div class="dk-grid n${cands.length}">${cands.map(c=>{const u=IMG['p:'+c.name],sel=picked===c.id,pct=t.seen&&tot?Math.round((c.votes||0)/tot*100):null;return `<button class="dk-c${sel?' sel':''}" data-act="dk-pick" data-rid="${r.id}" data-cid="${c.id}" aria-label="${esc(c.name)}에게 한 표"><span class="ph"${u?` style="background-image:url('${esc(u)}')"`:''}>${u?'':esc(c.name[0])}</span><b>${esc(c.name)}</b>${ageTxt(c.name)?`<small>${ageTxt(c.name)}</small>`:''}${pct!=null?`<em style="--p:${pct}%">${pct}%</em>`:''}</button>`}).join('')||'<p class="hint">아직 후보가 없어요</p>'}</div>
  ${more>0?`<a class="dk-more" href="#${esc(t.id)}">후보 ${more}명 더 보기</a>`:''}
  ${news?`<a class="dk-news" href="${esc(news.u)}" target="_blank" rel="noopener">${esc(news.t)}${news.s?` <small>${esc(news.s)}</small>`:''}</a>`:''}
 </article>
 <div class="dk-acts"><button class="dk-btn skip" data-act="dk-skip" aria-label="이 배역 건너뛰기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button><a class="dk-btn mid" href="#${esc(t.id)}" aria-label="작품 자세히">자세히</a><button class="dk-btn next" data-act="dk-nexttopic" aria-label="다음 작품">다음 작품</button></div>
 <p class="dk-tip">옆으로 밀면 건너뛰어요. 투표 결과는 이 작품에 투표한 사람에게만 보여요.</p>
 </div>`;
 cardAt=performance.now();cardKey=t.id+'|'+r.id;bindSwipe()}

function renderDone(t){const box=$('#deck');track('result_view',{t:t.id});
 box.innerHTML=`<div class="dk"><div class="dk-top"><span class="dk-count">${DI+1} / ${DECK.length}</span></div>
 <article class="dk-card done" style="${t.poster?`--bg:url('${esc(t.poster)}')`:''}"><header class="dk-head"><div><small>내 캐스팅 완성</small><h2>${esc(t.title)}</h2></div></header>
 <div class="dk-res" id="dkRes">${t.roles.map(r=>{const mine=r.cands.find(c=>c.id===r.mine),tot=r.cands.reduce((a,c)=>a+(c.votes||0),0),top=[...r.cands].sort((a,b)=>(b.votes||0)-(a.votes||0))[0];
  return `<div class="rr"><span class="slot">${esc(SLOT[r.slot]||'')}</span><b>${esc(r.ch)}</b><span>${mine?`내 픽 <strong>${esc(mine.name)}</strong>${t.seen&&tot?` ${Math.round((mine.votes||0)/tot*100)}%`:''}`:'건너뜀'}</span>${t.seen&&top&&tot?`<small>1위 ${esc(top.name)} ${Math.round((top.votes||0)/tot*100)}%</small>`:''}</div>`}).join('')}</div>
 <div id="dkCombo" class="dk-combo">${t.seen?'내 조합 순위를 불러오는 중이에요':'한 배역 이상 투표하면 결과와 토론방이 열려요'}</div></article>
 <div class="dk-acts"><a class="dk-btn mid" href="#${esc(t.id)}/talk">결과와 토론방</a><button class="dk-btn next" data-act="dk-nexttopic">다음 작품</button></div></div>`;
 if(t.seen)rpc('topic_combos',{tid:t.id}).then(cs=>{const el=$('#dkCombo');if(!el)return;const i=(cs||[]).findIndex(c=>c.mine);el.innerHTML=i>=0?`내 조합은 <b>${(cs||[]).length}개 조합 중 ${i+1}위</b>, 같은 조합 ${cs[i].users}명. 토론 ${cs[i].comments}개`:`모든 배역을 고르면 조합 순위에 올라가요. 지금 조합 ${(cs||[]).length}개`}).catch(()=>{})}

function nextRole(){const t=curTopic();if(!t)return;cardLeave();DR++;if(DR>=t.roles.length){}renderDeck()}
function nextTopic(){cardLeave();DI++;const t=curTopic();DR=t?firstOpenRole(t):0;renderDeck()}

async function deckPick(rid,cid){const t=curTopic(),r=curRole();if(!t||!r||r.id!==rid)return;track('cand_tap',{t:t.id,r:rid,c:cid});
 if(r.mine){toast('이 배역은 이미 투표했어요');nextRole();return}
 if(!USER||!PROF){const a=pend().filter(p=>p.rid!==rid);a.push({tid:t.id,rid,cid,at:Date.now()});setPend(a);track('login_prompt',{t:t.id,r:rid,c:cid});openLoginSheet();renderDeck();return}
 try{await rpc('cast_vote',{rid,cid});r.mine=cid;t.seen=true;track('vote_done',{t:t.id,r:rid,c:cid});toast('한 표 반영');
  const card=$('#dkCard');if(card){card.classList.add('fly-r');await new Promise(o=>setTimeout(o,220))}
  // 결과 공개를 위해 덱을 새로 받아 득표를 채움
  const fresh=await rpc('vote_deck',{lim:16}).catch(()=>null);const ft=fresh&&fresh.find(x=>x.id===t.id);if(ft){Object.assign(t,{seen:ft.seen,roles:ft.roles})}
  nextRole()}catch(e){toast(errMsg(e))}}

async function flushPending(){if(!USER||!PROF)return;const a=pend();if(!a.length)return;setPend([]);let ok=0;
 for(const p of a){try{await rpc('cast_vote',{rid:p.rid,cid:p.cid});ok++;track('vote_done',{t:p.tid,r:p.rid,c:p.cid,m:{after_login:true}})}catch(e){}}
 if(ok){toast(`로그인 전에 고른 ${ok}표를 반영했어요`);track('login_done',{m:{flushed:ok}})}await loadDeck();const t=curTopic();if(t)DR=Math.min(DR+0,t.roles.length)}

function openLoginSheet(){const m=$('#loginSheet');if(!m)return;m.classList.add('on');setTimeout(()=>{const b=m.querySelector('[data-act=login]');if(b)b.focus()},50)}

/* 스와이프: 왼쪽 = 건너뛰기, 오른쪽 = 다음 작품 */
function bindSwipe(){const c=$('#dkCard');if(!c)return;let x0=null,dx=0,id=null;
 c.addEventListener('pointerdown',e=>{if(e.target.closest('button,a'))return;x0=e.clientX;id=e.pointerId;c.setPointerCapture(id);c.style.transition='none'});
 c.addEventListener('pointermove',e=>{if(x0==null)return;dx=e.clientX-x0;c.style.transform=`translateX(${dx}px) rotate(${dx/25}deg)`});
 const end=()=>{if(x0==null)return;c.style.transition='';const t=curTopic(),r=curRole();
  if(dx<-90){track('skip',{t:t&&t.id,r:r&&r.id,m:{swipe:true}});c.classList.add('fly-l');setTimeout(nextRole,200)}
  else if(dx>90){track('topic_skip',{t:t&&t.id,m:{swipe:true}});c.classList.add('fly-r');setTimeout(nextTopic,200)}
  else c.style.transform='';x0=null;dx=0};
 c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end)}
addEventListener('keydown',e=>{if(!DECKV||e.target.closest('input,textarea,select'))return;if(e.key==='ArrowLeft'){const t=curTopic(),r=curRole();track('skip',{t:t&&t.id,r:r&&r.id,m:{key:true}});nextRole()}if(e.key==='ArrowRight')nextTopic()});

/* ================= 결과와 토론방(작품 화면 하단) ================= */
let TALK={tid:null,combos:[],open:null,thread:[],myv:{}};
async function loadTalk(tid){TALK.tid=tid;const box=$('#talkBox');if(!box)return;
 try{TALK.combos=await rpc('topic_combos',{tid})||[]}catch(e){TALK.combos=[]}renderTalk()}
function comboLine(p){return (D?D.roles:[]).filter(r=>p[r.id]).map(r=>`<span class="cl"><small>${esc(SLOT[r.slot]||r.ch)}</small>${esc(p[r.id])}</span>`).join('')}
function renderTalk(){const box=$('#talkBox');if(!box||!D)return;const t=topic(),seen=D.seen;
 if(!seen){box.innerHTML=`<div class="talk0"><b>결과와 토론방은 투표한 사람에게 열려요</b><p class="sub">배역 하나라도 투표하면 득표율, 캐스팅 조합 순위, 조합별 토론방을 볼 수 있어요.</p><a class="b buy" href="#">카드로 투표하기</a></div>`;return}
 const cs=TALK.combos;
 box.innerHTML=`<div class="sh"><h2>캐스팅 조합 순위</h2><span class="sub">같은 조합을 고른 사람 수</span></div>
 ${cs.length?`<ol class="combos">${cs.map((c,i)=>`<li class="${c.mine?'mine':''}${TALK.open===c.ckey?' open':''}"><button class="cbtn" data-act="talk-open" data-k="${c.ckey}" aria-expanded="${TALK.open===c.ckey}"><span class="rk">${i+1}</span><span class="cls">${comboLine(c.picks)}</span><span class="cn">${fmt(c.users)}명${c.mine?', 내 조합':''}<br><small>토론 ${fmt(c.comments)}</small></span></button>${TALK.open===c.ckey?`<div class="thread" id="thread">${threadHTML(c)}</div>`:''}</li>`).join('')}</ol>`:'<p class="empty3">모든 배역을 고른 사람이 아직 없어요. 남은 배역도 투표하면 내 조합이 순위에 올라가요.</p>'}`}
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
 if(a==='dk-skip'){const t=curTopic(),r=curRole();track('skip',{t:t&&t.id,r:r&&r.id});const c=$('#dkCard');if(c){c.classList.add('fly-l');setTimeout(nextRole,200)}else nextRole();return}
 if(a==='dk-nexttopic'){const t=curTopic();track('topic_skip',{t:t&&t.id});nextTopic();return}
 if(a==='dk-restart'){DI=0;DR=0;await loadDeck();const t=curTopic();if(t)DR=firstOpenRole(t);renderDeck();return}
 if(a==='sheet-close'){$('#loginSheet').classList.remove('on');return}
 if(a==='talk-open'){openThread(b.dataset.k);return}
 if(a==='tvote'){if(needLogin())return;try{const r=await rpc('vote_thread',{cid:+b.dataset.id,val:+b.dataset.v});const x=TALK.thread.find(y=>y.id===+b.dataset.id);if(x){x.up=r.up;x.down=r.down;x.hidden=r.hidden;const mv=TALK.myv[x.id]||0;TALK.myv[x.id]=mv===+b.dataset.v?0:+b.dataset.v}renderTalk()}catch(err){toast(errMsg(err))}return}
 if(a==='treply'){const f=$('#tr'+b.dataset.id);if(f){f.hidden=!f.hidden;if(!f.hidden)f.querySelector('input').focus()}return}
 if(a==='tpost'){if(needLogin())return;const parent=b.dataset.parent?+b.dataset.parent:null;const inp=parent?$('#tr'+parent).querySelector('input'):$('#tNew');const txt=inp.value.trim();if(!txt)return toast('내용을 적어 주세요');
  try{await rpc('post_thread',{tid:TALK.tid,ck:TALK.open,parent,txt});track('thread_post',{t:TALK.tid,m:{reply:!!parent}});inp.value='';const k=TALK.open;TALK.open=null;await openThread(k);const c=TALK.combos.find(x=>x.ckey===k);if(c)c.comments++;renderTalk()}catch(err){toast(errMsg(err))}return}
 if(a==='tdel'){try{await rpc('delete_thread',{cid:+b.dataset.id});TALK.thread=TALK.thread.filter(x=>x.id!==+b.dataset.id);renderTalk()}catch(err){toast(errMsg(err))}return}
});
