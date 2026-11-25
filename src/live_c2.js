/* ================= C 디자인 통일 (작품 목록, 작품 상세, 랭킹, 나, 배우, VS 특집) ================= */
/* ---- 공통 ---- */
function c2Short(ch){return String(ch||'').replace(/\s*\(.*\)$/,'')}
function c2Dd(t){const ms=new Date(t.closes_at)-Date.now();if(t.closed_at||ms<=0)return '결과';const d=Math.floor(ms/864e5);return d<1?'D-DAY':'D-'+d}
function c2Deck(id){return (typeof DECK!=='undefined'&&DECK||[]).find(d=>d.id===id)}
function c2Faces(t,n){const d=c2Deck(t.id);if(!d)return [];return d.roles.flatMap(r=>r.cands||[]).filter(c=>hcImg(c.name)).sort((a,b)=>(b.votes||0)-(a.votes||0)).slice(0,n||4)}
function c2Prog(t){const d=c2Deck(t.id);if(!d||!d.roles.length)return 0;return Math.round(d.roles.filter(r=>r.mine).length/d.roles.length*100)}

/* ---- 작품 목록 ---- */
const c2Shelf={};
function c2Card(t,big){const p=big?((t.work&&(t.work.poster||t.work.backdrop))||shPoster(t)):shPoster(t),fc=c2Faces(t,4),pr=c2Prog(t),dd=c2Dd(t),soon=dd==='D-DAY'||dd==='D-1';
 return `<a class="c2c${big?' big':''}" href="#${esc(t.id)}"><span class="ph"${p?` style="background-image:url('${esc(p)}')"`:''}>${p?'':`<i>${esc(t.title)}</i>`}</span><span class="dd${soon?' hot':''}">${dd}</span>
 <span class="cap"><small>${esc(verLabel(t.cat)||'')}</small><b>${esc(t.title)}</b>${big&&fc.length?`<span class="fc">${fc.map(c=>`<i style="background-image:url('${esc(hcImg(c.name))}')"></i>`).join('')}</span>`:''}${pr?`<span class="bar"><i style="width:${pr}%"></i></span>`:''}</span></a>`}
renderShelves=function(){const box=$('#home');if(!box)return;if(!(DECK&&DECK.length)&&!c2Shelf.ld){c2Shelf.ld=1;loadDeck().then(()=>{if(HOMEV)renderShelves()})}const all=(TOPICS||[]).filter(t=>!t.opens_at||new Date(t.opens_at)<=new Date());
 const open=all.filter(t=>isOpen(t)),closed=all.filter(t=>!isOpen(t)).sort((a,b)=>new Date(b.closed_at||b.closes_at)-new Date(a.closed_at||a.closes_at));
 const cats=CATS.filter(c=>open.some(t=>t.cat===c.id)),L=EXCAT?open.filter(t=>t.cat===EXCAT):open;
 const byD=L.slice().sort((a,b)=>new Date(a.closes_at)-new Date(b.closes_at)),soon=byD.filter(t=>new Date(t.closes_at)-Date.now()<3*864e5).slice(0,6),rest=byD.filter(t=>!soon.includes(t));
 box.innerHTML=`<div class="c2w"><div class="c2t"><small>지금 열린 판 ${open.length}개</small><h1>어떤 작품을 <em>캐스팅</em>할까요</h1></div>
 <div class="c2chips"><button data-act="excat" data-c="" class="${EXCAT?'':'on'}">전체</button>${cats.map(c=>`<button data-act="excat" data-c="${esc(c.id)}" class="${EXCAT===c.id?'on':''}">${esc(c.name)}</button>`).join('')}</div>
 ${!EXCAT?c2Buzz():''}
 ${soon.length?`<div class="c2h"><b>마감 임박</b></div><div class="c2hot">${soon.map(t=>c2Card(t,1)).join('')}</div>`:''}
 ${rest.length?`<div class="c2h"><b>모든 판</b></div><div class="c2g">${rest.map(t=>c2Card(t)).join('')}</div>`:''}
 ${!EXCAT&&closed.length?`<div class="c2h"><b>결과 발표</b></div><div class="c2hot sm">${closed.slice(0,10).map(t=>c2Card(t)).join('')}</div>`:''}
 <a class="c2add" href="#make"><b>+</b>보고 싶은 작품 제안하기</a></div>`};


/* ---- 지금 화제작(넷플릭스 Top 10, Trakt, TVmaze) ---- */
var C2BZ=null;
function c2BzTag(x){return x.kr?`넷플릭스 한국 ${x.kr}위`:x.gl?`넷플릭스 전세계 ${x.gl}위`:x.tt?`Trakt 급상승 ${x.tt}위`:'스트리밍 화제작'}
function c2Buzz(){if(C2BZ===null){C2BZ=[];sb.rpc('buzz_cards',{n:12}).then(({data})=>{C2BZ=(data||[]);if(HOMEV&&C2BZ.length)renderShelves()}).catch(()=>{})}
 const L=(C2BZ||[]).slice().sort((a,b)=>(b.tid?1:0)-(a.tid?1:0)).slice(0,10);if(!L.length)return'';
 return `<div class="c2h"><b>지금 화제작</b></div><div class="c2bz">${L.map(x=>{const p=x.poster?'https://image.tmdb.org/t/p/w185'+x.poster:'',inner=`<span class="ph"${p?` style="background-image:url('${esc(p)}')"`:''}>${p?'':`<i>${esc(x.title)}</i>`}</span><span class="tg">${esc(c2BzTag(x))}</span><b>${esc(x.title)}</b><small>${x.tid?'판 열림':'판 준비 중'}</small>`;return x.tid?`<a class="bz on" href="#${esc(x.tid)}">${inner}</a>`:`<span class="bz">${inner}</span>`}).join('')}</div>`}

/* ---- 작품 상세: 배역 보드 ---- */
var C2SEL=null;
function c2Ph(n){return String(hcImg(n)||IMG['p:'+n]||'').replace('/t/p/original/','/t/p/h632/')}
function c2Nm(n){const d=dispName(n),m=d.match(/^(.*?)\s*\((.*)\)$/);return m?`<b>${esc(m[1])}</b><small>${esc(m[2])}</small>`:`<b>${esc(d)}</b>`}
function c2RoleFace(r){const mv=D.myVote[r.id],cs=D.cands[r.id]||[];let c=mv&&cs.find(x=>x.candidate_id===mv.candidate_id);if(!c&&D.seen)c=cs.slice().sort((a,b)=>b.votes-a.votes)[0];return c?c2Ph(c.name):''}
function c2RoleHTML(r){const t=topic(),open=isOpen(t),mv=D.myVote[r.id],blind=open&&!mv&&!isOpt(r),cs0=D.cands[r.id]||[];
 const cs=blind?cs0.slice().sort((a,b)=>a.candidate_id-b.candidate_id):cs0.slice().sort((a,b)=>b.votes-a.votes),tot=total(r)||1,EXP=EXPC.has(r.id),LIM=blind?8:7;
 const op=r.orig?c2Ph(r.orig):'',ag=r.orig&&typeof ageTxt==='function'?'':'';
 const head=`<div class="c2rh"><h2>${esc(c2Short(r.ch))}</h2>${r.orig?`<a class="og" href="#a/${encodeURIComponent(r.orig)}${r.orig_pid?'~'+r.orig_pid:''}">${op?`<i style="background-image:url('${esc(op)}')"></i>`:''}원작 ${esc(dispName(r.orig).replace(/\s*\(.*\)$/,''))}${c2OrigAge(r)}</a>`:''}</div>${r.descr?`<p class="c2rd">${esc(r.descr)}</p>`:''}`;
 if(!cs.length)return `<article class="c2role">${head}<p class="empty3">아직 후보가 없어요</p>${open?c2Add(r):''}</article>`;
 if(blind){const sh=EXP?cs:cs.slice(0,LIM);
  return `<article class="c2role">${head}<div class="c2pk">${sh.map(c=>{const on=C2SEL&&C2SEL.rid===r.id&&C2SEL.cid===c.candidate_id,u=c2Ph(c.name),a=ageTxt(c.name);
   return `<button class="c2p${on?' on':''}" data-act="c2pick" data-rid="${r.id}" data-cid="${c.candidate_id}"><span class="ph"${u?` style="background-image:url('${esc(u)}')"`:''}></span><span class="nm">${c2Nm(c.name)}${a?`<em>${esc(a)}</em>`:''}</span>${on?'<span class="ok">한 표</span>':''}</button>`}).join('')}</div>
  ${cs.length>LIM?`<button class="c2more" data-act="moreCands" data-rid="${r.id}">${EXP?'접기':`후보 ${cs.length-LIM}명 더`}</button>`:''}${c2Add(r)}</article>`}
 const lead=cs[0],rest=EXP?cs.slice(1):cs.slice(1,LIM),lu=c2Ph(lead.name),mine=c=>mv&&mv.candidate_id===c.candidate_id,pc=c=>Math.round((c.votes||0)/tot*100);
 return `<article class="c2role">${head}${!open?`<div class="c2closed">투표 마감</div>`:''}
 <a class="c2ld" href="#a/${encodeURIComponent(lead.name)}"><span class="ph"${lu?` style="background-image:url('${esc(lu)}')"`:''}></span><span class="cr">1</span>${mine(lead)?'<span class="me">내 표</span>':''}<span class="cap"><span class="nm">${c2Nm(lead.name)}</span><span class="pc">${pc(lead)}<small>%</small></span></span></a>
 <div class="c2ls">${rest.map((c,i)=>{const u=c2Ph(c.name);return `<a class="c2row${mine(c)?' me':''}" href="#a/${encodeURIComponent(c.name)}"><span class="n">${i+2}</span><span class="av"${u?` style="background-image:url('${esc(u)}')"`:''}></span><span class="nm">${c2Nm(c.name)}</span><span class="br"><i style="width:${Math.max(2,pc(c)/Math.max(1,pc(lead))*100)}%"></i></span><span class="pc">${pc(c)}%</span></a>`}).join('')}</div>
 ${cs.length>LIM?`<button class="c2more" data-act="moreCands" data-rid="${r.id}">${EXP?'접기':`후보 ${cs.length-LIM}명 더`}</button>`:''}
 <a class="c2vsq" href="#vs"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.5 4L7 12.5h4.5L11 20l6-8.5h-4.5z"/></svg>VS로 빠르게</a>${open?c2Add(r):''}</article>`}
function c2Add(r){return `<details class="c2addc"><summary>후보에 없는 배우 올리기</summary><div class="row2"><input type="text" id="ad${r.id}" placeholder="배우 이름" maxlength="20" aria-label="새 후보 배우 이름"><button class="b sm" data-act="add" data-rid="${r.id}">올리기</button></div></details>`}
renderRoles=function(){const box=$('#roles');if(!box||!D)return;if(SROLE>=D.roles.length)SROLE=0;
 const rs=D.roles.length>1?`<div class="c2rs" role="tablist">${D.roles.map((r,i)=>{const u=c2RoleFace(r),done=isSync(r)?D.mySync[r.id]:D.myVote[r.id];return `<button role="tab" class="${i===SROLE?'on':''}${done?' v':''}" data-act="rchip" data-i="${i}"><span class="av"${u?` style="background-image:url('${esc(u)}')"`:''}></span><b>${esc(c2Short(r.ch))}</b></button>`}).join('')}</div>`:'';
 const r=D.roles[SROLE];box.classList.add('c2');box.innerHTML=D.roles.length?rs+(isSync(r)?roleHTML(r,SROLE):c2RoleHTML(r)):'<p class="empty3">배역이 없어요</p>'};
document.addEventListener('click',e=>{const b=e.target.closest('[data-act="c2pick"]');if(!b)return;e.preventDefault();const rid=+b.dataset.rid,cid=+b.dataset.cid;
 if(C2SEL&&C2SEL.rid===rid&&C2SEL.cid===cid){C2SEL=null;const x=document.createElement('button');x.dataset.act='vote';x.dataset.rid=rid;x.dataset.cid=cid;x.hidden=true;document.body.appendChild(x);x.click();x.remove();navigator.vibrate&&navigator.vibrate([12,40,24]);return}
 C2SEL={rid,cid};navigator.vibrate&&navigator.vibrate(6);renderRoles()},true);
/* 작품 탭 버튼의 이모지 제거 */
(function(){document.querySelectorAll('#tTabs button > span[aria-hidden]').forEach(s=>s.remove())})();

/* 작품 머리: 보고 싶어요가 0이면 숨김 */
(function(){const f=renderHead;renderHead=function(){f();const t=topic&&topic();const b=document.querySelector('#tInfo [data-act="want"]');if(b&&t)b.classList.toggle('zero',!(t.wants>0)&&!WANTS.has(t.id))}})();

/* ---- 랭킹 ---- */
function c2Pod(L,ph,val,href){const t=[L[1],L[0],L[2]].filter(Boolean);return `<div class="c2pod">${t.map(x=>{const r=L.indexOf(x)+1,u=ph(x);return `<a class="p${r}" href="${href(x)}"><span class="av"${u?` style="background-image:url('${esc(u)}')"`:''}><i>${r}</i></span><b>${esc(x._n)}</b><small>${val(x)}</small></a>`}).join('')}</div>`}
renderFanBoard=function(){const b=$('#fanb');if(!b)return;const L=FANB.slice().sort((a,b)=>(b.votes-a.votes)||(b.fans-a.fans)).map(r=>Object.assign({},r,{_n:dispName(r.name).replace(/\s*\(.*\)$/,'')}));
 if(!L.length){b.innerHTML='<p class="empty3">후보가 올라오면 배우별 화력이 집계돼요.</p>';return}const href=x=>`#a/${encodeURIComponent(x.name)}`;
 b.innerHTML=c2Pod(L,x=>c2Ph(x.name),x=>`${fmt(x.votes)}표`,href)+`<div class="c2rk">${L.slice(3).map((x,i)=>{const u=c2Ph(x.name);return `<a class="c2rr" href="${href(x)}"><span class="n">${i+4}</span><span class="av"${u?` style="background-image:url('${esc(u)}')"`:''}></span><span class="nm"><b>${esc(x._n)}</b><small>팬 ${fmt(x.fans)}, 1위 ${x.leads}</small></span><span class="v">${fmt(x.votes)}<small>표</small></span></a>`}).join('')}</div>
 <div class="c2srch"><input type="text" id="aSearch" maxlength="20" placeholder="배우 찾기" aria-label="배우 이름"><button data-act="asearch" aria-label="찾기"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg></button></div>`};
renderRank=function(){const b=$('#rank');if(!b)return;if(!LEAD.length){b.innerHTML='<p class="empty3">첫 랭커를 기다리고 있어요.</p>';return}
 b.innerHTML=`<div class="c2rk">${LEAD.slice(0,10).map((r,i)=>`<a class="c2rr${PROF&&r.id===PROF.id?' me':''}" href="#u/${encodeURIComponent(r.nickname)}"><span class="n">${i+1}</span><span class="av ini">${esc(String(r.nickname).slice(0,1))}</span><span class="nm"><b>${esc(r.nickname)}</b><small>${GRADES[grade(fm(r))][1]}</small></span><span class="v">${fmt(fm(r))}<small>명성</small></span></a>`).join('')}</div>`};
(function(){document.querySelectorAll('.rknav button > span[aria-hidden]').forEach(s=>s.remove());const side=document.querySelector('.side');if(side&&!side.querySelector('.c2rt')){const h=document.createElement('div');h.className='c2rt';h.innerHTML='<small>지금 광장에서</small><h1>누가 <em>가장 뜨거울</em>까요</h1>';side.insertBefore(h,side.firstChild)}})();

/* ---- 나 (유저 페이지) v2 ---- */
const C2I={week:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',report:'<path d="M5 20V10M12 20V4M19 20v-7"/>',av:'<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>',vote:'<path d="M5 12l4 4 10-10"/>',sheet:'<rect x="5" y="10" width="14" height="9" rx="1"/><path d="M5 10l2-4h12l-2 4"/>',badge:'<path d="M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7z"/>',taste:'<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20h4"/>',set:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>'};
const C2B=['<path d="M5 12l4 4 10-10"/>','<path d="M6 9h11v5a5 5 0 0 1-10 0zM17 10h2a2 2 0 0 1 0 4h-2"/>','<path d="M12 3l2 5 5 .5-4 3.5 1 5-4-2.5-4 2.5 1-5-4-3.5 5-.5z"/>','<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>','<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>','<path d="M12 20v-8M12 12c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2-5-6-5 0 3 2 5 6 5z"/>','<rect x="5" y="10" width="14" height="9" rx="1"/><path d="M5 10l2-4h12l-2 4"/>','<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>','<path d="M5 6h14v9h-7l-4 3v-3H5z"/>','<path d="M12.5 3L6 13h5l-1 8 7-11h-5z"/>','<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>','<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>'];
const C2CAT={bio:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',wn:'<path d="M4 5h7v14H4zM13 5h7v14h-7z"/>',k2:'<path d="M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5M18 3v4h-4M6 21v-4h4"/>',k2us:'<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',us2k:'<path d="M5 21V4h12l-2 4 2 4H5"/>',ip2live:'<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M10 9l5 3-5 3z"/>'};
function c2Svg(d){return `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`}
let C2BUB=null;
function c2Bubbles(box){cancelAnimationFrame(C2BUB);if(!box||!box.isConnected)return;const W=box.clientWidth,H=box.clientHeight;
 const B=[...box.querySelectorAll('.tb')].map(el=>{const r=el.offsetWidth/2;return {el,r,x:r+Math.random()*Math.max(1,W-2*r),y:r+Math.random()*Math.max(1,H-2*r),vx:(Math.random()-.5)*.6,vy:(Math.random()-.5)*.6,m:r*r}});let drag=null;
 box.onpointerdown=e=>{const t=e.target.closest('.tb');if(!t)return;drag=B.find(b=>b.el===t);box.setPointerCapture(e.pointerId)};
 box.onpointermove=e=>{if(!drag)return;const R=box.getBoundingClientRect(),nx=e.clientX-R.left,ny=e.clientY-R.top;drag.vx=(nx-drag.x)*.3;drag.vy=(ny-drag.y)*.3;drag.x=nx;drag.y=ny};box.onpointerup=()=>drag=null;
 const step=()=>{if(!box.isConnected)return;for(const b of B){if(b!==drag){b.vx+=(Math.random()-.5)*.04-(b.x-W/2)*.0003;b.vy+=(Math.random()-.5)*.04-(b.y-H/2)*.0004;b.vx*=.992;b.vy*=.992;b.x+=b.vx;b.y+=b.vy}
   if(b.x<b.r){b.x=b.r;b.vx=Math.abs(b.vx)*.7}if(b.x>W-b.r){b.x=W-b.r;b.vx=-Math.abs(b.vx)*.7}if(b.y<b.r){b.y=b.r;b.vy=Math.abs(b.vy)*.7}if(b.y>H-b.r){b.y=H-b.r;b.vy=-Math.abs(b.vy)*.7}}
  for(let i=0;i<B.length;i++)for(let j=i+1;j<B.length;j++){const a=B[i],c=B[j],dx=c.x-a.x,dy=c.y-a.y,d=Math.hypot(dx,dy)||1,o=a.r+c.r+2-d;
   if(o>0){const nx=dx/d,ny=dy/d,ma=a===drag?1e9:a.m,mc=c===drag?1e9:c.m,ta=mc/(ma+mc),tc=ma/(ma+mc);a.x-=nx*o*ta;a.y-=ny*o*ta;c.x+=nx*o*tc;c.y+=ny*o*tc;
    const rv=(c.vx-a.vx)*nx+(c.vy-a.vy)*ny;if(rv<0){const k=-1.6*rv/(1/a.m+1/c.m);if(a!==drag){a.vx-=k/a.m*nx;a.vy-=k/a.m*ny}if(c!==drag){c.vx+=k/c.m*nx;c.vy+=k/c.m*ny}}}}
  for(const b of B)b.el.style.transform=`translate(${b.x-b.r}px,${b.y-b.r}px)`;C2BUB=requestAnimationFrame(step)};step()}
let C2TR=null;
function c2TeamRot(){clearInterval(C2TR);let k=0;const set=()=>{const cs=[...document.querySelectorAll('.c2team .tm')];if(!cs.length){clearInterval(C2TR);return}cs.forEach((c,ci)=>{const n=c.querySelectorAll('.ph.fr').length||1,i=(k+ci)%n;['.ph.fr','b.fr','.dots i'].forEach(q=>c.querySelectorAll(q).forEach((e,j)=>e.classList.toggle('on',j===i)))})};set();C2TR=setInterval(()=>{k++;set()},2600)}
(function(){const f=renderUser;renderUser=function(d){f(d);try{c2User(d)}catch(e){console.error(e)}}})();
function c2User(d){const pg=document.querySelector('.pg.user');if(!pg)return;const p=d.profile,s=d.stats,F=fm(p),g=grade(F),nx=GRADES[g+1],prog=nx?clamp((F-GRADES[g][0])/(nx[0]-GRADES[g][0]),0,1):1,rate=s.decided?Math.round(s.hits/s.decided*100):null;
 const C=2*Math.PI*44,ring=`<svg class="rg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44"/><circle class="on" cx="50" cy="50" r="44" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-prog)}"/></svg>`;
 const tile=(ic,v,l)=>`<span class="st">${c2Svg(ic)}<b>${v}</b><small>${l}</small></span>`;
 const likes=(s.sheet_likes||0)+(s.comment_likes||0)+(s.fan_likes||0);
 const hero=`<div class="c2me"><div class="top">${ring}<div class="id"><small>${d.me?'내 캐스팅 디렉터 카드':'캐스팅 디렉터'}</small><h1>${esc(p.nickname)}</h1><span class="gr">${GRADES[g][1]}</span></div></div>
  <div class="pts"><div class="pl"><b>${fmt(F)}<small>명성</small></b>${nx?`<span>${GRADES[g+1][1]}까지 ${fmt(nx[0]-F)}</span>`:''}</div><div class="bar"><i style="width:${Math.round(prog*100)}%"></i></div><span class="rkl">랭킹 ${fmt(p.rank)}위, 안목 포인트 ${fmt(p.points)}P</span></div>
  <div class="sts">${tile(C2B[3],rate==null?'-':rate+'%','적중률')}${tile(C2B[0],fmt(s.votes),'던진 표')}${tile(C2B[7],fmt(likes),'받은 공감')}${tile(C2B[6],fmt(s.sheets),'내 시트')}</div></div>`;
 /* 취향 버블 */
 const cats=d.taste&&d.taste.cats?Object.entries(d.taste.cats).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,8):[];const mx=cats.length?cats[0][1]:1;
 const taste=cats.length?`<div class="c2sh"><b>내 취향</b></div><div class="c2taste" id="c2taste">${cats.map(([k,v])=>{const w=Math.round(62+46*Math.sqrt(v/mx));return `<span class="tb" style="width:${w}px;height:${w}px">${c2Svg(C2CAT[k]||C2B[2])}<small>${esc((CATS.find(c=>c.id===k)||{}).name||k)}</small></span>`}).join('')}</div>`:'';
 /* 내 캐스팅 팀: 작품별 카드, 배역 사진 로테이션 */
 const G={};(d.votes||[]).forEach(v=>{(G[v.tid]=G[v.tid]||{t:v.title,tid:v.tid,cs:[]}).cs.push(v)});const teams=Object.values(G).map(x=>(x.cs=x.cs.filter(v=>c2Ph(v.name)),x)).filter(x=>x.cs.length).slice(0,10);
 const team=teams.length?`<div class="c2sh"><b>내 캐스팅 팀</b><small>${teams.length}개 작품</small></div><div class="c2team">${teams.map(x=>`<a class="tm" href="#${esc(x.tid)}">${x.cs.map(v=>`<span class="ph fr" style="background-image:url('${esc(c2Ph(v.name))}')"></span>`).join('')}<span class="cap"><small>${esc(x.t)}</small><span class="nms">${x.cs.map(v=>`<b class="fr"><em>${esc(c2Short(v.ch))} 역</em>${esc(dispName(v.name).replace(/\s*\(.*\)$/,''))}</b>`).join('')}</span></span>${x.cs.length>1?`<span class="dots">${x.cs.map(()=>'<i></i>').join('')}</span>`:''}</a>`).join('')}</div>`:'';
 /* 업적 */
 STATS_CUR=s;const bd=BADGES.map((b,i)=>{const v=Math.min(b[3](s)||0,b[4]);return {i,on:v>=b[4],l:b[1],v,max:b[4]}}),non=bd.filter(x=>x.on).length;
 const badges=`<div class="c2sh"><b>업적</b><small>${non}/${bd.length}</small></div><div class="c2bd">${bd.sort((a,b)=>b.on-a.on).map(x=>`<span class="bd${x.on?' on':''}" title="${esc(BADGES[x.i][2])}"><i>${c2Svg(C2B[x.i]||C2B[2])}</i><small>${esc(x.l)}</small></span>`).join('')}</div>`;
 const uh=pg.querySelector('.uhero');if(uh)uh.outerHTML=hero;
 const ix=pg.querySelector('.dindex');if(ix){ix.insertAdjacentHTML('beforebegin',taste+team+(d.me?'':'')+badges+'<div class="c2sh"><b>메뉴</b></div>');
  ix.querySelectorAll('button').forEach(b=>{const s0=b.querySelector('.di');if(s0)s0.innerHTML=c2Svg(C2I[b.dataset.k]||C2B[2])})}
 pg.querySelectorAll('.badges2 .bdg').forEach((el,i)=>{const s0=el.querySelector('.bi');if(s0)s0.innerHTML=c2Svg(C2B[i]||C2B[2])});
 setTimeout(()=>{c2Bubbles($('#c2taste'));c2TeamRot()},50)}

/* ---- 배우 페이지 ---- */
const C2PL={'South Korea':'대한민국','Korea':'대한민국','USA':'미국','United States':'미국','U.S.A.':'미국','UK':'영국','United Kingdom':'영국','England':'영국','China':'중국','Japan':'일본','Taiwan':'대만','Hong Kong':'홍콩','Canada':'캐나다','Australia':'호주','France':'프랑스','Seoul':'서울','Busan':'부산','Incheon':'인천','Daegu':'대구','Gwangju':'광주','Daejeon':'대전','Gyeonggi-do':'경기도','London':'런던','New York City':'뉴욕','Los Angeles':'로스앤젤레스','Beijing':'베이징','Shanghai':'상하이','Tokyo':'도쿄','Taipei':'타이베이'};
function c2Place(s){return String(s||'').split(/,\s*/).map(x=>C2PL[x.trim()]||x.trim()).filter((x,i,a)=>a.indexOf(x)===i).join(' ')}
(function(){const f=renderActor;renderActor=async function(){await f.apply(this,arguments);try{c2Actor()}catch(e){console.error(e)}}})();
function c2Actor(){const pg=document.querySelector('.pg.actor');if(!pg)return;
 pg.querySelectorAll('.ahero .astats > span').forEach(sp=>{const v=(sp.querySelector('b')||{}).textContent;if(v==='0'||v==='-')sp.remove()});
 const st=pg.querySelector('.ahero .astats');if(st&&!st.children.length)st.remove();
 pg.querySelectorAll('.ahero p.sub').forEach(p=>{p.innerHTML=p.innerHTML.replace(/, ([A-Za-z][^<]*)$/,(m,x)=>', '+esc(c2Place(x)))});
 const dl=pg.querySelector('.ahero p.dl');if(dl)dl.remove();
 const ph=pg.querySelector('.ahero img.aph');if(ph){const h=pg.querySelector('.ahero');h.style.setProperty('--ab',`url('${ph.src}')`);h.classList.add('c2a')}
 const cs=pg.querySelector('.cheer-st');if(cs&&[...cs.querySelectorAll('b')].every(b=>/^(0|-|0일)$/.test(b.textContent.trim()))){const nx=cs.nextElementSibling;if(nx&&/아직/.test(nx.textContent))nx.remove();cs.remove()}
 if(!pg.querySelector('.cheer-st'))pg.querySelectorAll('.cheer p, .cheer .sub').forEach(x=>{if(/아직 이번 달 응원/.test(x.textContent))x.remove()});
 pg.querySelectorAll('.race .row2 .b.sm.buy').forEach(b=>b.textContent='한 표')}

/* ---- VS 특집(케미, 원작 대 새 얼굴)도 확정 VS 디자인으로 ---- */
vsRenderSpecial=function(box){const d=DUEL,R=d.res,[L,Rt]=vsSides(),ver=verLabel(d.cat),W=box.clientWidth||360,H=Math.max(300,Math.min(innerHeight-(DUEL&&DUEL.res?420:340),760)),h=d.hi2;
 const cls=s=>R?(R.bad?'lose':R.pick===s.key?'win':'lose'):h?(h===s.key?'hi':'dim'):'idle';
 const ik=d.pk+':'+d.t0,intro=!h&&!R&&VSF_INK!==ik;if(intro)VSF_INK=ik;
 const pct=s=>R&&R.tot?Math.round((R.pick===s.key?R.same:R.tot-R.same)/R.tot*100):null;
 const body=s=>d.kind==='chem'?`<span class="ph2c"><span class="t">${vsfPh(s.m.name,W,H/2)}</span><span class="b">${vsfPh(s.f.name,W,H/2)}</span></span><span class="hl"></span><span class="nm"><b>${esc(dispName(s.m.name).replace(/\s*\(.*\)$/,''))}</b><em>× ${esc(dispName(s.f.name).replace(/\s*\(.*\)$/,''))}</em></span>`
  :d.kind==='legacy'?`${vsfPh(s.n,W,H)}<span class="hl"></span><span class="tg2">${esc(s.y||'')}${s.wk?' '+esc(c2Short(s.wk)):''}</span><span class="nm">${vsfNm(s.n)}</span>`
  :`${vsfPh(s.n,W,H)}<span class="hl"></span><span class="tg2">${s.key==='orig'?'원작':'새 얼굴'}</span><span class="nm">${vsfNm(s.n)}</span>`;
 const half=(s,pos)=>`<button class="${pos} ${cls(s)}" data-act="c2sp" data-v="${s.key}">${body(s)}${R&&!R.bad&&pct(s)!=null?`<span class="pct">${pct(s)}%</span>`:''}${h===s.key&&!R?'<span class="ask2"><b>한 번 더 탭하면 확정</b></span>':''}${R&&R.pick===s.key?'<span class="cast2">PICK!</span>':''}</button>`;
 const q=d.kind==='legacy'?`역대 ${esc(d.ch)}, 누가 최고?`:d.kind==='chem'?`${esc(c2Short(d.rm.ch))} × ${esc(c2Short(d.rf.ch))}, 더 끌리는 커플은?`:`${esc(c2Short(d.ch))} 역, 원작 그대로?`;
 box.innerHTML=`<div class="vsf c2sp ${d.kind}"><div class="vsf-hd">${d.tid?`<a href="#${esc(d.tid)}">${esc(d.title)}${ver?' '+esc(ver):''}</a>`:`<a>${esc(d.title)}</a>`}<b>${q}</b></div>
<div class="fight${intro?' intro':''}" style="height:${H}px">${half(L,'l')}${half(Rt,'r')}<span class="vsb">VS</span><span class="wl"></span></div>
${R&&!R.bad?(()=>{const nmOf=s=>d.kind==='chem'?`${c2Short(dispName(s.m.name))} × ${c2Short(dispName(s.f.name))}`:dispName(s.n);const lp=pct(L);return vsResHTML(nmOf(L),nmOf(Rt),lp,R.tot,R.pick===L.key?0:1)})():''}${vsStreakHTML()}
${d.kind==='legacy'&&R&&d.line?`<div class="c2line"><b>역대 ${esc(d.ch)}</b>${d.line.map(x=>`<span><em>${esc(x.year||'')}</em>${esc(x.name)} <small>${esc(c2Short(x.work||''))}</small></span>`).join('')}</div>`:''}
<div class="hc-bar vsf-bar${R?' one':''}">${R?(R.bad?'':'<button class="hb main" data-act="vsNext">다음 대결<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>'):'<button class="hb" data-act="vsBad"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14V4M7 14l4 6c1.1 0 2-.9 2-2v-3h5.3a2 2 0 0 0 2-2.3l-1.2-7A2 2 0 0 0 17.1 4H7M7 14H4V4h3"/></svg>둘 다 별로</button><button class="hb main" data-act="vsNext">다른 대결<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>'}</div></div>`};
document.addEventListener('click',e=>{const d=DUEL;if(!d||!d.kind)return;const b=e.target.closest('[data-act="c2sp"]');
 if(!b){if(d.hi2&&!d.res&&e.target.closest('#duel')&&!e.target.closest('[data-act]')){d.hi2=null;renderDuel()}return}
 e.preventDefault();if(d.res)return;const k=b.dataset.v;if(d.hi2!==k){d.hi2=k;navigator.vibrate&&navigator.vibrate(8);renderDuel();return}vsPick(k,false)});

/* ---- P2 15: 배우 페이지, 남의 페이지에서는 들어온 탭을 그대로 켜 둠 ---- */
var C2TAB='#';
(function(){const f=navItems;navItems=function(){const L=f(),v=curView(),own=L[4][3];
 if(v==='page'&&PAGE&&!own&&(PAGE.kind==='a'||PAGE.kind==='u')){L.forEach(x=>x[3]=x[0]===C2TAB)}
 else{const on=L.find(x=>x[3]);if(on)C2TAB=on[0]}return L}})();

/* ---- P2 17: 육각 타일 작품명은 단어 단위로 줄여 두 줄까지 ---- */
function c2HexLab(t){t=String(t||'').replace(/&amp;/g,'&');if(t.length<=6)return t;const w=t.split(/\s+/);let o='';for(const x of w){if((o+' '+x).trim().length>9)break;o=(o+' '+x).trim()}
 if(!o)o=w[0].slice(0,5);return o.length<t.length?o+'…':o}
(function(){const f=storyRings;storyRings=function(){return f.apply(this,arguments).replace(/<em>([^<]*)<\/em>/g,(m,x)=>`<em>${esc(c2HexLab(x))}</em>`)}})();

/* ---- P2 18: 원작 배우 나이는 원작 공개 당시 기준 ---- */
const C2OA={};
(function(){const f=loadTopic;loadTopic=async function(){const r=await f.apply(this,arguments);const tid=SEL;if(tid&&!C2OA[tid]){C2OA[tid]={};rpc('cast_links',{tid}).then(L=>{(L||[]).forEach(x=>{if(x.ob&&x.oy&&!C2OA[tid][x.rid])C2OA[tid][x.rid]=x.oy-x.ob});if(D&&D.tid===tid)renderRoles()}).catch(()=>{})}return r}})();
function c2OrigAge(){return ''}

/* ---- P2 21: 추천 노출 확대 (VS 확정 직후, 나 탭) ---- */
function c2RelItem(d,r,why){const v=verLabel(d.cat),u=d.vposter||d.poster;return `<a class="rl" href="#${esc(d.id)}"><span class="ph"${u?` style="background-image:url('${esc(u)}')"`:''}></span><span class="tx"><b>《${esc(d.title)}》${v?' '+esc(v):''} ${esc(c2Short(r.ch))} 역</b><small>${why}</small></span><i>›</i></a>`}
function c2RelFor(names,skipRid,n){const out=[],used=new Set(),pd=pend(),open=r=>!r.mine&&!pd.some(p=>p.rid===r.id);
 for(const nm of names){for(const d of (DECK||[])){if(out.length>=n)break;if(used.has(d.id))continue;const r=(d.roles||[]).find(r=>r.id!==skipRid&&open(r)&&(r.cands||[]).some(c=>c.name===nm));
  if(r){used.add(d.id);out.push(c2RelItem(d,r,`<em>${esc(dispName(nm).replace(/\s*\(.*\)$/,''))}</em>, 여기서도 후보예요`))}}}
 if(out.length<n){const s=(DECK||[]).filter(d=>!used.has(d.id)&&new Date(d.closes_at)>Date.now()).sort((a,b)=>new Date(a.closes_at)-new Date(b.closes_at));
  for(const d of s){if(out.length>=n)break;const r=(d.roles||[]).find(open);if(r){used.add(d.id);const h=Math.ceil((new Date(d.closes_at)-Date.now())/36e5);out.push(c2RelItem(d,r,h<=24?'오늘 마감':`마감 D-${Math.ceil(h/24)}`))}}}
 return out}
async function c2EnsureDeck(){if(!(DECK&&DECK.length))try{await loadDeck()}catch(e){}}
/* VS: 확정하면 그 배우가 후보인 다른 배역을 아래에 */
(function(){const f=vsfCast;vsfCast=async function(d,k){const w=k==='a'?d.a:d.b;f.apply(this,arguments);await c2EnsureDeck();
 const it=c2RelFor([w.name],d.rid,2);let box=$('#c2vsRel');if(!box){const du=$('#duel');if(!du)return;du.insertAdjacentHTML('afterend','<div class="hc-rel c2vsrel" id="c2vsRel"></div>');box=$('#c2vsRel')}
 if(it.length)box.innerHTML=`<b class="hd">이어서 고르기</b>${it.join('')}`}})();
/* 나 탭: 내 픽 배우가 후보인 판, 곧 마감인 판 */
(function(){const f=c2User;c2User=function(d){f(d);if(!d.me)return;c2EnsureDeck().then(()=>{const pg=document.querySelector('.pg.user');if(!pg||pg.querySelector('.c2merel'))return;
 const names=[...new Set((d.votes||[]).map(v=>v.name))];const it=c2RelFor(names,null,3);if(!it.length)return;
 const at=pg.querySelector('.c2sh');if(at)at.insertAdjacentHTML('beforebegin',`<div class="hc-rel c2merel"><b class="hd">이어서 고르기</b>${it.join('')}</div>`)})}})();

/* ---- P2 22: 광장에서 투표 중인 배역의 원작 배우를 머리에 표시 (포스터 속 인물 구분은 자동으로 할 수 없어 원작 얼굴로 대신) ---- */
(function(){const f=renderDeckC;renderDeckC=function(box,t,r){f.apply(this,arguments);if(!r||!r.orig)return;const u=c2Ph(r.orig),hd=box.querySelector('.hc-hd > div');if(!hd||!u)return;
 hd.insertAdjacentHTML('beforeend',`<a class="hc-og" href="#a/${encodeURIComponent(r.orig)}${r.orig_pid?'~'+r.orig_pid:''}"><i style="background-image:url('${esc(u)}')"></i><span>원작 <b>${esc(dispName(r.orig).replace(/\s*\(.*\)$/,''))}</b></span></a>`)}})();

/* ---- P3 25: 내 팀 안에서 같은 소속사, 레이블, 그룹 출신 찾기 (Wikidata, person_affil) ---- */
(function(){const f=renderDoneC;renderDoneC=async function(box,t){const r=await f.apply(this,arguments);try{
 const S=t.roles.map(hcRoleStat).filter(Boolean),P=S.map(s=>({pid:s.mine.pid,nm:dispName(s.mine.name).replace(/\s*\(.*\)$/,'')})).filter(x=>x.pid);if(P.length<2)return r;
 const {data}=await sb.from('person_affil').select('person_id,kind,name,qid').in('person_id',P.map(x=>x.pid));if(!data||!data.length)return r;
 const G={};data.forEach(a=>{(G[a.qid]=G[a.qid]||{n:a.name,k:a.kind,p:new Set()}).p.add(a.person_id)});
 const hits=Object.values(G).filter(g=>g.p.size>=2).sort((a,b)=>(a.k==='group'?0:1)-(b.k==='group'?0:1)),used=new Set(),lines=[];
 for(const g of hits){const key=[...g.p].sort().join();if(used.has(key))continue;used.add(key);const nms=P.filter(x=>g.p.has(x.pid)).map(x=>x.nm);lines.push(`${nms.map(esc).join(', ')}, 같은 ${g.k==='group'?'그룹':'소속'} ${esc(g.n)} 출신`);if(lines.length>=2)break}
 if(!lines.length)return r;const at=box.querySelector('.mp-links')||box.querySelector('.mp-type');const html=`<div class="mp-links c2tm"><b>우리 팀 연결고리</b>${lines.map(x=>`<p>${x}</p>`).join('')}</div>`;
 if(at)at.insertAdjacentHTML('afterend',html)}catch(e){}return r}})();

/* ---- P3 24: 포스터가 없는 웹소설, 웹툰 원작 판은 직접 만든 글자 카드로 (원작 그림은 쓰지 않음) ---- */
const C2GP={};
function c2GenPoster(t){if(!t)return '';if(C2GP[t.id])return C2GP[t.id];let h=0;for(const ch of String(t.id))h=(h*31+ch.charCodeAt(0))>>>0;
 const hues=[[268,330],[200,250],[150,190],[20,350],[40,10]],[a,b]=hues[h%hues.length],title=String(t.title||''),w=[];let line='';
 for(const x of title.split(/\s+/)){if((line+' '+x).trim().length>6&&line){w.push(line);line=x}else line=(line+' '+x).trim()}if(line)w.push(line);
 const fs=w.length>3?46:56,y0=420-(w.length-1)*fs*.55,med=t.src_medium||'원작',au=String(t.info||'').split(',')[0].replace(/\s*(웹소설|웹툰)$/,'');
 const e=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 750"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${a},45%,22%)"/><stop offset="1" stop-color="hsl(${b},40%,8%)"/></linearGradient><radialGradient id="r" cx=".75" cy=".2" r=".7"><stop offset="0" stop-color="hsl(${a},70%,55%)" stop-opacity=".45"/><stop offset="1" stop-opacity="0"/></radialGradient></defs><rect width="500" height="750" fill="url(#g)"/><rect width="500" height="750" fill="url(#r)"/><g fill="none" stroke="#D4FF3A" stroke-opacity=".5"><path d="M40 160h420M40 600h420"/></g><text x="40" y="130" font-family="sans-serif" font-size="22" font-weight="800" fill="#D4FF3A" letter-spacing="2">${e(med)} 원작</text><text x="250" y="470" text-anchor="middle" font-family="'Noto Sans KR',sans-serif" font-size="300" font-weight="900" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3">${e(title.replace(/\s/g,'').slice(0,1))}</text><text x="40" y="650" font-family="sans-serif" font-size="22" font-weight="700" fill="#BDBDBD">${e(au)}</text><text x="40" y="690" font-family="sans-serif" font-size="18" font-weight="700" fill="#8A8A8A" letter-spacing="3">DREAM CASTING</text></svg>`;
 return C2GP[t.id]='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg).replace(/'/g,'%27').replace(/\(/g,'%28').replace(/\)/g,'%29')}
(function(){const f=shPoster;shPoster=function(t){return f(t)||c2GenPoster(t)}})();
(function(){const f=topicHero;topicHero=function(){f();const th=document.querySelector('#topicView .th'),t=typeof topic==='function'&&topic();if(th&&t&&!tBack(t))th.style.setProperty('--hb',`url("${c2GenPoster(t)}")`)}})();
(function(){const f=loadDeck;loadDeck=async function(){const r=await f.apply(this,arguments);try{(DECK||[]).forEach(d=>{if(!d.poster&&!d.vposter){const t=(TOPICS||[]).find(x=>x.id===d.id)||d;d.vposter=d.poster=c2GenPoster(t)}})}catch(e){}return r}})();

/* ---- 역대 배역 대결(legacy): 같은 배역을 맡은 실사 배우끼리. 결과 뒤에 배역 연표 ---- */
(function(){const _sides=vsSides;vsSides=function(){const d=DUEL;if(d&&d.kind==='legacy'){const A={key:'a',w:String(d.a.id),n:d.a.name,y:d.a.year,wk:d.a.work},B={key:'b',w:String(d.b.id),n:d.b.name,y:d.b.year,wk:d.b.work};return d.flip?[B,A]:[A,B]}return _sides()}})();
vsTrySpecial=async function(first){if(first)return false;VS_N++;if(VS_N%3!==0)return false;
 const cyc=['legacy','orig','chem'],st=(VS_N/3)%3,order=[cyc[st]].concat(cyc.filter((_,i)=>i!==st));
 for(const k of order){const s=k==='legacy'?await rpc('vs_legacy',{skip:VS_SKIP}).catch(()=>null):await rpc('vs_special',{k,prefer:SEL||null,skip:VS_SKIP}).catch(()=>null);
  if(s&&s.kind){let names;if(s.kind==='legacy'){for(const x of [s.a,s.b])if(x.p&&!IMG['p:'+x.name])IMG['p:'+x.name]='https://image.tmdb.org/t/p/w500'+x.p;names=[s.a.name,s.b.name]}else names=s.kind==='chem'?[s.a.m.name,s.a.f.name,s.b.m.name,s.b.f.name]:[s.orig,s.c.name];
   await duelImgs(names);DUEL={...s,flip:Math.random()<.5,res:null,t0:performance.now()};track&&track('vs_special',{t:s.tid,r:s.rid||null,m:{k:s.kind}});return true}}
 return false};

/* ===== VS 연속 보상(11/25): 오늘 5, 10, 20판에 안목 포인트 +10, +20, +50. 3판마다 특별 대결(역대 배역, 원작, 케미) ===== */
const VSM=[5,10,20],VSP={5:10,10:20,20:50};let VS_DONE=new Set();
function vsStreakHTML(){const n=STREAK,m=VSM.find(x=>x>n),prev=[...VSM].reverse().find(x=>x<=n)||0,toSp=3-(VS_N%3||0);
 const pips=m?Array.from({length:m-prev},(_,i)=>`<i class="${prev+i<n?'on':''}${prev+i===n?' nx':''}"></i>`).join(''):'';
 const sp=DUEL&&DUEL.kind&&DUEL.kind!=='normal'?'<b>지금 특별 대결</b>':`특별 대결까지 <b>${toSp===3?3:toSp}판</b>`;
 return `<div class="vstk" aria-label="연속 ${n}판">
  <div class="vstk-n"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1.2 2.6 2.4 2.9C11 9 11 6 12 3z"/></svg><b>${n}</b><small>연속</small></div>
  <div class="vstk-m">${m?`<div class="vstk-t"><span>${m}판 달성하면</span><b>+${VSP[m]} 안목 포인트</b></div><div class="vstk-p">${pips}</div>`:`<div class="vstk-t"><span>오늘 연속 보상</span><b>모두 받았어요</b></div>`}</div>
  <div class="vstk-s"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z"/></svg><span>${sp}</span></div></div>`}
async function vsStreakCheck(){const m=VSM.find(x=>x===STREAK);if(!m||VS_DONE.has(m))return;VS_DONE.add(m);
 let got=0,guest=!USER||!PROF;if(!guest){try{got=await rpc('vs_streak_claim',{n:m})||0}catch(e){}}
 const el=document.createElement('div');el.className='vsburst';
 el.innerHTML=`<div class="vb-in"><small>연속 ${m}판 달성</small><b>+${VSP[m]}</b><span>${guest?'로그인하면 안목 포인트로 쌓여요':got?'안목 포인트를 받았어요':'오늘 이미 받은 보상이에요'}</span></div>`;
 document.body.appendChild(el);setTimeout(()=>el.classList.add('out'),1900);setTimeout(()=>el.remove(),2400);try{navigator.vibrate&&navigator.vibrate([10,30,10,30,20])}catch(e){}
 try{track('vs_streak',{m:{n:m,got,guest}})}catch(e){}if(got&&PROF){PROF.points=(PROF.points||0)+got;if(PROF.fame!=null)PROF.fame+=got;try{renderMe&&renderMe()}catch(e){}}}
(function(){const f=renderDuel;renderDuel=function(){const r=f.apply(this,arguments);vsStreakCheck();return r}})();

/* VS 결과 막대: 투표하면 양쪽 득표율과 광장 몇 명의 선택인지 보여 줌. 자동으로 넘어가지 않고 "다음 대결"로 */
function vsResHTML(a,b,pa,n,mine){if(pa==null)return `<div class="vsres wait"><p>광장 표를 세는 중이에요</p></div>`;
 const pb=100-pa,me=mine===0?pa:pb,strip=x=>esc(String(x).replace(/\s*\(.*\)$/,''));
 const say=n<=1?'첫 표를 던졌어요. 다음 사람을 기다려요':me>=50?`광장 ${n}명 중 ${me}%가 나와 같은 선택`:`광장 ${n}명 중 ${me}%만 고른 소신 픽`;
 return `<div class="vsres"><div class="vr-n"><span class="${mine===0?'me':''}">${strip(a)}<b>${pa}%</b></span><span class="${mine===1?'me':''}"><b>${pb}%</b>${strip(b)}</span></div>
 <div class="vr-bar"><i class="a${mine===0?' me':''}" style="width:${pa}%"></i><i class="b${mine===1?' me':''}" style="width:${pb}%"></i></div><p>${say}</p></div>`}

/* ===== VS 탭 나누기(11/25): 내 픽(내 취향) / 민심 픽(광장이 누구를 더 고를지 안목 포인트로 예측) =====
   민심 픽 정답은 그 판 마감 때 광장 실제 득표. 정산할 때 내 표는 빼고 셈. 배역 표가 20표 미만이면 돌려받음
   포인트는 충전, 현금, 상품권 교환이 없음 */
let VSMODE='mine';const PM={list:null,i:0,side:null,stake:30,done:null,mine:null,busy:false};
function vsTabsHTML(){return `<div class="vstabs" role="tablist"><button role="tab" aria-selected="${VSMODE==='mine'}" class="${VSMODE==='mine'?'on':''}" data-act="vsmode" data-m="mine"><b>내 픽</b><small>내 취향대로</small></button><button role="tab" aria-selected="${VSMODE==='pm'}" class="${VSMODE==='pm'?'on':''}" data-act="vsmode" data-m="pm"><b>민심 픽</b><small>광장의 선택 맞히기</small></button></div>`}
(function(){const f=renderDuel;renderDuel=function(){const box=$('#duel');if(VSMODE==='pm'&&box){pmRender(box);return}const r=f.apply(this,arguments);if(box&&box.firstElementChild&&!box.querySelector('.vstabs'))box.insertAdjacentHTML('afterbegin',vsTabsHTML());return r}})();
async function pmLoad(force){if(PM.list&&!force)return;try{PM.list=await rpc('pm_feed',{lim:30})||[]}catch(e){PM.list=[]}PM.i=0;
 try{await loadNames(PM.list.slice(0,8).filter(m=>m.kind==='role'||m.kind==='pv').flatMap(m=>[m.a.name,m.b.name]))}catch(e){}
 if(USER&&PROF){try{PM.mine=await rpc('pm_mine',{})}catch(e){}}}
function pmOdds(m,side,stake){const sa=+m.sa||0,sb=+m.sb||0,pool=sa+sb+stake,mine=(side==='a'?sa:sb)+stake;return Math.min(5,Math.max(1.2,pool/mine))}
function pmLeft(t){const ms=new Date(t)-Date.now(),d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5);return d>0?`D-${d}`:h>0?`${h}시간 남음`:'곧 마감'}
const PMK={role:{tag:'광장 투표',res:'판이 마감되면 광장 실제 득표로 정산'},nf_kr:{tag:'넷플릭스 한국 순위',res:'다음 주 넷플릭스 공식 순위가 나오면 정산'},pv:{tag:'위키백과 조회수',res:'7일 조회수가 모이면 정산'},box:{tag:'극장 관객 수',res:'그날 박스오피스 집계가 나오면 정산'}};
/* 확률 변화 그래프: 예측이 걸릴 때마다 기록한 A쪽 포인트 비율 */
function pmChart(m){const h=(m.hist||[]).slice();const now=Date.now()/1000,cur=(+m.sa+ +m.sb)?(+m.sa/(+m.sa+ +m.sb)):.5;
 if(!h.length)h.push([now-3600,.5]);h.push([now,cur]);const t0=h[0][0],t1=Math.max(h[h.length-1][0],t0+1),W=300,H=64;
 const pt=h.map(([t,p])=>[((t-t0)/(t1-t0))*W,H-4-(+p)*(H-8)]),path=pt.map((q,i)=>(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' ');
 return `<svg class="pm-ch" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="${W}" y1="${H/2}" y2="${H/2}" class="mid"/><path d="${path}" class="ln"/><circle cx="${pt[pt.length-1][0]}" cy="${pt[pt.length-1][1]}" r="3.5" class="dot"/></svg>`}
function pmFace(m,k,W,H){const c=m[k];if(m.kind==='nf_kr'||m.kind==='box'){return c.img?`<span class="ph pm-po" style="background-image:url('${esc(c.img)}')"></span>`:`<span class="ph pm-tx"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v14H3zM7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/></svg></span>`}return vsfPh(c.name,W,H)}
async function pmRender(box){box.innerHTML=vsTabsHTML()+'<div class="pm pm-load"><p>민심 대결을 불러오는 중</p></div>';await pmLoad();if(VSMODE!=='pm')return;
 const m=PM.done||PM.list[PM.i],W=box.clientWidth||360,H=Math.max(240,Math.min(innerHeight-600,520)),pts=PROF?PROF.points||0:null;
 const st=PM.mine&&PM.mine.done?`<span class="pm-hit">적중 ${PM.mine.hit}/${PM.mine.done}</span>`:'';
 if(!m){box.innerHTML=vsTabsHTML()+`<div class="pm pm-empty"><b>열린 민심 대결을 모두 예측했어요</b><span>결과가 나오면 정산 결과가 포인트로 들어와요</span>${st}</div>`;return}
 if(m.kind==='pv'&&!(IMG['p:'+m.a.name]&&IMG['p:'+m.b.name])){try{await loadNames([m.a.name,m.b.name])}catch(e){}}
 const K=PMK[m.kind]||PMK.role,sa=+m.sa||0,sb=+m.sb||0,tot=sa+sb,pa=tot?Math.round(sa/tot*100):50,done=PM.done===m,sel=done?m.my:PM.side;
 const nmf=k=>esc(dispName(m[k].name).replace(/\s*\(.*\)$/,'')),rk=m.kind==='nf_kr'&&m.now?k=>`<span class="pm-rk">이번 주 ${m.now[k==='a'?0:1]}위</span>`:()=>'';
 const half=(k)=>`<button class="${k==='a'?'l':'r'} ${sel?(sel===k?'win':'lose'):'idle'}" data-act="pmside" data-k="${k}" aria-pressed="${sel===k}">${pmFace(m,k,W,H)}<span class="hl"></span><span class="nm">${m.kind==='role'||m.kind==='pv'?vsfNm(m[k].name):`<b>${esc(m[k].name)}</b>`}${rk(k)}</span>${sel===k?`<span class="pm-tag">${done?'예측 완료':'이쪽 예측'}</span>`:''}</button>`;
 const odds=sel&&!done?pmOdds(m,sel,PM.stake):null;
 const hd=m.kind==='role'?`<a href="#${esc(m.topic_id)}">${esc(m.title)}${verLabel(m.cat)?' '+esc(verLabel(m.cat)):''}</a><b>${esc(String(m.ch).replace(/\s*\(.*\)$/,''))} 역, 광장은 누구를 더 고를까?</b>`:`<b>${esc(m.q)}</b>`;
 box.innerHTML=vsTabsHTML()+`<div class="vsf pm"><div class="vsf-hd"><span class="pm-kind">${esc(K.tag)}</span>${hd}</div>
<div class="fight" style="height:${H}px">${half('a')}${half('b')}<span class="vsb">VS</span><span class="wl"></span></div>
<div class="pm-mkt"><div class="pm-mh"><b>예측 확률</b><small>예측한 사람들이 건 포인트 비율이에요. 득표율이 아니에요</small></div>
 <div class="vr-n"><span>${nmf('a')}<b>${pa}%</b></span><span><b>${100-pa}%</b>${nmf('b')}</span></div>${pmChart(m)}
 <p>${m.n?`예측 ${m.n}명`:'아직 아무도 예측하지 않았어요'}, ${pmLeft(m.closes_at)} 예측 마감, ${esc(K.res)}</p></div>
${done?`<div class="pm-ok"><b>${nmf(m.my)} 쪽에 ${m.stake}포인트 예측 완료</b><span>${esc(K.res)}돼요</span></div>`:
 `<div class="pm-stake"><span>얼마나 확신해요?</span>${[10,30,50].map(v=>`<button class="${PM.stake===v?'on':''}" data-act="pmstake" data-v="${v}"${pts!=null&&pts<v?' disabled':''}>${v}</button>`).join('')}<em>${pts!=null?`내 포인트 ${pts}`:'로그인 후 예측'}</em></div>
 ${odds?`<p class="pm-odds">맞히면 <b>+${Math.round(PM.stake*odds)}</b> 포인트 (${odds.toFixed(1)}배)</p>`:'<p class="pm-odds">이길 것 같은 쪽을 누르세요</p>'}`}
<div class="hc-bar vsf-bar">${done?`<button class="hb main" data-act="pmnext">다음 예측<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>`:`<button class="hb" data-act="pmnext">다른 대결</button><button class="hb main" data-act="pmgo"${sel?'':' disabled'}>${sel?`${PM.stake}포인트 예측하기`:'한쪽을 먼저 골라요'}</button>`}</div>
<p class="pm-rule">${m.kind==='role'?'정산 때 내 표는 빼고 계산해요. 배역 표가 10표 미만이거나 동점이면 포인트를 돌려드려요. ':'동점이면 포인트를 돌려드려요. '}안목 포인트는 현금이나 상품으로 바꿀 수 없어요. ${st}</p></div>`}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-act^="pm"],[data-act="vsmode"]');if(!b)return;const a=b.dataset.act;
 if(a==='vsmode'){e.preventDefault();const m=b.dataset.m;if(VSMODE===m)return;VSMODE=m;track&&track('vs_mode',{m:{mode:m}});if(m==='pm'){PM.done=null;PM.side=null}renderDuel();return}
 if(VSMODE!=='pm')return;e.preventDefault();const box=$('#duel');
 if(a==='pmside'){if(PM.done)return;PM.side=b.dataset.k;pmRender(box);return}
 if(a==='pmstake'){PM.stake=+b.dataset.v;pmRender(box);return}
 if(a==='pmnext'){PM.done=null;PM.side=null;PM.i++;if(PM.i>=PM.list.length){PM.list=null}pmRender(box);return}
 if(a==='pmgo'){const m=PM.list[PM.i];if(!m||!PM.side||PM.busy)return;if(!USER||!PROF){track&&track('login_prompt',{m:{pm:true}});openLoginSheet();return}
  PM.busy=true;try{const r=await rpc('pm_bet_place',{mid:m.id,side:PM.side,stake:PM.stake});Object.assign(m,{sa:r.sa,sb:r.sb,n:(+m.n||0)+1,my:PM.side,stake:PM.stake});PROF.points=r.points;PM.done=m;PM.list.splice(PM.i,1);PM.i--;
   track&&track('pm_bet',{t:m.topic_id,r:m.role_id,m:{stake:PM.stake}});try{navigator.vibrate&&navigator.vibrate([12,40,24])}catch(x){}pmRender(box)}catch(err){toast(errMsg(err))}PM.busy=false}});

/* ---------- 심화 분석 (안목 포인트 30P로 판별 해금) ---------- */
const DEEP={};
async function loadDeepT(tid){if(DEEP[tid]&&DEEP[tid]!=='x')return;DEEP[tid]='x';try{DEEP[tid]=USER?await rpc('topic_deep',{tid}):{locked:true}}catch(e){DEEP[tid]={locked:true}}renderDeepT()}
function dpSpark(c,mx,days){const W=220,H=46;if(!c.pts.length)return'';const xs=d=>days.length>1?days.indexOf(d)/(days.length-1)*W:W/2;let last=0;const pt=days.map(d=>{const f=c.pts.find(p=>p[0]===d);if(f)last=f[1];return`${xs(d).toFixed(1)},${(H-2-last/mx*(H-6)).toFixed(1)}`});return`<polyline points="${pt.join(' ')}" fill="none" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`}
const DPG={'14-19':'10대','20-24':'20대 초반','25-29':'20대 후반','30-34':'30대 초반','35-39':'30대 후반','40-49':'40대','50+':'50대 이상',m:'남성',f:'여성',x:'미공개','?':'미공개'};
function dpDemo(L){const by={};L.forEach(x=>{const [a,g]=String(x.g).split('|');const k=[DPG[a]||a,DPG[g]||g].filter(v=>v&&v!=='미공개').join(' ')||'미공개';(by[k]=by[k]||[]).push(x)});const ks=Object.keys(by);if(!ks.length)return'<p class="dp-e">그룹별 3표가 쌓이면 보여요</p>';return ks.map(k=>{const a=by[k].sort((x,y)=>y.n-x.n),t=a.reduce((m,x)=>m+x.n,0);return`<div class="dp-dr"><b>${esc(k)}</b><span>${esc(a[0].c)} ${Math.round(a[0].n/t*100)}%</span></div>`}).join('')}
function renderDeepT(){const box=$('#tDeep');if(!box)return;const t=topic();if(!t){box.innerHTML='';return}const d=DEEP[t.id];if(d===undefined){loadDeepT(t.id);box.innerHTML='';return}if(d==='x')return;
 if(d.locked){box.innerHTML=`<div class="dp lock"><div><b>심화 분석</b><p>후보별 득표 흐름, 세대와 성별 선호, 나와 같은 픽을 한 사람들의 다른 선택</p></div><button class="hb" data-act="dpbuy">${USER?'30P로 열기':'로그인하고 열기'}</button></div>`;return}
 const R=(d.roles||[]).filter(r=>(r.flow||[]).length);if(!R.length){box.innerHTML=`<div class="dp"><b>심화 분석</b><p class="dp-e">아직 쌓인 표가 없어요</p></div>`;return}
 box.innerHTML=`<div class="dp"><b>심화 분석</b>${R.map(r=>{const days=[...new Set(r.flow.flatMap(c=>c.pts.map(p=>p[0])))].sort(),mx=Math.max(1,...r.flow.flatMap(c=>c.pts.map(p=>p[1])));
  return`<section class="dp-r"><h4>${esc(r.ch||'')}</h4><div class="dp-fl"><svg viewBox="0 0 220 46" preserveAspectRatio="none">${r.flow.map(c=>dpSpark(c,mx,days)).join('')}</svg><div class="dp-lg">${r.flow.map((c,i)=>`<span class="c${i}">${esc(c.c)} ${fmt((c.pts[c.pts.length-1]||[0,0])[1])}표</span>`).join('')}</div></div>
  <div class="dp-sub"><small>세대와 성별 1위</small>${dpDemo(r.demo||[])}</div>
  ${(r.twins||[]).length?`<div class="dp-sub"><small>나와 같은 픽을 한 사람들이 다른 배역에서 많이 고른 배우</small><div class="dp-tw">${r.twins.map(x=>`<span>${esc(x.name)} ${x.n}</span>`).join('')}</div></div>`:''}</section>`}).join('')}</div>`}
{const f=renderStats;renderStats=function(){f.apply(this,arguments);try{renderDeepT()}catch(e){}}}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-act="dpbuy"]');if(!b)return;if(!USER){try{openLoginSheet()}catch(x){toast('로그인이 필요해요')}return}const t=topic();if(!t)return;
 if(!confirmBuy())return;b.disabled=true;try{const n=await rpc('deep_unlock_buy',{tid:t.id});if(PROF&&n)PROF.points-=n;toast(n?'심화 분석을 열었어요. 30P를 썼어요':'이미 열려 있어요');delete DEEP[t.id];loadDeepT(t.id);try{renderWho()}catch(x){}}catch(x){b.disabled=false;toast(errMsg(x))}
 function confirmBuy(){if(PROF&&PROF.points<30){toast('안목 포인트가 모자라요. 30P가 필요해요');return false}return true}});
