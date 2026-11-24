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
