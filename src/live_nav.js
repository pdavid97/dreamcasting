/* 글로벌 내비게이션: 모바일은 하단 탭 5개, 데스크탑은 상단 메뉴. 화면 상태는 body[data-view] 하나로 관리 */
var VIEWX=null;
function curView(){if(PAGE)return 'page';if(DECKV)return 'deck';if(VIEWX)return VIEWX;if(HOMEV)return 'explore';return 'topic'}
function applyView(){document.body.dataset.view=curView()}
function navItems(){const v=curView(),me=PROF?'#u/'+encodeURIComponent(PROF.nickname):'#me',myPage=v==='page'&&PAGE&&((PAGE.kind==='u'&&PROF&&PAGE.nick===PROF.nickname)||PAGE.kind==='me');
 const unread=(typeof NOTICES!=='undefined'&&NOTICES?NOTICES.filter(x=>!x.read).length:0);
 return [['#','광장',IC.home,v==='deck'],['#explore','작품',IC.grid,v==='explore'||v==='topic'],['#vs','VS 한판',IC.vs,v==='vs'],['#rank','랭킹',IC.trophy,v==='rank'||(v==='page'&&PAGE&&PAGE.kind==='a')],[me,USER?(PROF?'나':'닉네임'):'로그인',IC.user,myPage,unread]]}
function renderTabbar(){applyView();const html=navItems().map(x=>`<a href="${x[0]}" class="${x[3]?'on':''}" ${x[3]?'aria-current="page"':''}${x[4]?` aria-label="${x[1]}, 새 알림 ${x[4]}개"`:''}>${x[2]}${x[4]?`<i class="tb-badge">${x[4]>9?'9+':x[4]}</i>`:''}<span>${x[1]}</span></a>`).join('');
 const b=$('#tabbar');if(b)b.innerHTML=html;const g=$('#gnav');if(g)g.innerHTML=html}
/* 특수 주소: 홈(오늘의 카드), 작품, VS 한판, 랭킹, 만들기, 나 */
function navSpecial(h){VIEWX=null;
 if(!h||h==='home'){showHome(false);showDeck(true);renderTabbar();scrollTo({top:0});return}
 showDeck(false);
 if(h==='explore'){showHome(true);renderTabbar();scrollTo({top:0});track('explore_view');return}
 if(h==='search'){showHome(true);renderTabbar();scrollTo({top:0});setTimeout(()=>$('#gq')&&$('#gq').focus(),50);return}
 if(h==='vs'){showHome(false);VIEWX='vs';renderTabbar();renderDuel();scrollTo({top:0});track('vs_view');return}
 if(h==='rank'||h==='actors'){showHome(false);VIEWX='rank';renderTabbar();scrollTo({top:0});track('rank_view');return}
 if(h==='make'){showHome(true);renderTabbar();$('#propBox').open=true;$('#propBox').scrollIntoView({behavior:'smooth'});return}
 if(h==='me'){if(!USER){showMeLogin();return}renderTabbar();if(needLogin())return;if(PROF)location.hash='u/'+encodeURIComponent(PROF.nickname);return}
 showHome(true);renderTabbar()}

/* 상단 바를 없애고 검색은 작품 탭 맨 위로 */
(function(){const f=$('#gs'),t=$('#tabs');if(f&&t&&t.parentNode){t.parentNode.insertBefore(f,t);f.classList.add('xsearch')}const c=document.querySelector('.chy');if(c&&t&&t.parentNode)t.parentNode.insertBefore(c,f||t)})();
document.addEventListener('click',e=>{const b=e.target.closest('[data-act="loginClose"]');if(b||e.target.id==='loginModal')$('#loginModal').classList.remove('on')});
/* 랭킹 탭: 서브 랭킹을 아이콘 타일로 고르고, 고른 하나만 보여줌 */
const RK_SUBS=[['fire','배우 화력','🔥'],['meta','메타 지수','⭐'],['eye','안목 랭킹','👁️'],['media','크로스 미디어','🔁'],['perks','등급과 권한','🎖️'],['news','광장 소식','📣']];
(function(){const side=document.querySelector('.side');if(!side)return;const secs=[...side.querySelectorAll(':scope>section')].filter(s=>s.id!=='sideTop');
 const order=['fire','meta','media','news','perks','eye'];secs.forEach((s,i)=>{if(order[i])s.dataset.rk=order[i]});
 const nav=document.createElement('nav');nav.className='rknav';nav.setAttribute('aria-label','랭킹 종류');
 nav.innerHTML=RK_SUBS.map(([k,l,ic])=>`<button data-act="rksub" data-k="${k}"><span aria-hidden="true">${ic}</span><b>${l}</b></button>`).join('');
 side.insertBefore(nav,side.firstChild);
 let cur='fire';try{cur=localStorage.getItem('rkSub')||'fire'}catch(e){}setRk(cur)})();
function setRk(k){document.querySelectorAll('.side>section[data-rk]').forEach(s=>{s.classList.toggle('rkon',s.dataset.rk===k);if(!s.querySelector(':scope>.rkmore')){const b=document.createElement('button');b.className='rkmore';b.dataset.act='rkmore';b.textContent='모두 보기';s.appendChild(b)}});document.querySelectorAll('.rknav button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.k===k));try{localStorage.setItem('rkSub',k)}catch(e){}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act="rksub"]');if(!b)return;setRk(b.dataset.k);track('rank_sub',{m:{k:b.dataset.k}});scrollTo({top:0,behavior:'smooth'})});
/* 실수한 표 되돌리기: 투표 직후 10초 동안 하단에 되돌리기 바 */
let UNDO_T=null;
function showUndo(rid,label){let el=$('#undoBar');if(!el){el=document.createElement('div');el.id='undoBar';el.className='undobar';el.setAttribute('role','status');document.body.appendChild(el)}
 clearTimeout(UNDO_T);let n=10;el.innerHTML=`<span>${esc(label)}</span><button data-act="undoVote" data-rid="${rid}">되돌리기 <b id="undoS">${n}</b></button>`;el.classList.add('on');
 const tick=()=>{n--;const b=$('#undoS');if(b)b.textContent=n;if(n<=0)el.classList.remove('on');else UNDO_T=setTimeout(tick,1000)};UNDO_T=setTimeout(tick,1000);teamCheck(rid)}
async function teamCheck(rid){if(!D||!D.roles.some(r=>r.id===rid))return;setTimeout(()=>{const RS=D.roles.filter(r=>!isSync(r)&&!isOpt(r));const left=RS.filter(r=>!D.myVote[r.id]).length;if(!left&&RS.length>1)toast('내 캐스팅 팀 완성! 팀 공감 순위에 올라갔어요');else if(left&&left<=2)toast(`${left}개 배역만 더 고르면 내 팀 완성`)},1600)}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-act="undoVote"]');if(!b)return;const rid=+b.dataset.rid;b.disabled=true;
 try{await rpc('undo_vote',{rid});clearTimeout(UNDO_T);$('#undoBar').classList.remove('on');toast('표를 되돌렸어요. 다시 골라 주세요');track('vote_undo',{r:rid});
  try{for(const t of (typeof DECK!=='undefined'?DECK:[]))for(const r of (t.roles||[]))if(r.id===rid)r.mine=null}catch(x){}
  if(DUEL&&DUEL.rid===rid){DUEL.cast='undone'}
  await refresh();try{if(DECKV)renderDeck()}catch(x){}try{if(VIEWX==='vs')renderDuel()}catch(x){}}
 catch(err){b.disabled=false;toast(errMsg(err))}});
/* 팀 카드의 빈칸을 누르면 그 배역 카드로 */
document.addEventListener('click',e=>{const b=e.target.closest('[data-act="team-gap"]');if(!b)return;const el=document.querySelector(`#roles .role[data-rid="${b.dataset.rid}"]`)||document.querySelectorAll('#roles .role')[+b.dataset.i];if(el){el.scrollIntoView({behavior:'smooth',block:'start'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1400)}});
/* 외국 배우는 원어 이름(한국어 표기) */
var ORIG={};
async function loadOrig(names,ctx){const all=[...new Set((names||[]).filter(n=>n&&!(n in ORIG)))];if(!all.length)return false;let any=false;for(let i=0;i<all.length;i+=60){if(await loadOrig1(all.slice(i,i+60),ctx))any=true}return any}
async function loadOrig1(need,ctx){need.forEach(n=>ORIG[n]=null);
 try{const r=await fetch(SB_URL+'/functions/v1/orig',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ANON,apikey:ANON},body:JSON.stringify({names:need,ctx:ctx||[]})});if(!r.ok)return false;const d=await r.json();let ch=false;
  for(const n in d){const x=d[n]||{};if(x.o){ORIG[n]=x.o;ch=true}if(x.p&&!IMG['p:'+n]){IMG['p:'+n]=x.p;ch=true}}return ch}catch(e){return false}}
/* 배우 표기 이름(actor_meta.disp): 본명이 영어면 "영어명 (한글명)", 한국어면 "한국어 (영어명)", 중국어 등은 "원어 (영어명)" */
var NM={},AMF={};
function loadNM(){try{fetch(SB_URL+'/rest/v1/actor_meta?select=name,disp,photo,face&ok=eq.true',{headers:{apikey:ANON,Authorization:'Bearer '+ANON}}).then(r=>r.ok?r.json():[]).then(a=>{(a||[]).forEach(x=>{if(x.disp)NM[x.name]=x.disp;AMF[x.name]={p:x.photo,f:x.face}});if(a&&a.length&&typeof render==='function')try{render()}catch(e){}}).catch(()=>{})}catch(e){}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(loadNM,0));else setTimeout(loadNM,0);
/* 화면용: 괄호 속 이름은 한 덩어리로 다음 줄에 내려가되, 칸보다 길면 그 안에서 단어 단위로 줄바꿈 */
function dispHTML(n){const d=dispName(n),m=d.match(/^(.*?)\s*(\([^()]*\))$/);return m?`${esc(m[1])} <span class="nmp">${esc(m[2])}</span>`:esc(d)}
function dispName(n){if(n&&NM[n])return NM[n];const o=n&&ORIG[n];return o&&o!==n?`${o} (${n})`:(n||'')}
/* 문장 속 《작품명》을 눌러 바로 찾기 */
function workLinks(h){return String(h).replace(/《([^《》]{1,40})》/g,(m,t)=>`<a class="wlink" href="#search" data-act="q" data-q="${t}">《${t}》</a>`)}
function goSearch(q){location.hash='explore';setTimeout(()=>{const i=$('#gq'),f=$('#gs');if(!i||!f)return;i.value=q;if(f.requestSubmit)f.requestSubmit();else f.dispatchEvent(new Event('submit',{cancelable:true}))},80)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act="q"]');if(!b)return;e.preventDefault();track('work_link',{m:{q:b.dataset.q}});goSearch(b.dataset.q)});

document.addEventListener('click',e=>{const b=e.target.closest('[data-act="rkmore"]');if(!b)return;const sec=b.parentElement;sec.classList.toggle('all');b.textContent=sec.classList.contains('all')?'접기':'모두 보기'});

/* 로그아웃 상태의 나 탭: 다른 화면 위에 시트를 띄우지 않고 전용 화면을 보여줌 */
function showMeLogin(){PAGE={kind:'me'};const ic=(d,l)=>`<span class="ml-i"><svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg><small>${l}</small></span>`;
 showPage(`<div class="pg melogin"><div class="ml-hero"><b class="ml-k">DREAM<br>CASTING</b><h1>내 캐스팅을<br><em>남겨 두세요</em></h1></div>
 <div class="ml-ics">${ic('<path d="M5 12l4 4 10-10"/>','투표 저장')}${ic('<circle cx="12" cy="9" r="4"/><path d="M5 20a7 7 0 0 1 14 0"/>','내 캐스팅 팀')}${ic('<path d="M8 4h8v5a4 4 0 0 1-8 0zM12 13v4M9 20h6"/>','포인트와 업적')}</div>
 <button class="lg g big" data-act="google"><span class="gdot"></span>구글로 시작하기</button></div>`);renderTabbar();track('login_prompt',{m:{at:'me'}})}
/* 화면을 옮기면 열려 있던 로그인 창은 닫음 */
addEventListener('hashchange',()=>{const m=$('#loginModal');if(m)m.classList.remove('on');const s=$('#loginSheet');if(s)s.classList.remove('on')});
