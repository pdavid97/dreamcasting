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
 it.push({tg:'VS',tx:`${String(r.ch).replace(/\s*\(.*\)$/,'')} 역 1:1 대결이 열려 있어요`,href:'#vs'});return it}
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
 const hx=storyRings();box.innerHTML=`<div class="hc" style="--ch:${ch}px;--cw:${cw}px"><div class="hc-hex" id="hcHex"><div class="hc-hexin">${hx}${hx.replace('<nav class="srow hexrow"','<nav aria-hidden="true" class="srow hexrow"')}</div></div>${hcRail(t,r)}
<div class="hc-hd"><div><button class="hc-wk" data-act="works">작품 ${DI+1}/${DECK.length} <i>▾</i></button><small>${esc(t.title)}${ver?' '+esc(ver):''}${t.season>1?`, 시즌 ${t.season}`:''}</small><h1>${esc(String(r.ch).replace(/\s*\(.*\)$/,''))} 역은 <em>누구?</em></h1></div><div class="clk">${hcClose(t)}<small>마감까지</small><span class="steps">${t.roles.map((x,i)=>`<i class="${i<DR?'ok':i===DR?'on':''}"></i>`).join('')}</span></div></div>
<div class="hc-arc${HC.voted?' picked':''}" id="hcArc">${cards}${HC.voted?'<div class="cast">CAST!</div>':''}</div>
<p class="hc-hint" id="hcHint">${hcHint(r,cs)}</p>
<div class="hc-dock" id="hcDock">${hcQuote(t)}</div>
<div class="hc-links"><button data-act="dk-skip">${DR<t.roles.length-1?'이 배역 패스':'마지막 배역 패스'}</button><a href="#${esc(t.id)}">작품 보기, 후보 추가</a><button data-act="dk-nexttopic">${DECK[DI+1]?'다음 작품':'작품 패스'}</button></div></div>`;
 hcUpdate();hcLoadQuote(t.id);
 clearInterval(HC.timer);HC.timer=setInterval(()=>{const el=document.querySelector('.hc-rail');const t2=curTopic(),r2=curRole();if(!el||!t2||!r2||!DECKV){clearInterval(HC.timer);return}HC.ri++;el.outerHTML=hcRail(t2,r2)},3600)}
function hcUpdate(){const arc=$('#hcArc'),t=curTopic(),r=curRole();if(!arc||!r)return;const cs=hcCands(r),n=cs.length;
 arc.classList.toggle('picked',HC.voted);
 arc.querySelectorAll('.card').forEach(el=>{const i=+el.dataset.hc,tf=hcTf(i,n);el.style.transform=tf.tf;el.style.zIndex=tf.z;el.style.transitionDelay=HC.voted&&!tf.on?Math.abs(tf.off)*60+'ms':'0ms';el.classList.toggle('on',tf.on);el.classList.toggle('ask-on',tf.on&&HC.confirm);
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
function hcType(S0,links){if(!S0.length)return null;const S=S0.filter(s=>s.tot>=3),k=S.length;if(!k)return {tag:'선발대 감독',say:'이 판에 거의 처음 표를 던졌어요. 광장 표가 쌓이면 내 픽이 대중픽인지 소신픽인지 드러나요.',badges:[],m1:0,k:0};const m1=S.filter(s=>s.rank===1).length,avg=S.reduce((a,s)=>a+s.share,0)/k,low=S.filter(s=>s.share<.1).length;
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
 const gaps=L0.filter(x=>x.ob&&x.cb).map(x=>x.cb-x.ob);
 if(gaps.length){const g=Math.round(gaps.reduce((a,b)=>a+b,0)/gaps.length);if(g>=8)badges.push(`세대교체, 원작보다 평균 ${g}살 젊게`);else if(g<=-8)badges.push(`관록 캐스팅, 원작보다 평균 ${-g}살 위`);else if(Math.abs(g)<=3)badges.push('원작과 나이대 거의 같음')}
 return Object.assign(t,{badges,m1,k})}
function hcLinkLines(S,links){const out=[];for(const s of S){const x=links.find(y=>y.cid===s.mine.id);if(!x||!s.r.orig)continue;const nm=dispName(s.mine.name).replace(/\s*\(.*\)$/,''),on=String(s.r.orig);
 const ws=x.works||[];if(ws.length){const w=ws[0],same=w.t===curTopic()?.title;out.push(same?`${esc(nm)}, 원작 《${esc(w.t)}》에 ${esc(on)}와 함께 출연했어요`:`${esc(nm)}와 원작 ${esc(on)}, 《${esc(w.t)}》${w.y?`(${w.y})`:''}에서 함께 출연`)}
 else if(x.ob&&x.cb){const g=x.cb-x.ob;if(Math.abs(g)>=1)out.push(`${esc(nm)}, 원작 ${esc(on)}보다 ${Math.abs(g)}살 ${g>0?'어려요':'많아요'}`)}}
 return out.slice(0,4)}
async function renderDoneC(box,t){track('result_view',{t:t.id});
 const S=t.roles.map(hcRoleStat).filter(Boolean),ver=verLabel(t.cat)||'';
 if(!(t.id in HCL)){HCL[t.id]=null;rpc('cast_links',{tid:t.id}).then(x=>{HCL[t.id]=x||[];const c=curTopic();if(c&&c.id===t.id&&DR>=c.roles.length)renderDeck()}).catch(()=>{HCL[t.id]=[]})}
 const links=HCL[t.id]||[],ty=hcType(S,links),ll=hcLinkLines(S,links),hx=storyRings();
 const strips=S.map((s,i)=>{const u=hcImg(s.mine.name);return `<span class="mp-s" style="--i:${i};${u?`background-image:url('${esc(u)}')`:''}"></span>`}).join('');
 box.innerHTML=`<div class="hc hcd"><div class="hc-hex" id="hcHex"><div class="hc-hexin">${hx}${hx.replace('<nav class="srow hexrow"','<nav aria-hidden="true" class="srow hexrow"')}</div></div>
<div class="mp2"><div class="mp-o"${t.vposter||t.poster?` style="background-image:url('${esc(t.vposter||t.poster)}')"`:''}><span class="lb">원작</span></div><div class="mp-m"><div class="mp-row" style="--n:${Math.max(1,S.length)}">${strips||'<span class="mp-empty">아직 고른 배역이 없어요</span>'}</div><span class="lb on">내 캐스팅</span></div></div>
<div class="mp-tt"><b>${esc(t.title)}</b><span>${ver?esc(ver)+', ':''}${S.map(s=>esc(dispName(s.mine.name).replace(/\s*\(.*\)$/,''))).join(', ')}</span></div>
${ty?`<div class="mp-type"><span class="tg">${esc(ty.tag)}</span><p>${esc(ty.say)}</p>${ty.badges.length?`<div class="bd">${ty.badges.map(b=>`<i>${esc(b)}</i>`).join('')}</div>`:''}</div>`:''}
<div class="mp-roles">${t.roles.map(r=>{const s=S.find(x=>x.r===r);if(!s)return `<div class="mr skip"><span class="ch">${esc(String(r.ch).replace(/\s*\(.*\)$/,''))}</span><span class="pk">건너뜀</span></div>`;
 const same=s.tot>0&&s.rank===1,u=hcImg(s.mine.name);return `<div class="mr${same?' same':''}"><span class="ph"${u?` style="background-image:url('${esc(u)}')"`:''}></span><div class="tx"><span class="ch">${esc(SLOT[r.slot]||'')} ${esc(String(r.ch).replace(/\s*\(.*\)$/,''))}${r.orig?`<em>원작 ${esc(r.orig)}</em>`:''}</span><b>${dispHTML(s.mine.name)}</b><small>${!s.tot?'아직 광장 표가 없어요':same?'광장 1위와 같은 선택':`광장 1위 ${esc(dispName(s.top.name).replace(/\s*\(.*\)$/,''))} ${Math.round(s.topShare*100)}%`}</small></div><span class="pc"><b>${s.tot?Math.round(s.share*100)+'%':'첫 표'}</b><small>${s.tot?`${s.rank}위 / ${s.n}명`:''}</small></span></div>`}).join('')}</div>
${ll.length?`<div class="mp-links"><b>원작과의 연결고리</b>${ll.map(x=>`<p>${x}</p>`).join('')}</div>`:''}
<div class="mp-n">${S.some(s=>s.tot)?`배역별 총 ${S.map(s=>s.tot).join(', ')}표 기준`:''}</div>
<div class="hc-rel" id="hcRel">${hcRelLocal(t,S)}</div><div class="hc-links"><a href="#${esc(t.id)}/talk">결과와 토론방</a><button data-act="dk-nexttopic">다음 작품</button></div></div>`;hcRelServer(t)}
const _hcRender2=renderDeck;
renderDeck=function(){const box=$('#deck'),t=DECKV&&curTopic();if(box&&t&&DECK.length&&DR>=t.roles.length){cardLeave();return renderDoneC(box,t)}return _hcRender2()};

if(/[?&]test=1/.test(location.search))window.__hcT=f=>f({DECK,setDI:v=>DI=v,setDR:v=>DR=v,renderDeck:()=>renderDeck()});

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
