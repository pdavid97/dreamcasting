/* ================= 온보딩: 한 화면 훅, 취향 3개 고르기, 체험 3표 후 로그인 ================= */
const ONB_K='dc_onb',ONB_CATS=[['wn','웹소설 실사화','📖'],['k2','한국 드라마 리메이크','🇰🇷'],['k2us','할리우드판','🎬'],['us2k','해외 명작 한국판','🌏'],['k2cn','중국판','🐉']];
function onbGet(){try{return JSON.parse(localStorage.getItem(ONB_K)||'null')}catch(e){return null}}
function onbSet(o){try{localStorage.setItem(ONB_K,JSON.stringify(o))}catch(e){}}
/* 비로그인일 때 고른 배우와 분류로 덱 순서를 다시 매김(로그인 뒤에는 서버 취향이 순서를 정함) */
function onbSort(deck){const o=onbGet();if(USER||!o||!deck||!deck.length)return deck||[];const A=new Set(o.actors||[]),C=new Set(o.cats||[]);
 const sc=d=>(C.has(d.cat)?3:0)+8*Math.min(3,d.roles.reduce((n,r)=>n+r.cands.filter(c=>A.has(c.name)).length,0));
 return deck.map((d,i)=>[d,sc(d),i]).sort((a,b)=>b[1]-a[1]||a[2]-b[2]).map(x=>x[0])}
let ONB={step:0,actors:[],cats:[]};
function openOnb(){if($('#onb'))return;ONB={step:0,actors:[],cats:[]};const ov=document.createElement('div');ov.id='onb';ov.className='onb';document.body.appendChild(ov);renderOnb();track('onb_open',{})}
function onbPid(n){for(const d of DECK)for(const r of d.roles)for(const c of r.cands)if(c.name===n&&c.pid)return c.pid;return null}
function closeOnb(done){const o=$('#onb');if(o)o.remove();const cur=onbGet()||{};const pids=ONB.actors.map(onbPid).filter(Boolean);onbSet({...cur,done:true,actors:ONB.actors.length?ONB.actors:cur.actors||[],pids:ONB.actors.length?pids:cur.pids||[],followed:ONB.actors.length?false:cur.followed,cats:ONB.cats.length?ONB.cats:cur.cats||[]});if(USER&&PROF&&pids.length)onbFollow();
 if(done){DECK=onbSort(DECK);DI=0;DR=DECK[0]?firstOpenRole(DECK[0]):0;if(location.hash&&location.hash!=='#')location.hash='';renderDeck();scrollTo({top:0})}track('onb_close',{m:{done:!!done,a:ONB.actors.length,c:ONB.cats.length}})}
function onbFaces(){const seen=new Set(),out=[];const rank=['classic','buzz','chem','seed','user','wild'];
 const cs=DECK.flatMap(d=>d.roles.flatMap(r=>r.cands)).sort((a,b)=>rank.indexOf(a.pick)-rank.indexOf(b.pick));
 for(const c of cs){if(seen.has(c.name)||!IMG['p:'+c.name])continue;seen.add(c.name);out.push(c.name);if(out.length>=12)break}return out}
function renderOnb(){const ov=$('#onb');if(!ov)return;const s=ONB.step,dots=`<div class="onb-dots">${[0,1,2].map(i=>`<i class="${i===s?'on':''}"></i>`).join('')}</div>`;
 if(s===0){const ps=[...new Set(DECK.map(d=>d.vposter||d.poster).filter(Boolean))].slice(0,9);
  ov.innerHTML=`<div class="onb-in onb-hook"><div class="onb-wall" aria-hidden="true">${ps.map((u,i)=>`<span style="background-image:url('${esc(u)}');--d:${i*70}ms"></span>`).join('')}</div>
   <div class="onb-copy">${dots}<small>드림캐스팅 광장</small><h1>그 역, 누가 맡아야<br>할까요?</h1><p>웹소설 실사화와 명작 리메이크를 내 손으로 캐스팅해요. 매일 새 판이 열리고, 7일 뒤 결과가 발표돼요. 1위를 맞히면 포인트!</p>
   <button class="b buy big" data-act="onb-next">캐스팅 시작하기</button><button class="lk" data-act="onb-skip">그냥 둘러볼게요</button></div></div>`;return}
 if(s===1){const fs=onbFaces();
  ov.innerHTML=`<div class="onb-in onb-taste">${dots}<h2>좋아하는 배우를 골라 주세요</h2><p class="sub">3명이면 딱 좋아요. 이 배우가 후보인 작품부터 보여 드려요.</p>
   <div class="onb-faces">${fs.map(n=>{const on=ONB.actors.includes(n);return `<button class="fc${on?' on':''}" data-act="onb-actor" data-n="${esc(n)}" aria-pressed="${on}"><span style="background-image:url('${esc(IMG['p:'+n])}')"></span><b>${dispHTML(n)}</b>${on?'<i>✓</i>':''}</button>`}).join('')||'<p class="sub">후보를 불러오는 중이에요</p>'}</div>
   <h3>어떤 판이 끌려요?</h3><div class="onb-cats">${ONB_CATS.map(([k,l,ic])=>`<button class="ct${ONB.cats.includes(k)?' on':''}" data-act="onb-cat" data-k="${k}"><span>${ic}</span>${l}</button>`).join('')}</div>
   <div class="onb-foot"><button class="b buy big" data-act="onb-next"${ONB.actors.length||ONB.cats.length?'':' disabled'}>${ONB.actors.length?`${ONB.actors.length}명 골랐어요, 다음`:'다음'}</button><button class="lk" data-act="onb-next">건너뛰기</button></div></div>`;
  if(!fs.length)setTimeout(()=>{if(ONB.step===1)renderOnb()},800);return}
 ov.innerHTML=`<div class="onb-in onb-go">${dots}<div class="onb-big" aria-hidden="true">🗳️</div><h2>첫 3표를 던져 보세요</h2>
  <ol class="onb-how"><li><b>돌려서 고르고</b>배우 사진을 돌리다가 맨 위 사진을 한 번 더 탭</li><li><b>바로 민심 확인</b>한 표마다 지금 광장 1위가 누구인지 보여 드려요</li><li><b>7일 뒤 결과 발표</b>내 픽이 1위면 적중 포인트</li></ol>
  <p class="sub">로그인은 3표를 다 고른 다음에 해도 돼요.</p><button class="b buy big" data-act="onb-done">시작!</button></div>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act^="onb-"]');if(!b)return;const a=b.dataset.act;
 if(a==='onb-next'){ONB.step=Math.min(2,ONB.step+1);renderOnb();return}
 if(a==='onb-skip'){closeOnb(false);return}
 if(a==='onb-done'){closeOnb(true);return}
 if(a==='onb-actor'){const n=b.dataset.n,i=ONB.actors.indexOf(n);if(i>=0)ONB.actors.splice(i,1);else if(ONB.actors.length<5)ONB.actors.push(n);else toast('5명까지 고를 수 있어요');renderOnb();return}
 if(a==='onb-cat'){const k=b.dataset.k,i=ONB.cats.indexOf(k);if(i>=0)ONB.cats.splice(i,1);else ONB.cats.push(k);renderOnb();return}});
/* 처음 온 사람: 덱이 준비되면 온보딩을 띄움. #welcome으로 언제든 다시 보기 */
function onbMaybe(){if(location.hash==='#welcome'){location.hash='';openOnb();return}
 const o=onbGet();if(!USER&&!(o&&o.done)&&curView()==='deck'&&DECK.length)openOnb()}
window.addEventListener('hashchange',()=>{if(location.hash==='#welcome')onbMaybe()});
const ONB_T0=Date.now();setTimeout(function wait(){if(location.hash==='#welcome'||(DECK.length&&curView()==='deck'))onbMaybe();else if(Date.now()-ONB_T0<15000)setTimeout(wait,300)},1000);

/* 체험 투표: 비로그인 3표까지는 바로 민심을 보여 주고, 3표째에 로그인 권유 */
async function guestPick(t,r,cid){const a=pend().filter(p=>p.rid!==r.id);a.push({tid:t.id,rid:r.id,cid,at:Date.now()});setPend(a);track('guest_vote',{t:t.id,r:r.id,c:cid,m:{n:a.length}});
 const pk=await rpc('role_peek',{rid:r.id,cid}).catch(()=>null);const me=(r.cands.find(c=>c.id===cid)||{}).name||'';showPeek(r,me,pk,a.length)}
function showPeek(r,me,pk,n){const old=$('#dkPeek');if(old)old.remove();const tot=pk?+pk.total:0,top=pk&&pk.top&&pk.top[0],pct=x=>tot?Math.round(x/tot*100):0,same=top&&top.name===me,u=IMG['p:'+me];
 const msg=!tot?'아직 아무도 고르지 않은 배역이에요. 내 표가 첫 표!':same?`지금 광장 1위도 <b>${dispHTML(me)}</b>예요. 민심과 같은 눈!`:`지금 광장 1위는 <b>${dispHTML(top.name)}</b> ${pct(top.v)}%. 내 픽이 뒤집을 수 있을까요?`;
 const el=document.createElement('div');el.id='dkPeek';el.className='peek';el.innerHTML=`<div class="peek-in"><small>${esc(r.ch)} 역, 체험 투표 ${n}/3</small>
  <div class="peek-me"><span class="av"${u?` style="background-image:url('${esc(u)}')"`:''}></span><div><small>내 픽</small><b>${dispHTML(me)}</b></div></div>
  <p>${msg}</p>${tot?`<div class="peek-bars">${(pk.top||[]).map(x=>`<div class="${x.name===me?'me':''}"><span>${dispHTML(x.name)}</span><i style="--p:${pct(x.v)}%"></i><b>${pct(x.v)}%</b></div>`).join('')}</div><small class="sub">지금까지 ${fmt(tot)}표</small>`:''}
  <div class="peek-dots">${[1,2,3].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</div>
  ${n>=3?`<button class="b buy big" data-act="peek-save">3표 저장하고 결과 받기</button><button class="lk" data-act="peek-x">나중에</button>`:`<button class="b buy big" data-act="peek-x">다음 배역 ${3-n}표 남음</button>`}</div>`;
 document.body.appendChild(el)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act="peek-x"],[data-act="peek-save"]');if(!b)return;const el=$('#dkPeek');if(el)el.remove();
 if(b.dataset.act==='peek-save'){openLoginSheet(true);return}nextRole()});

/* 온보딩에서 고른 배우를 로그인 뒤 팬 채널에 등록(고유 번호 people.id 기준, 이미 들어간 채널은 그대로) */
async function onbFollow(){const o=onbGet();if(!o||o.followed||!(o.pids||[]).length||!USER)return;try{const n=await rpc('follow_many',{pids:o.pids});onbSet({...o,followed:true});if(n)toast(`고른 배우 ${n}명의 팬 채널에 들어왔어요`)}catch(e){}}
async function onbAfterLogin(){if(!USER||!PROF)return;try{const o=onbGet();if(o&&!o.saved&&(o.cats||[]).length&&!(PROF.tastes&&(PROF.tastes.cats||[]).length)){await rpc('set_tastes',{t:{cats:o.cats,genres:(PROF.tastes||{}).genres||[],makers:(PROF.tastes||{}).makers||[]},b:PROF.bio||''});onbSet({...o,saved:true})}}catch(e){}onbFollow()}
