/* ================= 시네마: 필모그래피 캐러셀, 작품 상세 시트, 컬렉션(나의 시네마 서재) ================= */
let MYCOL=new Set(),MYCOL_AT=0;
async function loadMyCol(force){if(!USER){MYCOL=new Set();return}if(!force&&Date.now()-MYCOL_AT<60000)return;try{const r=await rpc('my_collect_ids',{});MYCOL=new Set(r||[]);MYCOL_AT=Date.now()}catch(e){}}
const colKey=(m,id)=>`${m}:${id}`;
const heartBtn=(m,id,title,year,poster,via)=>`<button class="hrt${MYCOL.has(colKey(m,id))?' on':''}" data-act="collect" data-m="${m}" data-id="${id}" data-t="${esc(title)}" data-y="${esc(year||'')}" data-p="${esc(poster||'')}" data-via="${esc(via||'')}" aria-pressed="${MYCOL.has(colKey(m,id))}" aria-label="${esc(title)} 내 시네마 서재에 담기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.7 1.2 5.3 3 1.6-1.8 3.2-3 5.3-3 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg></button>`;

/* 필모그래피: 스와이프 캐러셀. 카드를 누르면 작품 상세 시트 */
function filmCarousel(works,pid){
 if(!works.length)return '<p class="empty3">출연 기록을 불러오는 중이거나 없어요.</p>';
 const years=[...new Set(works.map(w=>w.year).filter(Boolean))];
 return `<div class="fc" data-pid="${pid}">
  <div class="fc-bar"><span class="fc-cnt"><b class="num" id="fcIdx">1</b> / ${works.length}</span><span class="fc-yr" id="fcYr">${esc(works[0].year||'미정')}</span><span class="fc-nav"><button class="fc-b" data-act="fc-prev" aria-label="이전 작품">‹</button><button class="fc-b" data-act="fc-next" aria-label="다음 작품">›</button></span></div>
  <div class="fc-track" id="fcTrack" tabindex="0" aria-label="필모그래피, 좌우로 넘겨 보기">${works.map((w,i)=>{const m=w.type==='영화'?'movie':'tv';return `<article class="fc-c" data-i="${i}" data-year="${esc(w.year||'미정')}">
   <button class="fc-poster" data-act="wk-open" data-m="${m}" data-id="${w.id}" data-i="${i}" aria-label="${esc(w.title)} 자세히">${w.poster?`<img src="${esc(w.poster)}" alt="" loading="lazy" draggable="false">`:`<span class="np">${esc(w.title.slice(0,8))}</span>`}<span class="fc-yb">${esc(w.year||'미정')}</span></button>
   ${heartBtn(m,w.id,w.title,w.year,w.poster,'person:'+pid)}${PAGE&&PAGE.kind==='a'?`<button class="fc-best${PAGE.fan&&+PAGE.fan.my_best===+w.id?' on':''}" data-act="best" data-i="${i}" aria-label="${esc(w.title)}을 내 인생작으로" title="내 인생작으로">${IC.crown}</button>`:''}
   <b class="fc-t">${esc(w.title)}</b><small class="fc-s">${esc(w.type)}${w.ch?', '+esc(w.ch):''}${w.rating&&w.votes>=20?`, 평점 ${w.rating}`:''}</small></article>`}).join('')}</div>
  <div class="fc-dots" aria-hidden="true">${years.slice(0,12).map(y=>`<button class="fc-y" data-act="fc-year" data-y="${esc(y)}" tabindex="-1">${esc(y)}</button>`).join('')}</div>
 </div>`}
function bindFilmCarousel(){const tr=$('#fcTrack');if(!tr)return;const cards=[...tr.querySelectorAll('.fc-c')];
 const upd=()=>{const mid=tr.scrollLeft+tr.clientWidth/2;let best=0,bd=1e9;cards.forEach((c,i)=>{const d=Math.abs(c.offsetLeft+c.offsetWidth/2-mid);if(d<bd){bd=d;best=i}});cards.forEach((c,i)=>c.classList.toggle('on',i===best));const ix=$('#fcIdx'),yr=$('#fcYr');if(ix)ix.textContent=best+1;if(yr)yr.textContent=cards[best]?cards[best].dataset.year:''};
 tr.addEventListener('scroll',()=>{cancelAnimationFrame(tr._r);tr._r=requestAnimationFrame(upd)},{passive:true});
 tr.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();fcGo(e.key==='ArrowRight'?1:-1)}});
 // 마우스 드래그로도 넘기기
 let x0=null,s0=0,mv=0;tr.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')return;x0=e.clientX;s0=tr.scrollLeft;mv=0;tr.classList.add('drag')});
 addEventListener('pointermove',e=>{if(x0==null)return;mv=Math.abs(e.clientX-x0);tr.scrollLeft=s0-(e.clientX-x0)});
 addEventListener('pointerup',()=>{if(x0==null)return;x0=null;tr.classList.remove('drag');if(mv>6){tr._drag=Date.now();fcGo(0)}});
 upd()}
function fcGo(d){const tr=$('#fcTrack');if(!tr)return;const cards=[...tr.querySelectorAll('.fc-c')];const cur=Math.max(0,cards.findIndex(c=>c.classList.contains('on')));const n=Math.min(cards.length-1,Math.max(0,cur+d));const c=cards[n];if(c)tr.scrollTo({left:c.offsetLeft-(tr.clientWidth-c.offsetWidth)/2,behavior:'smooth'})}

/* 작품 상세 시트 */
let WK=null;
async function openWork(m,id,i){if(!$('#wkModal')){const d=document.createElement('div');d.className='modal wkm';d.id='wkModal';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.innerHTML='<div class="wk" id="wkBox"></div>';document.body.appendChild(d);d.addEventListener('click',e=>{if(e.target===d)closeWork()})}
 $('#wkModal').classList.add('on');$('#wkBox').innerHTML='<p class="dl" style="padding:24px">작품 정보를 불러오는 중이에요</p>';track('work_open',{m:{media:m,id}});
 try{const r=await fetch(SB_URL+'/functions/v1/wdetail',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ANON,apikey:ANON},body:JSON.stringify({media:m,id})});const d=await r.json();if(!r.ok||d.error)throw new Error(d.error||'불러오지 못했어요');WK={...d,i};renderWork()}catch(e){$('#wkBox').innerHTML=`<p class="dl" style="padding:24px">${esc(errMsg(e))}</p><button class="b sm" data-act="wk-close">닫기</button>`}}
function closeWork(){const m=$('#wkModal');if(m)m.classList.remove('on');WK=null}
function renderWork(){const d=WK;if(!d)return;const box=$('#wkBox');
 const fw=PAGE&&PAGE.works&&d.i!=null?PAGE.works[d.i]:null,aired=fw&&fw.year&&+fw.year<=NOW_Y;
 const DIR={kr2us:'할리우드판',us2kr:'한국판',kr2cn:'중국판',cn2kr:'한국판',us2cn:'중국판',cn2us:'할리우드판',kr2tw:'대만판',tw2kr:'한국판',kr2hk:'홍콩판',hk2kr:'한국판',us2tw:'대만판',us2hk:'홍콩판',hk2us:'할리우드판'};
 box.innerHTML=`<div class="wk-hero"${d.backdrop?` style="background-image:url('${esc(d.backdrop)}')"`:''}><button class="wk-x" data-act="wk-close" aria-label="닫기">×</button></div>
 <div class="wk-top">${d.poster?`<img class="wk-p" src="${esc(d.poster)}" alt="">`:''}<div><h3>${esc(d.title)}</h3><small>${esc(d.media==='movie'?'영화':'드라마')} ${esc(d.year||'')}${d.genres&&d.genres.length?', '+esc(d.genres.slice(0,3).join(', ')):''}${d.votes>=20?`, 평점 ${d.rating}`:''}</small><div class="wk-acts">${heartBtn(d.media,d.id,d.title,d.year,d.poster,'work')}<span class="sub">내 시네마 서재에 담기</span></div></div></div>
 ${(()=>{const pf=fw&&typeof perfOf==='function'?perfOf(PAGE.pid,fw):null;return pf&&pf.n?`<p class="wk-ps">광장 연기 점수 <b class="num">${pf.avg}</b>, ${fmt(pf.n)}명 평가${fw.ch?`, ${esc(fw.ch)} 역`:''}</p>`:''})()}
 ${d.overview?`<p class="wk-ov">${esc(d.overview)}</p>`:''}
 ${d.topics.length?`<div class="wk-sec"><b>광장에서 투표 중</b>${d.topics.map(t=>`<a class="wk-chip hot" href="#${esc(t.id)}" data-act="wk-go">${esc((CATS.find(c=>c.id===t.cat)||{}).name||'')} ${esc(t.title)} 가상 캐스팅</a>`).join('')}</div>`:''}
 ${(d.remakes.length||d.origins.length)?`<div class="wk-sec"><b>리메이크 계보</b>${d.origins.map(o=>o.src?`<button class="wk-chip" data-act="wk-open" data-m="${o.src.media}" data-id="${o.src.tmdb_id}">원작 ${esc(o.src.title)} (${o.src.year||''})</button>`:'').join('')}${d.remakes.map(o=>o.dst?`<button class="wk-chip" data-act="wk-open" data-m="${o.dst.media}" data-id="${o.dst.tmdb_id}">${esc(DIR[o.direction]||'리메이크')} ${esc(o.dst.title)} (${o.dst.year||''})</button>`:'').join('')}</div>`:''}
 <div class="wk-sec"><b>주요 출연진</b><div class="wk-cast">${d.cast.map(c=>`<a class="wk-pc" href="#a/${encodeURIComponent(c.name)}" data-act="wk-go"><span class="ph"${c.photo?` style="background-image:url('${esc(c.photo)}')"`:''}>${c.photo?'':esc(c.name[0]||'')}</span><b>${esc(c.name)}</b><small>${esc(c.ch||'')}</small></a>`).join('')}</div></div>
 ${d.races.length?`<div class="wk-sec"><b>이 출연진이 후보로 오른 가상 캐스팅</b>${d.races.slice(0,8).map(r=>`<a class="wk-chip" href="#${esc(r.tid)}" data-act="wk-go">${esc(r.name)} → ${esc(r.title)} ${esc(r.ch)} 역</a>`).join('')}</div>`:''}
 ${aired?`<details class="wk-sec nf"><summary>이 작품 속 연기 점수 주기</summary><input type="range" min="0" max="100" step="5" value="70" id="ps${d.i}" aria-label="연기 점수"><output id="po${d.i}">70</output><input type="text" id="pr${d.i}" maxlength="200" placeholder="한줄평(선택)"><button class="b sm buy" data-act="perf" data-i="${d.i}">평가</button></details>`:''}
 <p class="dl" style="padding:0 18px 16px">작품 정보와 사진: TMDB</p>`}

/* 나의 시네마 서재 */
/* 나의 시네마 서재: 서재 벽에 액자로 걸린 포스터, 그림 조명, DVD 책장, 조명 스위치 */
const AV_THEMES=[['wood','클래식 우드'],['noir','누아르'],['gallery','화이트 갤러리']];
function avTheme(){try{return localStorage.getItem('avTheme')||'wood'}catch(e){return 'wood'}}
async function loadAvRoom(nick,me){const box=$('#avroom');if(!box)return;let items=[];try{items=await rpc('av_room',{nick})||[]}catch(e){}
 const g={};items.forEach(w=>(w.genres||[]).forEach(x=>g[x]=(g[x]||0)+1));const tg=Object.entries(g).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
 const hero=items[0],rest=items.slice(1,12),th=avTheme();
 const sz=i=>['m','s','m','s','s','m','s','m','s','s','m'][i%11];
 const tilt=t=>{const h=[...String(t)].reduce((a,c)=>a+c.charCodeAt(0),0);return ((h%5)-2)*0.6};
 const frame=(w,i)=>`<button class="fr fr-${sz(i)}" style="--tilt:${tilt(w.title)}deg" data-act="wk-open" data-m="${w.media}" data-id="${w.tmdb_id}" aria-label="${esc(w.title)} 자세히"><span class="fr-l" aria-hidden="true"></span><span class="fr-in">${w.poster?`<img src="${esc(w.poster)}" alt="" loading="lazy">`:`<em>${esc(w.title)}</em>`}</span><span class="fr-tag">${esc(w.title)}${w.year?` <small>${esc(w.year)}</small>`:''}</span></button>`;
 const empties=me?Math.max(0,Math.min(6,9-items.length)):0;
 const spineCol=t=>{const h=[...String(t)].reduce((a,c)=>(a*31+c.charCodeAt(0))|0,7);return `hsl(${Math.abs(h)%360} 35% ${28+Math.abs(h>>3)%18}%)`};
 box.innerHTML=`<div class="sh"><h2>${me?'나의 시네마 서재':esc(nick)+' 님의 시네마 서재'}</h2><span class="sub">${items.length}편 소장${tg.length?`, 취향 ${esc(tg.join(', '))}`:''}</span></div>
 <div class="den th-${th}" id="den">
  <div class="den-top"><span class="den-plate">${esc(nick)}의 시네마 서재<small>${items.length?`${items.length}편이 걸려 있어요`:'아직 빈 벽이에요'}</small></span>
   <span class="den-ctl">${me?`<select id="avTh" aria-label="서재 분위기">${AV_THEMES.map(t=>`<option value="${t[0]}"${t[0]===th?' selected':''}>${t[1]}</option>`).join('')}</select>`:''}<button class="den-sw" data-act="den-light" aria-pressed="false" title="조명 끄고 상영 모드">조명</button></span></div>
  <div class="den-wall">
   ${hero?`<button class="fr fr-hero" data-act="wk-open" data-m="${hero.media}" data-id="${hero.tmdb_id}" aria-label="${esc(hero.title)} 자세히"><span class="fr-l" aria-hidden="true"></span><span class="fr-in">${hero.poster?`<img src="${esc(hero.poster)}" alt="">`:`<em>${esc(hero.title)}</em>`}</span><span class="fr-tag"><small>최근에 건 작품</small>${esc(hero.title)}</span></button>`:''}
   ${rest.map(frame).join('')}
   ${Array.from({length:empties},()=>`<a class="fr fr-s fr-empty" href="#explore"><span class="fr-in"><em>빈 액자</em></span></a>`).join('')}
   ${!items.length&&!me?'<p class="den-none">아직 걸린 포스터가 없어요</p>':''}
  </div>
  <div class="den-shelf" aria-label="DVD 책장">${items.length?items.map(w=>`<button class="sp" style="--c:${spineCol(w.title)}" data-act="wk-open" data-m="${w.media}" data-id="${w.tmdb_id}" title="${esc(w.title)}"><span>${esc(w.title)}</span></button>`).join(''):`<span class="sp-hint">${me?'배우 필모그래피나 작품 상세에서 하트를 누르면 이 책장과 벽에 걸려요':''}</span>`}</div>
  <div class="den-floor" aria-hidden="true"><i class="lamp"></i><i class="chair"></i></div>
 </div>`;
 const sel=$('#avTh');if(sel)sel.onchange=()=>{try{localStorage.setItem('avTheme',sel.value)}catch(e){}const d=$('#den');d.className=d.className.replace(/th-\w+/,'th-'+sel.value)}}

document.addEventListener('click',async e=>{const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
 if(a==='fc-prev'){fcGo(-1);return}if(a==='fc-next'){fcGo(1);return}
 if(a==='fc-year'){const tr=$('#fcTrack');const c=tr&&[...tr.querySelectorAll('.fc-c')].find(x=>x.dataset.year===b.dataset.y);if(c)tr.scrollTo({left:c.offsetLeft-(tr.clientWidth-c.offsetWidth)/2,behavior:'smooth'});return}
 if(a==='wk-open'){const tr=$('#fcTrack');if(tr&&tr._drag&&Date.now()-tr._drag<300)return;e.preventDefault();const rt=b.classList.contains('cr-rate'),pw=openWork(b.dataset.m,+b.dataset.id,b.dataset.i!=null?+b.dataset.i:null);if(rt)Promise.resolve(pw).then(()=>{const dd=document.querySelector('#wkBox details.nf');if(dd){dd.open=true;dd.scrollIntoView({block:'center',behavior:'smooth'})}});return}
 if(a==='den-light'){const d=$('#den');const on=d.classList.toggle('dark');b.setAttribute('aria-pressed',on);b.textContent=on?'조명 켜기':'조명';return}
 if(a==='wk-close'){closeWork();return}
 if(a==='wk-go'){closeWork();return}
 if(a==='collect'){e.preventDefault();e.stopPropagation();if(needLogin())return;try{const on=await rpc('toggle_collect',{media:b.dataset.m,tmdb_id:+b.dataset.id,title:b.dataset.t,yr:+b.dataset.y||null,poster:b.dataset.p||null,via:b.dataset.via||null});const k=colKey(b.dataset.m,b.dataset.id);if(on)MYCOL.add(k);else MYCOL.delete(k);document.querySelectorAll(`.hrt[data-m="${b.dataset.m}"][data-id="${b.dataset.id}"]`).forEach(h=>{h.classList.toggle('on',on);h.setAttribute('aria-pressed',on);if(on){h.classList.remove('pop');void h.offsetWidth;h.classList.add('pop')}});toast(on?`${b.dataset.t}, 내 시네마 서재에 담았어요`:'시네마 서재에서 뺐어요');if($('#avroom')&&PROF&&PAGE&&PAGE.nick===PROF.nickname)loadAvRoom(PROF.nickname,true)}catch(err){toast(errMsg(err))}return}
});
addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#wkModal')&&$('#wkModal').classList.contains('on'))closeWork()});
