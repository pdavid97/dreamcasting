/* ================= VS 한판 개편: 상세 기록, 케미 대결, 원작 대 새 얼굴, VS 레이팅 ================= */
/* VS 한판은 공식 표와 별개. 고른 결과는 vs_log에 쌓이고(비로그인 포함), 매일 후보별 VS 레이팅으로 계산돼요 */
var VS_N=0,VSR={};
var VS_SKIP=(()=>{try{return JSON.parse(localStorage.getItem('vsSpecDone')||'[]')}catch(e){return[]}})();
function vsSaveSkip(){VS_SKIP=VS_SKIP.slice(-120);try{localStorage.setItem('vsSpecDone',JSON.stringify(VS_SKIP))}catch(e){}}

/* 기록 한 건: 이긴 쪽, 진 쪽, 고른 시간, 둘 다 별로, 비로그인 세션 */
function vsLog(k,o){return rpc('vs_log_add',{k,tid:o.tid||null,rid:o.rid||null,w:o.w||null,l:o.l||null,bad:!!o.bad,ms:o.ms!=null?Math.round(o.ms):null,s:SID||'',pk:o.pk,m:o.m||{}}).catch(()=>null)}

/* 세 판에 한 번꼴로 케미 대결이나 원작 대 새 얼굴을 섞어요. 첫 판과 작품에서 들어온 판은 배역 대결 */
async function vsTrySpecial(first){if(first)return false;VS_N++;if(VS_N%3!==0)return false;
 const order=(VS_N/3)%2?['chem','orig']:['orig','chem'];
 for(const k of order){const s=await rpc('vs_special',{k,prefer:SEL||null,skip:VS_SKIP}).catch(()=>null);
  if(s&&s.kind){const names=s.kind==='chem'?[s.a.m.name,s.a.f.name,s.b.m.name,s.b.f.name]:[s.orig,s.c.name];await duelImgs(names);
   DUEL={...s,flip:Math.random()<.5,res:null,t0:performance.now()};track&&track('vs_special',{t:s.tid,r:s.rid||null,m:{k:s.kind}});return true}}
 return false}

function vsFace(n){const u=IMG['p:'+n];return `<span class="face">${u?`<img src="${esc(u)}" alt="">`:esc((n||'?')[0])}</span>`}
function vsSides(){const d=DUEL;if(d.kind==='chem'){const A={key:'a',w:d.a.m.id+'-'+d.a.f.id,m:d.a.m,f:d.a.f},B={key:'b',w:d.b.m.id+'-'+d.b.f.id,m:d.b.m,f:d.b.f};return d.flip?[B,A]:[A,B]}
 const O={key:'orig',w:'orig',n:d.orig,lab:'원작 배우'},N={key:'new',w:'new',n:d.c.name,lab:'새 얼굴'};return d.flip?[N,O]:[O,N]}
function vsRenderSpecial(box){const d=DUEL,R=d.res,ver=verLabel(d.cat),[L,Rt]=vsSides();
 const where=`<a href="#${esc(d.tid)}">${esc(d.title)}${ver?' '+esc(ver):''}</a>`;
 const head=d.kind==='chem'
  ?`<div class="dq"><b>케미 대결: 어느 커플이 더 끌려요?</b><span>${where}, ${esc(jj(d.rm.ch,'과','와'))} ${esc(d.rf.ch)}</span></div>`
  :`<div class="dq"><b>원작 대 새 얼굴: ${esc(d.ch)} 역, 누가 더 어울려요?</b><span>${where}, 원작은 ${esc(d.orig)}</span></div>`;
 const res=s=>{if(!R)return '';if(R.bad)return '';const mine=R.pick===s.key,p=R.tot?Math.round((mine?R.same:R.tot-R.same)/R.tot*100):0;return `<span class="res num">${p}%${mine?'<small>내 선택</small>':''}</span>`};
 const side=(cls,s)=>d.kind==='chem'
  ?`<button class="${cls} vsx-c${R&&R.pick===s.key?' on':''}" data-act="vsPick" data-v="${s.key}"${R?' disabled':''}><span class="fc2">${vsFace(s.m.name)}${vsFace(s.f.name)}</span><b class="cn2"><span>${dispHTML(s.m.name)}</span><i>×</i><span>${dispHTML(s.f.name)}</span></b>${res(s)}</button>`
  :`<button class="${cls}${R&&R.pick===s.key?' on':''}" data-act="vsPick" data-v="${s.key}"${R?' disabled':''}><small class="vsx-lab">${s.lab}</small>${vsFace(s.n)}<b>${dispHTML(s.n)}</b>${res(s)}</button>`;
 const msg=R?(R.bad?'둘 다 별로라고 남겼어요. 후보를 바꿀 때 참고할게요':`광장에서 ${R.tot}명이 이 대결을 골랐어요. 공식 표와는 별개로 VS 기록에 쌓여요`):(d.kind==='chem'?'두 사람 조합만 보고 골라 주세요. 커플 리포트에 반영돼요':'원작 그대로가 좋은지, 새 얼굴이 좋은지 골라 주세요');
 box.innerHTML=`<div class="duel vsx">${head}<div class="vs">${side('side-a',L)}<div class="vsmid">VS<small class="dround">${d.kind==='chem'?'케미':'원작'}</small></div>${side('side-b',Rt)}</div><div class="dft"><span>${msg}</span><span style="display:flex;gap:6px;align-items:center">${STREAK?`<span class="num">연속 ${STREAK}판</span>`:''}${R?'':'<button class="chip" data-act="vsBad">둘 다 별로</button>'}<button class="chip" data-act="vsNext">${R?'다음 대결':'건너뛰기'}</button></span></div></div>`}

async function vsNext(){if(DUEL&&DUEL.kind&&!DUEL.res){VS_SKIP.push(DUEL.pk);vsSaveSkip()}DUEL=null;await newDuel(false);renderDuel()}
async function vsPick(key,bad){const d=DUEL;if(!d||!d.kind||d.res)return;const ms=performance.now()-(d.t0||0);
 const [A,B]=vsSides(),me=bad?null:(A.key===key?A:B),other=bad?null:(me===A?B:A);
 const m={w:me?me.w:null,l:other?other.w:null,flip:d.flip};if(d.kind==='chem')Object.assign(m,{rm:d.rm.id,rf:d.rf.id});else Object.assign(m,{orig:d.orig,c:d.c.id});
 d.res={pick:key,bad:!!bad,same:0,tot:0};VS_SKIP.push(d.pk);vsSaveSkip();if(!bad)STREAK++;renderDuel();
 const r=await vsLog(d.kind,{tid:d.tid,rid:d.kind==='orig'?d.rid:null,w:d.kind==='orig'&&key==='new'?d.c.id:null,bad,ms,pk:d.pk,m});
 if(r&&DUEL===d){d.res.same=+r.same||0;d.res.tot=+r.tot||0;if(!bad&&!d.res.tot){d.res.same=1;d.res.tot=1}renderDuel()}
 track&&track('vs_pick',{t:d.tid,r:d.rid||null,ms,m:{k:d.kind,v:bad?'bad':key}});
 setTimeout(()=>{if(DUEL===d)vsNext()},bad?900:1800)}

document.addEventListener('click',e=>{const b=e.target.closest('[data-act="vsPick"],[data-act="vsBad"],[data-act="vsNext"],[data-act="vsHere"]');if(!b)return;e.preventDefault();const a=b.dataset.act;
 if(a==='vsPick')vsPick(b.dataset.v,false);else if(a==='vsBad')vsPick(null,true);else if(a==='vsNext')vsNext();
 else if(a==='vsHere'){DUEL=null;try{track('vs_from_topic',{t:SEL})}catch(x){}location.hash='#vs'}});

/* ---- VS 레이팅: 작품 페이지 투표 탭에 득표 순위와 함께 ---- */
function vsTag(c){const v=VSR[c.candidate_id];return v?`, VS ${v.rk}위`:''}
async function vsLoadRatings(){const tid=SEL;if(!tid)return;const rows=await rpc('vs_ratings',{tid}).catch(()=>null);if(!rows||SEL!==tid)return;
 for(const r of rows)VSR[r.cand_id]={rk:r.rk,n:r.n,w:r.w,rid:r.role_id};if(D&&D.tid===tid){try{renderRoles()}catch(e){}}vsHereRender()}
function vsHereRender(){const box=$('#vsHere');if(!box||!D)return;const t=topic(),open=t&&isOpen(t);
 const sur=[];for(const r of (D.roles||[])){const cs=(D.cands[r.id]||[]).filter(c=>VSR[c.candidate_id]);if(cs.length<2)continue;
  if(open&&!D.myVote[r.id])continue;const v1=cs.find(c=>VSR[c.candidate_id].rk===1);if(!v1)continue;const all=D.cands[r.id]||[],rank=1+all.filter(x=>x.votes>v1.votes).length;if(rank>1)sur.push({r,c:v1,rank})}
 box.innerHTML=`<div class="vsh"><div><b>⚡ VS 한판</b><span>${sur.length?sur.slice(0,2).map(x=>`${esc(x.r.ch.replace(/\s*\(.*\)$/,''))} 역 의외의 강자 <em>${dispHTML(x.c.name)}</em>: 득표 ${x.rank}위, VS 1위`).join('<br>'):'둘씩 붙여 보면 득표로는 안 보이는 순위가 나와요. 공식 표에는 반영되지 않아요'}</span></div>${open?'<button class="b sm" data-act="vsHere">이 작품으로 VS 한판</button>':''}</div>`}
const _vsLoadTopic=loadTopic;loadTopic=async function(){const r=await _vsLoadTopic.apply(this,arguments);vsHereRender();vsLoadRatings();return r};

/* ================= VS 한판 확정 디자인(11/24) =================
   두 얼굴을 사선으로 나눠 겹치고(눈 위치를 맞춘 정렬), 평소엔 흑백. 탭하면 고른 쪽이 중심선에서 상대 쪽으로 밀어내며
   나머지 반쪽 얼굴을 드러냄(상대는 가장자리에 흑백으로 남아 바꿔 탭 가능). 같은 쪽을 한 번 더 탭하면 확정.
   다음 대결은 vs_pair가 고름: 한 배역 연달아 2판(작품에서 들어오면 3판)까지, 정보가 필요한 조합 먼저, 수집 끝난 조합과 이미 고른 조합은 빼고 */
var VSF_ROLE=null,VSF_RUN=0,VSF_INK='',VSF_EMPTY=false,VSF_FROMT=false;
function vsfAvoid(){return VSF_ROLE&&VSF_RUN>=(VSF_FROMT?3:2)?[VSF_ROLE]:[]}
const _vsfNew=newDuel;
newDuel=async function(first){if(duelLoading)return;duelLoading=true;try{
 if(await vsTrySpecial(first))return;
 const t=topic(),pf=(curView()==='topic'||curView()==='page')&&t?t.id:(VSF_FROMT&&DUEL&&DUEL.tid)||null;
 const p=await rpc('vs_pair',{s:SID||'',prefer:pf,avoid:vsfAvoid()}).catch(()=>null);
 if(!p||!p.a||!p.b){DUEL=null;VSF_EMPTY=true;return}
 VSF_EMPTY=false;if(p.rid===VSF_ROLE)VSF_RUN++;else{VSF_ROLE=p.rid;VSF_RUN=1}
 await duelImgs([p.a.name,p.b.name]);
 DUEL=Object.assign({vsf:true,hi:null,res:null,t0:performance.now()},p);track&&track('duel_start',{t:p.tid,r:p.rid})
}finally{duelLoading=false}};
const _vsfRender=renderDuel;
renderDuel=function(){const box=$('#duel');if(!box)return;
 if(DUEL&&DUEL.vsf)return vsfRender(box);
 if(!DUEL&&VSF_EMPTY&&!duelLoading){box.innerHTML='<div class="vsf vsf-empty"><b>지금 열린 대결을 모두 골랐어요</b><span>새 판이 열리거나 후보가 늘면 다시 대결이 생겨요</span></div>';return}
 return _vsfRender()};
function vsfAl(n,W,H){const a=AMF[n];if(!a||!a.f||!a.p)return '';const f=a.f,iw=500,ih=750,pad=40,k=(f[2]+f[3])/2;if(k<.09)return '';
 const s=(H*.215)/(k*ih),bw=iw*s,ex=W/2,ey=H*.41,x=ex+pad-f[0]*iw*s,y=ey+pad-f[1]*ih*s;
 return `top:-${pad}px;left:-${pad}px;right:-${pad}px;bottom:-${pad}px;background-image:url('https://image.tmdb.org/t/p/w500${esc(a.p)}');background-size:${Math.round(bw)}px auto;background-position:${Math.round(x)}px ${Math.round(y)}px;transform-origin:${Math.round(ex+pad)}px ${Math.round(ey+pad)}px;transform:rotate(${-f[5]}deg)`}
function vsfPh(n,W,H){const al=vsfAl(n,W,H),a0=AMF[n];if(al)return `<span class="ph bgc" style="background-image:url('https://image.tmdb.org/t/p/w185${esc(a0.p)}')"></span><span class="ph al" style="${al}"></span>`;const a=AMF[n],u=a&&a.p?'https://image.tmdb.org/t/p/w500'+a.p:IMG['p:'+n];return `<span class="ph"${u?` style="background-image:url('${esc(u)}')"`:''}></span>`}
function vsfNm(n){const d=dispName(n),m=d.match(/^(.*?)\s*\(([^()]*)\)$/);return m?`<b>${esc(m[1])}</b><em>${esc(m[2])}</em>`:`<b>${esc(d)}</b>`}
function vsfRender(box){const d=DUEL,W=box.clientWidth||360,H=Math.max(400,Math.min(innerHeight-250,760)),R=d.res,h=d.hi,ver=verLabel(d.cat);
 const cls=k=>R?(R.k===k?'win':'lose'):h?(h===k?'hi':'dim'):'idle';
 const ik=d.pk+':'+d.t0,intro=!h&&!R&&VSF_INK!==ik;if(intro)VSF_INK=ik;
 const pct=k=>Math.round((k==='a'?R.pa:1-R.pa)*100);
 const half=(k,c,pos)=>`<button class="${pos} ${cls(k)}" data-act="vsf" data-v="${k}" aria-label="${esc(dispName(c.name))} 고르기">${vsfPh(c.name,W,H)}<span class="hl"></span><span class="nm">${vsfNm(c.name)}${R&&R.k===k&&R.n>1?`<span class="pct">${pct(k)}%</span>`:''}</span>${h===k&&!R?'<span class="ask2"><b>한 번 더 탭하면 확정</b></span>':''}${R&&R.k===k?'<span class="cast2">CAST!</span>':''}</button>`;
 box.innerHTML=`<div class="vsf"><div class="vsf-hd"><a href="#${esc(d.tid)}">${esc(d.title)}${ver?' '+esc(ver):''}</a><b>${esc(String(d.ch).replace(/\s*\(.*\)$/,''))} 역은 누구?</b></div>
<div class="fight${intro?' intro':''}" style="height:${H}px">${half('a',d.a,'l')}${half('b',d.b,'r')}<span class="vsb">VS</span><span class="wl"></span></div>
<div class="vsf-ft"><span>${R&&R.n>1?`광장 ${R.n}명의 선택`:''}</span><span class="stk">연속 <b>${STREAK}</b>판</span></div>
<div class="vsf-links">${R?'':'<button data-act="vsfBad">둘 다 별로</button><button data-act="vsfSkip">다른 대결</button>'}</div></div>`}
function vsfNext(d,ms){setTimeout(()=>{if(DUEL===d){DUEL=null;newDuel(false).then(()=>renderDuel())}},ms)}
async function vsfCast(d,k){const w=k==='a'?d.a:d.b,l=k==='a'?d.b:d.a,guest=!USER||!PROF,ms=performance.now()-d.t0;
 d.res={k,pa:k==='a'?1:0,n:0};STREAK++;renderDuel();
 const lp=vsLog('role',{tid:d.tid,rid:d.rid,w:w.candidate_id,l:l.candidate_id,ms,pk:d.pk,m:{v:'vsf',n:d.n}});
 if(guest){GUEST++;try{localStorage.setItem('guestDuels',GUEST)}catch(e){}}else rpc('duel_vote',{rid:d.rid,x:d.a.candidate_id,y:d.b.candidate_id,win:w.candidate_id}).then(()=>loadProfile().then(renderWho)).catch(()=>null);
 try{const r=await lp;if(r&&+r.tot>0&&DUEL===d){const s=+r.same/(+r.tot);d.res.pa=k==='a'?s:1-s;d.res.n=+r.tot;renderDuel()}}catch(e){}
 track&&track('duel_pick',{t:d.tid,r:d.rid,ms});vsfNext(d,1700)}
document.addEventListener('click',e=>{const d=DUEL;if(!d||!d.vsf)return;const b=e.target.closest('[data-act="vsf"],[data-act="vsfBad"],[data-act="vsfSkip"]');
 if(!b){if(d.hi&&!d.res&&e.target.closest('#duel')){d.hi=null;renderDuel()}return}
 e.preventDefault();if(d.res)return;const a=b.dataset.act;
 if(a==='vsfSkip'){track&&track('duel_skip',{t:d.tid,r:d.rid});DUEL=null;newDuel(false).then(()=>renderDuel());return}
 if(a==='vsfBad'){d.res={bad:true};vsLog('role',{tid:d.tid,rid:d.rid,bad:true,ms:performance.now()-d.t0,pk:d.pk,m:{v:'vsf',a:d.a.candidate_id,b:d.b.candidate_id}});renderDuel();vsfNext(d,500);return}
 const k=b.dataset.v;if(d.hi!==k){d.hi=k;renderDuel();return}vsfCast(d,k)});
/* 작품 페이지의 '이 작품으로 VS 한판'으로 들어오면 그 작품 대결을 3판까지 이어서 */
document.addEventListener('click',e=>{if(e.target.closest('[data-act="vsHere"]')){VSF_FROMT=true;VSF_ROLE=null;VSF_RUN=0}},true);
