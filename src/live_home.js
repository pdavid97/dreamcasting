/* ================= 광장 투표 화면 확정 디자인(C안, 11/24) =================
   네온 라임과 검정. 위쪽 한 줄 소식 레일(마감, 뉴스, 토론, VS, 누르면 바로 이동), 한 줄 제목 "OO 역은 누구?",
   후보 카드를 부채꼴(아크)로 펼쳐 가운데 카드가 살짝 올라옴. 옆으로 넘겨 고르고, 가운데 카드를 탭하면 "한 표 확정?",
   한 번 더 탭하면 CAST 도장과 함께 나머지 카드가 흩어지고 표가 들어감. 맨 아래에 토론 공감 1위 한 줄 */
var HC={sel:0,confirm:false,voted:false,key:'',ri:0,timer:null},HCQ={};
function hcCands(r){return (r.cands||[]).slice(0,10)}
function hcImg(n){const a=AMF[n];return a&&a.p?'https://image.tmdb.org/t/p/w500'+a.p:(IMG['p:'+n]||'')}
function hcClose(t){const x=roundLeft(t),m=x.match(/D-\d+/);return m?m[0]:/오늘/.test(x)?'D-0':x}
function hcRailItems(t,r){const it=[],n=(t.news||[])[0],q=HCQ[t.id];
 it.push({tg:'마감',tx:`${String(r.ch).replace(/\s*\(.*\)$/,'')} 역 투표 ${roundLeft(t)}`,href:'#'+t.id});
 if(n&&n.u)it.push({tg:'뉴스',tx:String(n.t||'').replace(/\s-\s[^-]+$/,''),href:goURL(t.id,'news','news',n.u),ext:1});
 if(q)it.push({tg:'토론',tx:`"${q.body}" 공감 ${q.up}`,href:'#'+t.id});
 it.push({tg:'VS',tx:`${String(r.ch).replace(/\s*\(.*\)$/,'')} 역 1:1 대결이 열려 있어요`,href:'#vs'});
 const now=Date.now(),bio=(TOPICS||[]).find(x=>x.cat==='bio'&&!x.closed_at&&(!x.opens_at||Date.parse(x.opens_at)<=now)&&Date.parse(x.closes_at)>now&&x.id!==t.id);
 if(bio){const br=(bio.roles||[])[0];it.splice(1,0,{tg:'실화',tx:`${bio.title}${br?`, ${String(br.ch).replace(/\s*\(.*\)$/,'')} 역은 누구?`:''}`,href:'#'+bio.id})}
 return it}
function hcRail(t,r){const it=hcRailItems(t,r),x=it[HC.ri%it.length];return `<a class="hc-rail" href="${esc(x.href)}"${x.ext?' target="_blank" rel="noopener"':''}><span class="dot"></span><span class="tg">${x.tg}</span><span class="tx">${esc(x.tx)}</span><span class="ar">›</span></a>`}
function hcTf(i,n){let off=i-HC.sel;if(off>n/2)off-=n;if(off<-n/2)off+=n;const on=i===HC.sel;
 return {on,off,tf:on?(HC.voted?'translateY(4px) scale(1.06)':'translateY(-10px) scale(1)'):`rotate(${off*9}deg) translateY(${Math.abs(off)*3}px) scale(.9)`,z:20-Math.abs(off)}}
function hcHint(r,cs){const c=cs[HC.sel];if(HC.voted)return `${esc(dispName(c.name))}에게 한 표를 던졌어요`;if(r.mine)return '이 배역은 이미 투표했어요. 다음 배역으로 넘어가요';return ''}
function hcSub(c,r,tot){const parts=[];const ag=typeof ageTxt==='function'?ageTxt(c.name):'';if(ag)parts.push(ag);if(r.mine&&tot)parts.push(`득표 ${Math.round((c.votes||0)/tot*100)}%`);
 const rc=c.blurb&&c.blurb.recent?`최근작 《${c.blurb.recent.t}》`:'';if(rc)parts.push(rc);return parts.join(', ')}
async function hcLoadQuote(tid){if(tid in HCQ)return;HCQ[tid]=null;try{const {data}=await sb.from('v_thread').select('body,up').eq('topic_id',tid).order('up',{ascending:false}).limit(1);const q=data&&data[0];if(q&&q.up>0){HCQ[tid]=q;const t=curTopic();if(t&&t.id===tid){const d=$('#hcDock');if(d)d.innerHTML=hcQuote(t)}}}catch(e){}}
function hcQuote(t){const q=HCQ[t.id];return q?`<a class="hc-quote" href="#${esc(t.id)}"><span class="lb">공감 1위</span><p>${esc(q.body)}</p><b class="hrt">♥ ${q.up}</b></a>`:''}
function renderDeckC(box,t,r){const cs=hcCands(r),n=cs.length,tot=r.cands.reduce((a,c)=>a+(c.votes||0),0),key=t.id+'|'+r.id;
 if(HC.key!==key){HC.key=key;HC.confirm=false;HC.voted=false;const p=pend().find(x=>x.rid===r.id),picked=r.mine||(p&&p.cid);HC.sel=Math.max(0,cs.findIndex(c=>c.id===picked))}
 const ch=Math.max(230,Math.min(440,innerHeight-475)),cw=Math.round(Math.min(ch*.66,(box.clientWidth||innerWidth)*.6)),ver=verLabel(t.cat)||'';
 const cards=cs.map((c,i)=>{const tf=hcTf(i,n),u=hcImg(c.name);return `<button class="card${tf.on?' on':''}" data-hc="${i}" aria-label="${esc(dispName(c.name))}" style="transform:${tf.tf};z-index:${tf.z}"><span class="ph"${u?` style="background-image:url('${esc(u)}')"`:''}>${u?'':esc(c.name[0])}</span><span class="no">${String(i+1).padStart(2,'0')}</span><span class="nm"><b>${dispHTML(c.name)}</b><small>${esc(hcSub(c,r,tot))}</small></span></button>`}).join('');
 box.innerHTML=`<div class="hc" style="--ch:${ch}px;--cw:${cw}px">${todoRow()}${hcRail(t,r)}
<div class="hc-hd"><div><a class="hc-ti" href="#${esc(t.id)}" aria-label="${esc(t.title)} 작품과 후보 전체 보기">${esc(t.title)}${ver?' '+esc(ver):''}${t.season>1?`, 시즌 ${t.season}`:''}<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg></a><h1>${esc(String(r.ch).replace(/\s*\(.*\)$/,''))} 역은 <em>누구?</em></h1></div><div class="clk">${hcClose(t)}<small>배역 ${Math.min(DR+1,t.roles.length)}/${t.roles.length}</small><span class="steps">${t.roles.map((x,i)=>`<i class="${i<DR?'ok':i===DR?'on':''}"></i>`).join('')}</span></div></div>
<div class="hc-arc${HC.voted?' picked':''}" id="hcArc">${cards}${HC.voted?'<div class="cast">CAST!</div>':''}</div>
<p class="hc-hint" id="hcHint">${hcHint(r,cs)}</p>
<div class="hc-bar${DR<t.roles.length-1?'':' two'}">${DR<t.roles.length-1?`<button class="hb" data-act="dk-skip" aria-label="이 배역은 건너뛰고 같은 작품의 다음 배역으로">다음 배역</button>`:''}<button class="hb main" data-act="hc-add" data-rid="${r.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>후보 추가</button><button class="hb" data-act="dk-nexttopic">${DECK[DI+1]?'다음 작품':'작품 넘기기'}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div></div>`;
 hcUpdate();hcLoadQuote(t.id);hcTodoFocus();
 clearInterval(HC.timer);HC.timer=setInterval(()=>{const el=document.querySelector('.hc-rail');const t2=curTopic(),r2=curRole();if(!el||!t2||!r2||!DECKV){clearInterval(HC.timer);return}HC.ri++;el.outerHTML=hcRail(t2,r2)},3600)}
function hcUpdate(){const arc=$('#hcArc'),t=curTopic(),r=curRole();if(!arc||!r)return;const cs=hcCands(r),n=cs.length;
 arc.classList.toggle('picked',HC.voted);
 arc.querySelectorAll('.card').forEach(el=>{const i=+el.dataset.hc,tf=hcTf(i,n);
  if(HC.voted&&!tf.on&&!el.classList.contains('fly')){hcFlutter(el,tf.off);return}
  if(!HC.voted&&el.classList.contains('fly')){el.classList.remove('fly');(el.getAnimations?el.getAnimations():[]).forEach(x=>x.cancel())}if(el.classList.contains('fly'))return;el.style.transform=tf.tf;el.style.zIndex=tf.z;el.style.transitionDelay=HC.voted&&!tf.on?Math.abs(tf.off)*60+'ms':'0ms';el.classList.toggle('on',tf.on);el.classList.toggle('ask-on',tf.on&&HC.confirm);
  const a=el.querySelector('.ask');if(tf.on&&HC.confirm&&!a)el.insertAdjacentHTML('beforeend','<span class="ask"><b>한 표 확정?</b><small>한 번 더 탭</small></span>');if((!tf.on||!HC.confirm)&&a)a.remove()});
 if(HC.voted&&!arc.querySelector('.cast'))arc.insertAdjacentHTML('beforeend','<div class="cast">CAST!</div>');
 const h=$('#hcHint');if(h)h.innerHTML=hcHint(r,cs)}
function hcMove(k){const r=curRole();if(!r||HC.voted)return;const n=hcCands(r).length;HC.confirm=false;HC.sel=(HC.sel+k+n)%n;hcUpdate();try{navigator.vibrate&&navigator.vibrate(5)}catch(e){}}
async function hcTap(i){const t=curTopic(),r=curRole();if(!t||!r||HC.voted)return;const cs=hcCands(r);
 if(r.mine){toast('이 배역은 이미 투표했어요');nextRole();return}
 if(i!==HC.sel){HC.confirm=false;HC.sel=i;hcUpdate();return}
 if(!HC.confirm){HC.confirm=true;try{navigator.vibrate&&navigator.vibrate(8)}catch(e){}hcUpdate();track('cand_focus',{t:t.id,r:r.id,c:cs[i].id});return}
 HC.confirm=false;HC.voted=true;try{navigator.vibrate&&navigator.vibrate([12,40,24])}catch(e){}hcUpdate();
 const key=HC.key;setTimeout(()=>{if(HC.key===key)deckPick(r.id,cs[i].id)},1100)}
const _hcRender=renderDeck;
renderDeck=function(){const box=$('#deck');if(!box||!DECKV)return _hcRender();const t=curTopic();
 if(!DECK.length||!t||DR>=t.roles.length)return _hcRender();
 cardLeave();const r=t.roles[DR];renderDeckC(box,t,r);cardAt=performance.now();cardKey=t.id+'|'+r.id};
/* 카드 넘기기(스와이프, 화살표)와 탭 */
let HCX=null;
document.addEventListener('pointerdown',e=>{if(e.target.closest('#hcArc'))HCX=e.clientX});
document.addEventListener('pointerup',e=>{if(HCX==null)return;const dx=e.clientX-HCX;HCX=null;if(Math.abs(dx)>40){hcMove(dx<0?1:-1);HC.swiped=Date.now()}});
document.addEventListener('click',e=>{if(!$('#hcArc'))return;const c=e.target.closest('#hcArc .card');
 if(c){e.preventDefault();if(HC.swiped&&Date.now()-HC.swiped<300)return;hcTap(+c.dataset.hc);return}
 if(HC.confirm&&e.target.closest('.hc')&&!e.target.closest('a,button')){HC.confirm=false;hcUpdate()}});
document.addEventListener('keydown',e=>{if(!$('#hcArc')||/INPUT|TEXTAREA/.test(document.activeElement&&document.activeElement.tagName))return;if(e.key==='ArrowRight')hcMove(1);else if(e.key==='ArrowLeft')hcMove(-1);else if(e.key==='Enter')hcTap(HC.sel)});

/* 육각 타일 줄은 왼쪽에서 오른쪽으로 계속 흐름. 손가락을 대면 멈췄다가 떼면 다시 흐름 */
document.addEventListener('pointerdown',e=>{const h=e.target.closest('#hcHex');if(h)h.classList.add('hold')});
document.addEventListener('pointerup',()=>{const h=$('#hcHex');if(h)setTimeout(()=>h.classList.remove('hold'),1200)});

/* ================= 내 캐스팅 완성 리포트(11/24) =================
   1) 원작 포스터처럼 내 픽 배우들을 한 장에 나란히(사진을 나란히 놓을 뿐, 얼굴 합성 없음)
   2) 배역마다 내 픽 득표율, 광장 1위와 득표율
   3) 내 픽과 광장 결과를 비교해 캐스팅 성향 평가(hcType)
   4) 원작 배우와 내 픽 사이 연결고리: 함께 출연한 작품, 나이 차이(cast_links). 소속사는 데이터가 생기면 추가 */
var HCL={};
function hcRoleStat(r){const tot=r.cands.reduce((a,c)=>a+(c.votes||0),0),srt=[...r.cands].sort((a,b)=>(b.votes||0)-(a.votes||0)),top=srt[0],mine=r.cands.find(c=>c.id===r.mine);
 if(!mine)return null;const rank=1+r.cands.filter(c=>(c.votes||0)>(mine.votes||0)).length;
 return {r,mine,top,tot,rank,share:tot?(mine.votes||0)/tot:0,topShare:tot?(top.votes||0)/tot:0,n:r.cands.length}}
/* 성향 평가: 1위와 겹친 비율, 내 픽 평균 득표율, 원작과의 연결고리와 나이 차이로 유형과 한 줄 평을 정함 */
function hcType(S0,links){if(S0.length<2)return null;/* 성향 평가는 2개 이상 배역을 고른 팀 캐스팅에서만 */const S=S0.filter(s=>s.tot>=3),k=S.length;if(!k)return {tag:'선발대 감독',say:'이 판에 거의 처음 표를 던졌어요. 광장 표가 쌓이면 내 픽이 대중픽인지 소신픽인지 드러나요.',badges:[],m1:0,k:0};const m1=S.filter(s=>s.rank===1).length,avg=S.reduce((a,s)=>a+s.share,0)/k,low=S.filter(s=>s.share<.1).length;
 const solo=S.filter(s=>s.rank!==1).map(s=>String(s.r.ch).replace(/\s*\(.*\)$/,''));
 let t;
 if(m1===k)t={tag:'광장 대표 감독',say:k>1?`고른 ${k}개 배역 모두 광장 1위와 같아요. 대중의 마음을 정확히 읽는 흥행 감각이에요.`:'광장 1위와 같은 선택이에요. 대중의 마음을 정확히 읽었어요.'};
 else if(m1===0&&avg<.12)t={tag:'실험실 감독',say:'광장이 거의 고르지 않은 얼굴로만 채웠어요. 아무도 생각 못 한 조합을 밀어붙이는 실험파예요.'};
 else if(m1===0)t={tag:'소신파 감독',say:'1위와 한 번도 겹치지 않았어요. 남의 표보다 내 눈을 믿는 타입이에요.'};
 else if(m1/k>=.5)t={tag:'밸런스 감독',say:`큰 줄기는 광장과 같고, ${solo.slice(0,2).join(', ')} 역만 내 소신대로 골랐어요.`};
 else t={tag:'반전 기획자',say:`광장과 같은 건 ${m1}개뿐이에요. ${solo.slice(0,2).join(', ')} 역에서 판을 뒤집을 카드를 쥐고 있어요.`};
 const badges=[];if(low&&m1)badges.push(`숨은 진주 ${low}명`);
 const L=S.map(s=>links.find(x=>x.cid===s.mine.id)).filter(Boolean);
 const L0=S0.map(s=>links.find(x=>x.cid===s.mine.id)).filter(Boolean),co=L0.filter(x=>(x.works||[]).length).length;if(co)badges.push(`원작 연결고리 ${co}개`);
 const gaps=L0.map(ageGap).filter(g=>g!=null);
 if(gaps.length){const g=Math.round(gaps.reduce((a,b)=>a+b,0)/gaps.length);if(g>=8)badges.push(`세대교체, 원작 당시보다 평균 ${g}살 젊게`);else if(g<=-8)badges.push(`관록 캐스팅, 원작 당시보다 평균 ${-g}살 위`);else if(Math.abs(g)<=3)badges.push('원작 당시와 나이대 비슷')}
 return Object.assign(t,{badges,m1,k})}
// 나이 비교: 원작 배우의 작품 공개 당시 나이 대 내 배우의 지금 나이. 양수면 내 배우가 더 어림. 공개 연도를 모르면 비교하지 않음
function ageGap(){return null}
function hcLinkLines(S,links){const out=[];for(const s of S){const x=links.find(y=>y.cid===s.mine.id);if(!x||!s.r.orig)continue;const nm=dispName(s.mine.name).replace(/\s*\(.*\)$/,''),on=String(s.r.orig);
 const af=(x.aff||[])[0];if(af){out.push(`${esc(nm)}와 원작 ${esc(on)}, 같은 ${af.k==='group'?'그룹':'소속'} ${esc(af.n)} 출신`);continue}
 const ws=x.works||[];if(ws.length){const w=ws[0],same=w.t===curTopic()?.title;out.push(same?`${esc(nm)}, 원작 《${esc(w.t)}》에 ${esc(on)}와 함께 출연했어요`:`${esc(nm)}와 원작 ${esc(on)}, 《${esc(w.t)}》${w.y?`(${w.y})`:''}에서 함께 출연`)}
 else{const g=ageGap(x);if(g!=null){const a=new Date().getFullYear()-x.cb,oa=x.oy-x.ob;out.push(Math.abs(g)<=1?`${esc(nm)}, 지금 ${a}살로 원작 당시 ${esc(on)}(${oa}살)와 비슷해요`:`${esc(nm)}, 지금 ${a}살로 원작 당시 ${esc(on)}(${oa}살)보다 ${Math.abs(g)}살 ${g>0?'어려요':'많아요'}`)}}}
 return out.slice(0,4)}
// 원작 패널: 자동 선택된 단체 사진(없으면 원작 포스터). 얼굴들이 모인 가운데로 맞춰 자름
function oartBg(t){const a=t.oart,u=a&&a.url||t.vposter||t.poster;if(!u)return '';let pos='center 20%';
 if(a&&a.faces&&a.faces.length){const F=a.faces;if(a.w>a.h)return ` style="background-image:url('${esc(u)}');background-position:center"`;const cx=F.reduce((s,f)=>s+f[0]+f[2]/2,0)/F.length,cy=F.reduce((s,f)=>s+f[1]+f[3]/2,0)/F.length;pos=`${Math.round(cx*100)}% ${Math.round(Math.min(.6,cy)*100)}%`}
 return ` style="background-image:url('${esc(u)}');background-position:${pos}"`}
async function renderDoneC(box,t){track('result_view',{t:t.id});
 const S=t.roles.map(hcRoleStat).filter(Boolean),ver=verLabel(t.cat)||'';
 if(!(t.id in HCL)){HCL[t.id]=null;rpc('cast_links',{tid:t.id}).then(x=>{HCL[t.id]=x||[];const c=curTopic();if(c&&c.id===t.id&&DR>=c.roles.length)renderDeck()}).catch(()=>{HCL[t.id]=[]})}
 const links=HCL[t.id]||[],ty=hcType(S,links),ll=hcLinkLines(S,links);
 const strips=S.map((s,i)=>{const u=hcImg(s.mine.name);return `<span class="mp-s" style="--i:${i};${u?`background-image:url('${esc(u)}')`:''}"></span>`}).join('');
 box.innerHTML=`<div class="hc hcd">${todoRow()}
<div class="mp2${t.oart&&t.oart.w>t.oart.h?' wide':''}"><div class="mp-o"${oartBg(t)}><span class="lb">원작</span></div><div class="mp-m"><div class="mp-row" style="--n:${Math.max(1,S.length)}">${strips||'<span class="mp-empty">아직 고른 배역이 없어요</span>'}</div><span class="lb on">내 캐스팅</span></div></div>
<div class="mp-tt"><b>${esc(t.title)}</b><span>${ver?esc(ver)+', ':''}${S.map(s=>esc(dispName(s.mine.name).replace(/\s*\(.*\)$/,''))).join(', ')}</span></div>
${ty?`<div class="mp-type"><span class="tg">${esc(ty.tag)}</span><p>${esc(ty.say)}</p>${ty.badges.length?`<div class="bd">${ty.badges.map(b=>`<i>${esc(b)}</i>`).join('')}</div>`:''}</div>`:''}
<div class="mp-roles">${t.roles.map(r=>{const s=S.find(x=>x.r===r);if(!s)return `<div class="mr skip"><span class="ch">${esc(String(r.ch).replace(/\s*\(.*\)$/,''))}</span><span class="pk">건너뜀</span></div>`;
 const same=s.tot>0&&s.rank===1,u=hcImg(s.mine.name);return `<div class="mr${same?' same':''}"><span class="ph"${u?` style="background-image:url('${esc(u)}')"`:''}></span><div class="tx"><span class="ch">${esc(SLOT[r.slot]||'')} ${esc(String(r.ch).replace(/\s*\(.*\)$/,''))}${r.orig?`<em>원작 ${esc(r.orig)}</em>`:''}</span><b>${dispHTML(s.mine.name)}</b><small>${!s.tot?'아직 광장 표가 없어요':same?'광장 1위와 같은 선택':`광장 1위 ${esc(dispName(s.top.name).replace(/\s*\(.*\)$/,''))} ${Math.round(s.topShare*100)}%`}</small></div><span class="pc"><b>${s.tot?Math.round(s.share*100)+'%':'첫 표'}</b><small>${s.tot?`${s.rank}위 / ${s.n}명`:''}</small></span></div>`}).join('')}</div>
${ll.length?`<div class="mp-links"><b>원작과의 연결고리</b>${ll.map(x=>`<p>${x}</p>`).join('')}</div>`:''}
<div class="mp-n">${S.some(s=>s.tot)?`배역별 총 ${S.map(s=>s.tot).join(', ')}표 기준`:''}</div>
<div class="hc-rel" id="hcRel">${hcRelLocal(t,S)}</div><div class="hc-links"><a href="#${esc(t.id)}/talk">결과와 토론방</a><button data-act="dk-nexttopic">다음 작품</button></div></div>`;hcRelServer(t)}
const _hcRender2=renderDeck;
renderDeck=function(){const box=$('#deck'),t=DECKV&&curTopic();if(box&&t&&DECK.length&&DR>=t.roles.length){cardLeave();return renderDoneC(box,t)}return _hcRender2()};

if(/[?&]test=1/.test(location.search))window.__hcT=f=>f({DECK,setDI:v=>DI=v,setDR:v=>DR=v,renderDeck:()=>renderDeck(),vsLegacy:async()=>{VS_N=8;await vsTrySpecial(false);renderDuel()},addCast:async(nm)=>{nextRole=()=>{};await loadNames([nm]);hcAddCast(curTopic(),curRole().id,999999,nm)}});

/* 이어서 고르기: 리포트 끝에서 다음에 할 일을 이유와 함께 2~3개 추천해 계속 이어지게 */
function hcRelItem(di,x,why,ch){const d=DECK[di],v=verLabel(d.cat),u=d.vposter||d.poster;return `<a class="rl" href="#" data-act="dk-goto" data-i="${di}"><span class="ph"${u?` style="background-image:url('${esc(u)}')"`:''}></span><span class="tx"><b>《${esc(d.title)}》${v?' '+esc(v):''} ${esc(String(ch).replace(/\s*\(.*\)$/,''))} 역</b><small>${why}</small></span><i>›</i></a>`}
function hcRelLocal(t,S){const out=[],used=new Set([t.id]),pd=pend();
 const open=(d,r)=>!r.mine&&!pd.some(p=>p.rid===r.id);
 for(const s of S){if(out.length>=2)break;const nm=s.mine.name;
  for(let i=0;i<DECK.length&&out.length<2;i++){const d=DECK[i];if(used.has(d.id))continue;const r=(d.roles||[]).find(r=>open(d,r)&&(r.cands||[]).some(c=>c.name===nm));
   if(r){used.add(d.id);out.push(hcRelItem(i,d,`내 픽 <em>${esc(dispName(nm).replace(/\s*\(.*\)$/,''))}</em>, 여기서도 후보예요`,r.ch))}}}
 const i2=DECK.findIndex(d=>!used.has(d.id)&&new Date(d.closes_at)-Date.now()<864e5&&new Date(d.closes_at)>Date.now()&&(d.roles||[]).every(r=>open(d,r)));
 if(i2>=0&&out.length<3){used.add(DECK[i2].id);out.push(hcRelItem(i2,DECK[i2],'오늘 마감, 아직 한 표도 안 던졌어요',DECK[i2].roles[0].ch))}
 HC.relUsed=used;return out.length?`<b class="hd">이어서 고르기</b>${out.join('')}`:''}
async function hcRelServer(t){const x=await rpc('duel_next',{skip:[],prefer:t.id}).catch(()=>null);const box=$('#hcRel');if(!x||!x.why||!box||(HC.relUsed&&HC.relUsed.has(x.tid)))return;
 const di=DECK.findIndex(d=>d.id===x.tid);if(di<0)return;const why=esc(x.why.replace(/(\S+)이\(가\)/,(m,n)=>jj(n,'이','가')));
 if(!box.querySelector('.hd'))box.insertAdjacentHTML('afterbegin','<b class="hd">이어서 고르기</b>');box.querySelector('.hd').insertAdjacentHTML('afterend',hcRelItem(di,DECK[di],why,x.ch))}

/* ===== 광장 상단 할 일 줄(11/25): 육각 타일 대신 포스터 원. 투표 중인 판만 마감 순, 테두리 링은 내 진행률, 다 끝낸 판은 뒤로, 발표는 맨 끝 "결과" 하나로 ===== */
function todoRow(){const out=[],pd=pend();
 const items=DECK.map((d,i)=>{const rs=d.roles||[],n=rs.length,m=rs.filter(r=>r.mine||pd.some(p=>p.rid===r.id)).length;return {d,i,n,m,done:n&&m>=n,left:new Date(d.closes_at)-Date.now()}});
 items.sort((a,b)=>(a.done-b.done)||(a.left-b.left));
 for(const x of items){const {d,i,n,m}=x,dd=Math.max(0,Math.ceil(x.left/864e5)),lab=x.left<864e5?'D-0':'D-'+dd,fr=n?m/n:0,u=d.vposter||d.poster||'';
  out.push(`<button class="td${i===DI?' cur':''}${x.done?' done':''}${x.left<864e5?' hot':''}" data-act="dk-goto" data-i="${i}" aria-label="${esc(d.title)}, ${lab}, 배역 ${n}개 중 ${m}개 투표"${i===DI?' aria-current="true"':''}>
   <span class="ring" style="--p:${Math.round(fr*360)}deg"><span class="po"${u?` style="background-image:url('${esc(u)}')"`:''}>${u?'':esc(String(d.title).slice(0,4))}</span>${x.done?'<i class="ck" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg></i>':''}</span>
   <b>${esc(d.title)}</b><small>${x.done?'완료':lab}</small></button>`)}
 const rs=(typeof RB!=='undefined'&&RB.results||[]).filter(r=>Date.now()-new Date(r.at)<2*864e5);
 if(rs.length){const seen=(()=>{try{return JSON.parse(localStorage.getItem('dcResSeen')||'[]')}catch(e){return[]}})(),f=rs.find(r=>!seen.includes(r.tid+':'+r.season))||rs[0];
  out.push(`<button class="td res" data-act="rres" data-t="${esc(f.tid)}" data-s="${f.season}" aria-label="결과 발표 ${rs.length}개 보기"><span class="ring"><span class="po"${f.poster?` style="background-image:url('${esc(f.poster)}')"`:''}></span><i class="tr" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0zM6 5H4a3 3 0 0 0 4 4M18 5h2a3 3 0 0 1-4 4M12 13v4M8 20h8"/></svg></i></span><b>결과 발표</b><small>${rs.length}개</small></button>`)}
 return `<nav class="tdrow" id="tdRow" aria-label="투표 중인 판">${out.join('')}</nav>`}
function hcTodoFocus(){const row=$('#tdRow'),c=row&&row.querySelector('.td.cur');if(!row||!c)return;const x=c.offsetLeft-row.clientWidth/2+c.offsetWidth/2;row.scrollLeft=Math.max(0,x)}
/* 후보 추가 시트: 이름과 한 줄 이유. 등록하면 바로 내 표가 들어감 */
function openHcAdd(rid){const t=curTopic(),r=curRole();if(!t||!r)return;const old=$('#hcAddSheet');if(old)old.remove();
 const el=document.createElement('div');el.id='hcAddSheet';el.className='wsheet';const ch=esc(String(r.ch).replace(/\s*\(.*\)$/,''));
 el.innerHTML=`<div class="ws-in hca" role="dialog" aria-label="${ch} 역 후보 추가"><div class="ws-h"><b>${ch} 역, 내가 미는 배우</b><button class="x" data-act="hca-x" aria-label="닫기">✕</button></div>
 <p class="hca-sub">${esc(t.title)}. 목록에 없는 배우를 올리면 내 한 표가 바로 들어가요.</p>
 <label class="hca-l">배우 이름<input id="dlNew" maxlength="20" autocomplete="off" placeholder="예: 김태리"></label>
 <label class="hca-l">한 줄 이유 (선택)<input id="dlPitch" maxlength="80" placeholder="예: 눈빛이 원작 그대로"></label>
 <button class="hca-go" data-act="hca-go" data-rid="${rid}">후보로 올리고 한 표</button>
 <a class="hca-more" href="#${esc(t.id)}" data-act="hca-x">작품 페이지에서 전체 후보 보기</a></div>`;
 document.body.appendChild(el);requestAnimationFrame(()=>{el.classList.add('on');const i=$('#dlNew');if(i)i.focus()});
 el.addEventListener('click',e=>{if(e.target===el||e.target.closest('[data-act="hca-x"]')){el.classList.remove('on');setTimeout(()=>el.remove(),250)}});
 el.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='dlPitch'){const g=el.querySelector('.hca-go');if(g)g.click()}});
 try{track('hc_add_open',{t:t.id,r:r.id})}catch(x){}}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-act="hc-add"]');if(b){e.preventDefault();openHcAdd(+b.dataset.rid);return}
 const g=e.target.closest('[data-act="hca-go"]');if(!g)return;e.preventDefault();const sh=$('#hcAddSheet'),t=curTopic(),r=curRole(),rid=+g.dataset.rid,nm=($('#dlNew')||{value:''}).value.trim(),pitch=($('#dlPitch')||{value:''}).value.trim();
 if(!nm){toast('배우 이름을 적어 주세요');return}
 if(!USER||!PROF){track('login_prompt',{t:t&&t.id,r:rid,m:{add:true}});if(sh)sh.remove();openLoginSheet();return}
 g.disabled=true;try{const cid=await rpc('add_candidate',{rid,nm,pitch:pitch||null});track('cand_add',{t:t&&t.id,r:rid,c:cid,m:{pitch:!!pitch,from:'bar'}});toast(`${nm} 후보를 올리고 한 표 넣었어요`);if(r&&r.id===rid&&!r.mine)r.mine=cid;
  if(sh){sh.classList.remove('on');setTimeout(()=>sh.remove(),250)}
  const [fresh]=await Promise.all([rpc('vote_deck',{lim:16}).catch(()=>null),(typeof loadNames==='function'?loadNames([nm]).catch(()=>{}):null)]);
  const ft=fresh&&t&&fresh.find(x=>x.id===t.id);if(ft)Object.assign(t,{seen:ft.seen,roles:ft.roles});
  hcAddCast(t,rid,cid,nm)}catch(err){g.disabled=false;toast(errMsg(err))}});
/* 새 후보를 카드 더미 맨 앞에 끼워 넣고, 날아 들어오는 카드에 CAST 도장을 찍은 뒤 다음 배역으로 */
function hcAddCast(t,rid,cid,nm){const r=curRole();if(!r||r.id!==rid||!DECKV||!$('#hcArc')){nextRole();return}
 r.cands=r.cands||[];let c=r.cands.find(x=>x.id===cid);if(!c){c={id:cid,name:nm,votes:1};}r.cands=[c,...r.cands.filter(x=>x.id!==cid)];r.mine=cid;
 HC.key=t.id+'|'+r.id;HC.sel=0;HC.confirm=false;HC.voted=false;renderDeck();
 const el=document.querySelector('#hcArc .card[data-hc="0"]');if(el){el.classList.add('new-in','is-new');el.addEventListener('animationend',ev=>{if(ev.animationName==='hcNewIn')el.classList.remove('new-in')})}
 const h=$('#hcHint');if(h)h.textContent=`${dispName(nm)} 님이 후보로 들어왔어요`;
 const key=HC.key;setTimeout(()=>{if(HC.key!==key)return;HC.voted=true;try{navigator.vibrate&&navigator.vibrate([12,40,24])}catch(e){}hcUpdate();const h2=$('#hcHint');if(h2)h2.textContent=`${dispName(nm)}에게 첫 표를 던졌어요`;
  setTimeout(()=>{if(HC.key===key)nextRole()},1500)},700)}

/* 고르지 않은 카드는 트럼프 카드가 흩날리듯: 살짝 튕겨 오른 뒤 중력으로 가속하며 떨어지고,
   좌우로 흔들리면서 카드 면이 뒤집히듯 펄럭임. 위치를 프레임마다 계산해 Web Animations로 재생(합성 레이어만 써서 끊김 없음) */
function hcFlutter(el,off){el.classList.add('fly');const base=el.style.transform||'',sg=off<0?-1:off>0?1:(Math.random()<.5?-1:1),k=Math.abs(off),R=Math.random;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){el.animate([{opacity:1},{opacity:0}],{duration:300,fill:'forwards'});return}
 const T=1.9+R()*.5,vx=sg*(40+k*22+R()*40),vy=-(170+R()*110),g=950,sw=22+R()*22,sf=.8+R()*.6,ph=R()*6.28,spin=sg*(50+R()*80),flip=0,fr=[],N=48;
 for(let i=0;i<=N;i++){const t=T*i/N,u=i/N,x=vx*t+sw*Math.sin(ph+6.28*sf*t)*Math.min(1,t*2),y=vy*t+.5*g*t*t,rz=spin*t+12*Math.sin(ph+6.28*sf*t),ry=28*Math.sin(ph*1.3+6.28*sf*1.2*t)*Math.min(1,t*3),rx=14*Math.sin(ph+6.28*sf*.9*t)*Math.min(1,t*3);
  fr.push({transform:`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) ${base} rotate(${rz.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg) rotateX(${rx.toFixed(1)}deg)`,opacity:u<.75?1:Math.max(0,1-(u-.75)/.25),offset:u})}
 el.style.transition='none';el.style.filter='brightness(.75)';
 const an=el.animate(fr,{duration:T*1000,delay:k*55+R()*40,easing:'linear',fill:'both'});an.onfinish=()=>{el.style.visibility='hidden'}}
