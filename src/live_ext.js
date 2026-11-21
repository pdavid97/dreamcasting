
/* ================= 확장: 나이, 작품 정보, 배우 페이지, 유저 페이지, 알림, 포스터 업로드 ================= */
const META=SB_URL+'/functions/v1/meta';
async function meta(body){const r=await fetch(META,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ANON,apikey:ANON},body:JSON.stringify(body)});if(!r.ok)throw new Error('정보를 불러오지 못했어요');return r.json()}
const NOW_Y=new Date().getFullYear();
let AGE={};try{AGE=JSON.parse(localStorage.getItem('dcAge1')||'{}')}catch(e){}
let ageBusy=false;
async function loadAges(names){const need=[...new Set(names)].filter(n=>n&&!(n in AGE)).slice(0,40);if(!need.length||ageBusy)return;ageBusy=true;
 try{const d=await meta({ages:need});Object.assign(AGE,d.ages||{});try{localStorage.setItem('dcAge1',JSON.stringify(AGE))}catch(e){}render()}catch(e){}ageBusy=false}
const ageAt=(name,y)=>{const b=AGE[name];if(!b)return null;const by=+b.slice(0,4),bm=+b.slice(5,7)||1;if(!by)return null;if(y&&y<NOW_Y)return y-by;const n=new Date();return n.getFullYear()-by-((n.getMonth()+1)<bm?1:0)};
const ageTxt=(name,y)=>{const a=ageAt(name,y);return a==null?'':(y&&y<NOW_Y?`${y}년 당시 ${a}세`:`만 ${a}세`)};
const pickLabel=(r,p)=>{const n=pickName(r,p);return n&&p&&p.y?`${n} (${p.y}년)`:n};
const actorLink=(name,inner)=>`<a class="alink" href="#a/${encodeURIComponent(name)}" title="${esc(name)} 배우 페이지">${inner||esc(name)}</a>`;

/* ---------- 작품 정보 ---------- */
let WORK={},workBusy=new Set();
async function loadWork(t){if(!t||t.id in WORK||workBusy.has(t.id))return;if(t.work_at&&Date.now()-Date.parse(t.work_at)<6*864e5){WORK[t.id]=t.work;return}
 workBusy.add(t.id);try{const d=await meta({topic:t.id});WORK[t.id]=d.work||null;if(SEL===t.id)renderWork()}catch(e){WORK[t.id]=null}workBusy.delete(t.id)}
function renderWork(){const box=$('#tWork');if(!box)return;const t=topic();if(!t){box.innerHTML='';return}if(!(t.id in WORK))loadWork(t);const w=WORK[t.id];
 const links=(t.links||[]).filter(l=>/^https:\/\//.test(l.url));
 const canEdit=PROF&&(PROF.is_admin||(USER&&t.created_by===USER.id));
 const label={wn:'작품 정보',k2:'원작 드라마 정보',us2k:'원작 정보',k2us:'원작 드라마 정보',ip2live:'작품 정보',live2x:'원작 작품 정보'}[t.cat]||'작품 정보';
 if(!w&&!links.length&&!canEdit){box.innerHTML='';return}
 const meta1=w?[w.kind,w.year,(w.networks||[]).join(', '),w.episodes?`${w.episodes}부작`:'',w.runtime?`${w.runtime}분`:'',w.rating?`TMDB 평점 ${w.rating}`:''].filter(Boolean).join(', '):'';
 box.innerHTML=`<details class="work" ${box.dataset.open==='1'?'open':''}><summary><b>${label}</b>${w?`<span class="sub"> ${esc(meta1)}</span>`:''}</summary>
 ${w?`<div class="wk">${w.poster?`<img src="${esc(w.poster)}" alt="${esc(w.title)} 포스터" loading="lazy">`:''}<div>
  ${w.overview?`<p>${esc(w.overview)}</p>`:''}
  ${(w.genres||[]).length?`<p class="sub">장르 ${esc(w.genres.join(', '))}</p>`:''}
  ${(w.makers||[]).length?`<p class="sub">연출, 극본 ${esc(w.makers.join(', '))}</p>`:''}
  ${(w.cast||[]).length?`<p class="sub">출연 ${w.cast.map(c=>actorLink(c.name)+(c.ch?` (${esc(c.ch)})`:'')).join(', ')}</p>`:''}
  ${(w.watch||[]).length?`<div class="watch"><span class="sub">국내 시청처</span>${w.watch.map(p=>`<span class="wp">${p.logo?`<img src="${esc(p.logo)}" alt="">`:''}${esc(p.name)}</span>`).join('')}<small class="dl">시청 정보 제공 JustWatch</small></div>`:''}
 </div></div>`:''}
 <div class="wlinks">${w&&w.homepage?`<a class="b sm buy" href="${esc(w.homepage)}" target="_blank" rel="noopener">공식 사이트</a>`:''}${links.map(l=>`<a class="b sm" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}${w?`<a class="b sm" href="${esc(w.tmdb)}" target="_blank" rel="noopener">TMDB</a>`:''}${w&&w.imdb?`<a class="b sm" href="${esc(w.imdb)}" target="_blank" rel="noopener">IMDb</a>`:''}</div>
 ${!w?`<p class="dl">TMDB에서 같은 제목의 작품을 찾지 못했어요. 공식 사이트나 원작 연재처 링크를 붙여 주세요.</p>`:''}
 ${canEdit?`<details class="nf"><summary>링크 고치기 (주제를 연 사람, 운영자)</summary><textarea id="wLinks" rows="3" placeholder="한 줄에 하나씩: 이름 https://주소">${esc((t.links||[]).map(l=>l.label+' '+l.url).join('\n'))}</textarea><button class="b sm" data-act="wlinks">저장</button></details>`:''}
 </details>`;
 const d=box.querySelector('details.work');d.addEventListener('toggle',()=>{box.dataset.open=d.open?'1':'0'})}

/* ---------- 알림 ---------- */
let NOTICES=[];
async function loadNotices(){if(!USER||!PROF){NOTICES=[];return}const {data}=await sb.from('notices').select('*').order('created_at',{ascending:false}).limit(30);NOTICES=data||[]}
function bellHTML(){if(!PROF)return '';const n=NOTICES.filter(x=>!x.read).length;return `<details class="bell"><summary aria-label="알림 ${n}개">알림${n?` <i>${n}</i>`:''}</summary><div class="bellp"><div class="sh"><b>내 소식</b><button class="b sm" data-act="readall">모두 읽음</button></div><ul>${NOTICES.map(x=>`<li class="${x.read?'':'new'}"><a href="${x.person_id&&x.kind==='fan_race'?'#'+esc(x.topic_id||''):'#'+esc(x.topic_id||'')}">${esc(x.body)}</a><small>${new Date(x.created_at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small></li>`).join('')||'<li class="empty3">취향을 등록하면 맞는 소식을 모아 드려요</li>'}</ul><a class="b sm" href="#u/${encodeURIComponent(PROF.nickname)}">내 페이지에서 취향 고치기</a></div></details>`}

/* ---------- 페이지(배우, 유저) ---------- */
let PAGE=null;
function closePage(){if(!PAGE)return;PAGE=null;$('#page').hidden=true;$('#page').innerHTML='';document.querySelector('.desk').hidden=false}
async function openRoute(){const h=decodeURIComponent(location.hash.slice(1));
 if(h.startsWith('a/'))return openActor(h.slice(2));
 if(h.startsWith('u/'))return openUser(h.slice(2));
 closePage()}
function showPage(html){$('#page').innerHTML=html;$('#page').hidden=false;document.querySelector('.desk').hidden=true;scrollTo({top:$('#page').offsetTop-10,behavior:'smooth'})}

/* 배우 페이지 */
async function openActor(name){name=name.trim();if(!name)return;PAGE={kind:'a',name};showPage(`<div class="pg"><p class="dl">${esc(name)} 배우 페이지를 여는 중이에요</p></div>`);
 try{let pid=null;const s=await rpc('people_search',{q:name});const ex=(s||[]).find(x=>x.name===name);if(ex)pid=ex.id;else{const e=await meta({ensure:name});pid=e.id}
  if(!pid){showPage(`<div class="pg"><button class="b sm" data-act="back">광장으로</button><h1>${esc(name)}</h1><p class="sub">TMDB에서 이 배우를 찾지 못했어요. 이름 표기를 확인해 주세요.</p></div>`);return}
  PAGE.pid=pid;await renderActor()}catch(e){showPage(`<div class="pg"><button class="b sm" data-act="back">광장으로</button><p class="dl">${esc(errMsg(e))}</p></div>`)}}
async function renderActor(){const pid=PAGE.pid;
 const [pg,,posts,mine]=await Promise.all([rpc('person_page',{pid}),loadPerf(pid).then(()=>null),sb.from('v_fan_posts').select('*').eq('person_id',pid).order('created_at',{ascending:false}).limit(40),
  USER?sb.from('fan_follows').select('person_id').eq('person_id',pid):Promise.resolve({data:[]})]);
 let prof=pg.person.profile;if(!prof){try{prof=(await meta({person:pid})).profile}catch(e){prof=null}}
 if(!PAGE||PAGE.pid!==pid)return;
 const p=pg.person,fan=(mine.data||[]).length>0,name=p.name;
 if(prof&&prof.birthday&&!AGE[name]){AGE[name]=prof.birthday}
 const photo=(prof&&prof.photo)||IMG['p:'+name]||'';
 const races=pg.races||[],open=races.filter(r=>r.open),done=races.filter(r=>!r.open);
 const lead=open.filter(r=>r.rank===1&&r.votes>0).length;
 const raceCard=r=>{const pct=r.total?r.votes/r.total:0;return `<div class="race${r.rank===1&&r.votes>0?' lead':''}"><div><a href="#${esc(r.topic_id)}"><b>${esc(r.title)}</b></a> <span class="sub">${esc(r.ch)} 역</span></div>
  <div class="rk2"><b class="num">${r.votes>0||r.rank===1?r.rank:'-'}위</b><span class="sub">/ 후보 ${r.field}명</span></div>
  <div class="vb"><span><i style="width:${(pct*100).toFixed(1)}%"></i></span><b>${fmt(r.votes)}표${r.total?`, ${(pct*100).toFixed(0)}%`:''}</b></div>
  <p class="sub">${r.rank===1&&r.votes>0?(r.gap===0&&r.top===r.votes?'지금 1위예요. 자리를 지켜 주세요':'지금 1위예요'):`1위까지 ${fmt(r.gap+1)}표`}${r.open?`, 마감 D-${Math.max(0,Math.ceil((new Date(r.closes_at)-new Date())/864e5))}`:''}</p>
  ${r.open?`<div class="row2"><button class="b sm buy" data-act="avote" data-rid="${r.role_id}" data-cid="${r.cid}">이 배역에 ${esc(name)} 한 표</button><a class="b sm" href="#${esc(r.topic_id)}">토론 보러 가기</a></div>`:''}</div>`};
 const works=(prof&&prof.works)||[],awards=(prof&&prof.awards)||[];PAGE.works=works;
 const scored=(PERF[pid]||[]).filter(x=>x.n>0),avgAll=scored.length?Math.round(scored.reduce((a,x)=>a+ +x.avg*x.n,0)/scored.reduce((a,x)=>a+x.n,0)):null;
 showPage(`<div class="pg actor">
 <button class="b sm" data-act="back">광장으로</button>
 <div class="ahero">${photo?`<img class="aph" src="${esc(photo)}" alt="${esc(name)}">`:`<span class="aph ph0">${esc(name[0])}</span>`}
  <div><span class="sub">배우 팬 채널</span><h1>${esc(name)}</h1>
  <p class="sub">${prof&&prof.birthday?`${esc(prof.birthday)} 출생, ${ageTxt(name)}`:''}${prof&&prof.place?`, ${esc(prof.place)}`:''}</p>
  <div class="astats"><span><b class="num">${avgAll==null?'-':avgAll}</b><small>연기 점수</small></span><span><b class="num">${fmt(p.fans)}</b><small>팬</small></span><span><b class="num">${open.length}</b><small>물망 중</small></span><span><b class="num">${lead}</b><small>1위 배역</small></span><span><b class="num">${fmt(pg.sheet_mentions)}</b><small>시트 언급</small></span></div>
  <div class="row2"><button class="b ${fan?'':'buy'}" data-act="follow" data-pid="${p.id}">${fan?'팬 채널 나가기':'팬 채널 들어가기'}</button><button class="b" data-act="rally" data-pid="${p.id}">화력 요청 문구 복사</button></div>
  <p class="dl">팬이 되면 ${esc(name)} 님이 새 작품 후보에 오르거나 캐스팅이 확정될 때 알려 드려요. 투표는 배역마다 한 사람 한 표예요. 화력은 더 많은 팬이 투표하러 오게 만드는 데서 나와요.</p></div></div>

 <section><div class="sh"><h2>지금 물망에 오른 작품</h2><span class="sub">1위까지 남은 표</span></div>
  <div class="races">${open.map(raceCard).join('')||`<p class="empty3">아직 투표가 열린 배역 후보가 아니에요. 작품 배역 보드에서 ${esc(name)} 님을 후보로 올려 보세요.</p>`}</div>
  ${done.length?`<details class="talk"><summary>지난 레이스 ${done.length}개</summary><div class="races">${done.map(raceCard).join('')}</div></details>`:''}
  ${(pg.cast||[]).length?`<p class="sub" style="margin-top:8px">광장에서 확정된 캐스팅: ${pg.cast.map(c=>`<a href="#${esc(c.topic_id)}">${esc(c.title)} ${esc(c.ch)}</a>`).join(', ')}</p>`:''}
 </section>

 <div class="acols">
 <section><div class="sh"><h2>팬 게시판</h2><span class="sub">${fmt(pg.posts)}개</span></div>
  <div class="talkf"><input type="text" id="fanTx" maxlength="280" placeholder="${esc(name)} 님이 어울릴 배역, 응원 한마디"><button class="b sm buy" data-act="fanpost" data-pid="${p.id}">올리기</button></div>
  <ul class="cm">${(posts.data||[]).map(x=>`<li><small>${esc(x.nickname)}${x.is_fan?' <span class="pick">팬</span>':''}, ${new Date(x.created_at).toLocaleDateString('ko-KR')}</small>${esc(x.body)}<button class="lk" data-act="fanlike" data-id="${x.id}">공감 ${fmt(x.likes)}</button></li>`).join('')||'<li class="empty3">첫 응원을 남겨 주세요</li>'}</ul>
 </section>
 <section><div class="sh"><h2>수상</h2><span class="sub">Wikidata 기록</span></div>
  ${awards.length?`<ul class="aw">${awards.slice(0,30).map(a=>`<li><b>${esc(a.year||'')}</b> ${esc(a.name)}${a.work?` <span class="sub">${esc(a.work)}</span>`:''}</li>`).join('')}</ul>`:`<p class="dl">${prof&&prof.awards_ok===false?'수상 기록을 불러오지 못했어요.':'Wikidata에 등록된 수상 기록이 아직 없어요.'}${prof&&prof.wikidata?` <a href="${esc(prof.wikidata)}" target="_blank" rel="noopener">Wikidata에서 보기</a>`:''}</p>`}
  ${prof&&prof.bio?`<details class="talk"><summary>소개</summary><p class="bio">${esc(prof.bio)}</p></details>`:''}
 </section></div>

 <section><div class="sh"><h2>필모그래피</h2><span class="sub">TMDB 출연 기록, 최신순</span></div>
  <div class="films">${works.slice(0,36).map((w,i)=>{const pf=perfOf(pid,w),aired=w.year&&+w.year<=NOW_Y;return `<div class="film">${w.poster?`<img src="${esc(w.poster)}" alt="" loading="lazy">`:'<span class="np"></span>'}<b>${esc(w.title)}</b><small>${esc(w.type)} ${esc(w.year||'미정')}${w.ch?`, ${esc(w.ch)}`:''}${w.rating&&w.votes>=20?`, 평점 ${w.rating}`:''}</small>${pf&&pf.n?`<span class="ps"><b class="num">${pf.avg}</b> 연기 점수, ${fmt(pf.n)}명</span>${(pf.reviews||[]).slice(0,1).map(r=>`<small class="rv">"${esc(r.review)}" ${esc(r.nick)} ${r.score}점</small>`).join('')}`:''}${aired?`<details class="nf"><summary>연기 점수 주기</summary><input type="range" min="0" max="100" step="5" value="70" id="ps${i}" aria-label="${esc(w.title)} 연기 점수"><output id="po${i}">70</output><input type="text" id="pr${i}" maxlength="200" placeholder="한줄평(선택)"><button class="b sm buy" data-act="perf" data-i="${i}">평가</button></details>`:''}</div>`}).join('')||'<p class="empty3">출연 기록을 불러오는 중이거나 없어요.</p>'}</div>
  ${prof&&prof.tmdb?`<p class="dl"><a href="${esc(prof.tmdb)}" target="_blank" rel="noopener">TMDB에서 전체 필모 보기</a></p>`:''}
 </section></div>`)}

/* 유저 페이지 */
const BADGES=[['첫 표',s=>s.votes>=1],['투표 마니아',s=>s.votes>=30],['첫 적중',s=>s.hits>=1],['적중 5회',s=>s.hits>=5],['후보 발굴',s=>s.proposals>=1],['원석 발굴',s=>s.proposal_hits>=1],['시트 장인',s=>s.sheets>=3],['공감 부자',s=>s.sheet_likes+s.comment_likes+s.fan_likes>=50],['토론가',s=>s.comments>=20],['VS 고수',s=>s.duels>=50],['싱크로 심사위원',s=>s.syncs>=5],['주제 개척자',s=>s.topics>=1]];
const GENRES=['로맨스','코미디','드라마','사극','판타지','스릴러','범죄','미스터리','액션','가족','의학','법정'];
async function openUser(nick){PAGE={kind:'u',nick};showPage(`<div class="pg"><p class="dl">${esc(nick)} 님 페이지를 여는 중이에요</p></div>`);
 try{const d=await rpc('user_page',{nick});if(!PAGE||PAGE.nick!==nick)return;if(!d){showPage(`<div class="pg"><button class="b sm" data-act="back">광장으로</button><p class="dl">없는 닉네임이에요.</p></div>`);return}renderUser(d)}catch(e){showPage(`<div class="pg"><button class="b sm" data-act="back">광장으로</button><p class="dl">${esc(errMsg(e))}</p></div>`)}}
function renderUser(d){const p=d.profile,s=d.stats,g=grade(p.points),nx=GRADES[g+1],rate=s.decided?Math.round(s.hits/s.decided*100):null,ts=p.tastes||{};
 const cname=id=>(CATS.find(c=>c.id===id)||{}).name||id;
 const tile=(v,l)=>`<span><b class="num">${v}</b><small>${l}</small></span>`;
 showPage(`<div class="pg user">
 <button class="b sm" data-act="back">광장으로</button>
 <div class="uhero"><div><span class="sub">${d.me?'내 페이지':'캐스팅 디렉터 페이지'}</span><h1>${esc(p.nickname)}</h1>
  <p><b style="color:var(--red)">${GRADES[g][1]}</b> <span class="num">${fmt(p.points)}P</span>, 안목 랭킹 ${fmt(p.rank)}위${nx?`, 다음 등급 ${GRADES[g+1][1]}까지 ${fmt(nx[0]-p.points)}P`:''}</p>
  <div class="gbar" aria-hidden="true"><i style="width:${nx?clamp((p.points-GRADES[g][0])/(nx[0]-GRADES[g][0]),0,1)*100:100}%"></i></div>
  ${p.bio?`<p class="bio">${esc(p.bio)}</p>`:''}
  <p class="sub">${[...(ts.cats||[]).map(cname),...(ts.genres||[]),...(ts.makers||[])].map(x=>`<span class="chip2">${esc(x)}</span>`).join(' ')}</p></div>
  <div class="astats">${tile(rate==null?'-':rate+'%','적중률')}${tile(fmt(s.hits)+'/'+fmt(s.decided),'결과 나온 표 중 적중')}${tile(fmt(s.proposal_hits)+'/'+fmt(s.proposals),'발굴 적중')}${tile(fmt(s.sheet_likes+s.comment_likes+s.fan_likes),'받은 공감')}${tile(fmt(s.votes),'투표')}${tile(fmt(s.sheets),'캐스팅 시트')}</div></div>

 <section><div class="sh"><h2>업적</h2><span class="sub">${BADGES.filter(b=>b[1](s)).length}/${BADGES.length}</span></div>
  <div class="badges">${BADGES.map(b=>`<span class="badge${b[1](s)?' on':''}">${b[0]}</span>`).join('')}</div></section>

 ${d.me&&(d.next||[]).length?`<section><div class="sh"><h2>다음에 던질 한 표</h2><span class="sub">아직 투표하지 않은 배역</span></div><div class="races">${d.next.map(n=>`<a class="race" href="#${esc(n.tid)}"><b>${esc(n.title)}</b><span class="sub">${esc(n.ch)} 역${n.why==='fan'?', 내가 팬인 배우가 후보':n.why==='taste'?', 내 취향 분류':', 지금 뜨거운 배역'}</span></a>`).join('')}</div></section>`:''}

 <div class="acols">
 <section><div class="sh"><h2>캐스팅 이력</h2><span class="sub">${d.me?'내 표 전체':'결과가 나온 배역만 공개'}</span></div>
  <ul class="hist">${(d.votes||[]).map(v=>`<li class="${v.hit?'hit':''}"><a href="#${esc(v.tid)}"><b>${esc(v.title)}</b></a> ${esc(v.ch)} 역, ${actorLink(v.name)}${v.stage==='cast'||v.stage==='airing'?(v.hit?' <span class="chip2">적중</span>':` <span class="sub">실제 ${esc(v.actor||'')}</span>`):' <span class="sub">진행 중</span>'}</li>`).join('')||'<li class="empty3">아직 기록이 없어요</li>'}</ul>
  ${(d.proposals||[]).length?`<h3 style="margin-top:12px">내가 발굴한 후보</h3><ul class="hist">${d.proposals.map(v=>`<li class="${v.hit?'hit':''}"><a href="#${esc(v.tid)}">${esc(v.title)}</a> ${esc(v.ch)} 역 ${actorLink(v.name)} <span class="num">${fmt(v.votes)}표</span>${v.hit?' <span class="chip2">캐스팅 적중</span>':''}</li>`).join('')}</ul>`:''}
 </section>
 <section><div class="sh"><h2>캐스팅 시트</h2><span class="sub">공감 순</span></div>
  <div class="usheets">${(d.sheets||[]).map(x=>`<a class="us" href="#${esc(x.tid)}">${x.poster?`<img src="${esc(x.poster)}" alt="" loading="lazy">`:''}<b>${esc(x.title)}</b><small>공감 ${fmt(x.likes)}</small>${x.reason?`<small>"${esc(x.reason.slice(0,60))}"</small>`:''}</a>`).join('')||'<p class="empty3">아직 시트가 없어요</p>'}</div>
  <h3 style="margin-top:12px">팬 채널</h3><p>${(d.follows||[]).map(f=>actorLink(f.name)).join(', ')||'<span class="sub">아직 없어요</span>'}</p>
 </section></div>

 ${d.me?`<section><div class="sh"><h2>내 취향 등록</h2><span class="sub">맞는 새 주제와 소식을 알림으로 보내 드려요</span></div>
  <div class="taste"><p class="sub">관심 분류</p><div class="qty">${CATS.map(c=>`<label class="chk"><input type="checkbox" name="tc" value="${c.id}" ${(ts.cats||[]).includes(c.id)?'checked':''}>${c.name}</label>`).join('')}</div>
  <p class="sub">장르</p><div class="qty">${[...new Set([...GENRES,...(ts.genres||[])])].map(x=>`<label class="chk"><input type="checkbox" name="tg" value="${esc(x)}" ${(ts.genres||[]).includes(x)?'checked':''}>${esc(x)}</label>`).join('')}</div>
  <label class="sub">좋아하는 감독, 작가 (쉼표로 구분)<input type="text" id="tMk" maxlength="200" value="${esc((ts.makers||[]).join(', '))}" placeholder="예: 김은숙, 박찬욱"></label>
  <label class="sub">좋아하는 배우는 배우 페이지에서 팬 채널에 들어가면 함께 등록돼요</label>
  <label class="sub">한 줄 소개<input type="text" id="tBio" maxlength="100" value="${esc(p.bio||'')}" placeholder="예: 원작 싱크로율에 진심인 사람"></label>
  <button class="b buy" data-act="tastes">취향 저장</button></div></section>`:''}
 </div>`)}

/* ---------- 배우 화력 랭킹 ---------- */
let FANB=[];
async function loadFanBoard(){try{FANB=await rpc('fan_board',{lim:10})||[]}catch(e){FANB=[]}}
function renderFanBoard(){const b=$('#fanb');if(!b)return;b.innerHTML=`<div class="talkf"><input type="text" id="aSearch" maxlength="20" placeholder="배우 이름으로 팬 채널 찾기"><button class="b sm" data-act="asearch">찾기</button></div>`+(FANB.map((r,i)=>`<div class="rk"><b>${i+1}</b><span>${actorLink(r.name,`<b>${esc(r.name)}</b>`)}<small>팬 ${fmt(r.fans)}, 물망 ${r.races}, 1위 ${r.leads}</small></span><b class="num">${fmt(r.votes)}표</b></div>`).join('')||'<p class="empty3">후보가 올라오면 배우별 화력이 집계돼요.</p>')}

/* ---------- 포스터 업로드와 AI 배경 ---------- */
async function shrink(file){const url=URL.createObjectURL(file);try{const img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=url});
 const sc=Math.min(1,1200/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext('2d').drawImage(img,0,0,c.width,c.height);
 return await new Promise(ok=>c.toBlob(ok,'image/webp',.86))}finally{URL.revokeObjectURL(url)}}
async function uploadPoster(sid,file){if(!/^image\//.test(file.type))return toast('이미지 파일만 올릴 수 있어요');busy=true;toast('포스터를 올리는 중이에요');
 try{const blob=await shrink(file);if(!blob||blob.size>2e6)throw new Error('이미지가 너무 커요. 2MB 이하로 줄여 주세요');const path=`${USER.id}/${sid}-${Date.now()}.webp`;
  const {error}=await sb.storage.from('posters').upload(path,blob,{contentType:'image/webp',upsert:false});if(error)throw error;
  await rpc('set_sheet_poster',{sid,url:`${SB_URL}/storage/v1/object/public/posters/${path}`,kind:'upload'});toast('포스터를 붙였어요');busy=false;await refresh()}catch(e){busy=false;toast(errMsg(e))}}
async function aiPoster(sid){busy=true;toast('AI 배경을 만드는 중이에요. 10초쯤 걸려요');
 try{const {data}=await sb.auth.getSession();const r=await fetch(SB_URL+'/functions/v1/poster',{method:'POST',headers:{'Content-Type':'application/json',apikey:ANON,Authorization:'Bearer '+(data.session?data.session.access_token:ANON)},body:JSON.stringify({sid,mood:PSTYLE,figures:D.roles.filter(r=>!isSync(r)).length})});
  const d=await r.json().catch(()=>({}));busy=false;
  if(r.status===503)return toast('AI 포스터는 아직 준비 중이에요. 직접 만든 이미지를 올려 주세요');
  if(r.status===429)return toast(d.error==='user_limit'?'AI 포스터는 하루 3장까지 만들 수 있어요':'오늘 AI 포스터가 모두 소진됐어요. 내일 다시 시도해 주세요');
  if(!r.ok)return toast('AI 배경을 만들지 못했어요');toast(`AI 배경을 붙였어요. 오늘 ${d.left}장 더 만들 수 있어요`);await refresh()}catch(e){busy=false;toast(errMsg(e))}}

/* ---------- 감상하러 가기(유튜브, 스트리밍, 공식) + 노출/클릭 측정 ---------- */
let SID='';try{SID=localStorage.getItem('dcSid')||'';if(!SID){SID=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem('dcSid',SID)}}catch(e){}
const PROV={'Netflix':'netflix','TVING':'tving','Tving':'tving','wavve':'wavve','Wavve':'wavve','Coupang Play':'coupangplay','Disney Plus':'disney','Disney+':'disney','Watcha':'watcha','Apple TV':'appletv','Apple TV+':'appletv','Amazon Prime Video':'prime'};
const goURL=(tid,p,k,u,pl)=>`${SB_URL}/functions/v1/go?t=${encodeURIComponent(tid)}&p=${encodeURIComponent(p)}&k=${encodeURIComponent(k)}&u=${encodeURIComponent(u)}${pl?`&pl=${pl}`:''}&s=${encodeURIComponent(SID)}&pg=topic`;
let PLACE={},STATS={},impSent=new Set();
async function loadPlace(tid){if(tid in PLACE)return;PLACE[tid]=[];try{PLACE[tid]=await rpc('active_placements',{tid})||[]}catch(e){}if(SEL===tid)renderWatch()}
async function loadStats(tid){if(tid in STATS)return;STATS[tid]=null;try{STATS[tid]=await rpc('work_stats',{tid})}catch(e){}if(SEL===tid)renderStats()}
function renderWatch(){const box=$('#tWatch');if(!box)return;const t=topic();if(!t){box.innerHTML='';return}loadPlace(t.id);const w=WORK[t.id],pl=PLACE[t.id]||[];
 const items=[];// [partner, label, url, kind, sponsored, placementId, logo]
 pl.forEach(p=>items.push([p.partner_id,p.label,p.url,'placement',p.sponsored,p.id,'']));
 if(w&&w.homepage)items.push(['official','공식 사이트',w.homepage,'official',false,0,'']);
 if(w)(w.watch||[]).forEach(p=>{if(w.watch_link)items.push([PROV[p.name]||'justwatch',p.name+'에서 보기',w.watch_link,'stream',false,0,p.logo])});
 items.push(['youtube','유튜브에서 찾기','https://www.youtube.com/results?search_query='+encodeURIComponent(t.title+(w&&w.year?' '+w.year:'')+' 예고편'),'youtube',false,0,'']);
 const vids=(w&&w.videos)||[];
 box.innerHTML=`<div class="watchbox"><div class="sh"><h3>감상하러 가기</h3><span class="sub">${w&&(w.watch||[]).length?'국내 시청처 정보 JustWatch 제공':'시청처 정보가 생기면 여기에 떠요'}</span></div>
 ${vids.length?`<div class="vids">${vids.slice(0,2).map(v=>`<div class="vid"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.key)}" title="${esc(v.name)}" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><small>${esc(v.name)}</small></div>`).join('')}</div>`:''}
 <div class="wlinks">${items.map(i=>`<a class="b sm${i[4]?' spon':i[3]==='official'?' buy':''}" href="${esc(goURL(t.id,i[0],i[3],i[2],i[5]))}" target="_blank" rel="noopener sponsored">${i[6]?`<img src="${esc(i[6])}" alt="">`:''}${esc(i[1])}${i[4]?' <em>광고</em>':''}</a>`).join('')}</div></div>`;
 const key=t.id+':'+items.map(i=>i[0]).join(',');if(!impSent.has(key)&&items.length){impSent.add(key);const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){io.disconnect();rpc('log_impressions',{tid:t.id,ps:items.map(i=>i[0]),sp:items.map(i=>!!i[4])}).catch(()=>{})}});io.observe(box)}}
const big=v=>v>=1e8?(v/1e8).toFixed(1)+'억':v>=1e4?Math.round(v/1e4).toLocaleString('ko-KR')+'만':fmt(v);
function renderStats(){const box=$('#tStats');if(!box)return;const t=topic();if(!t){box.innerHTML='';return}loadStats(t.id);const s=STATS[t.id];if(!s){box.innerHTML='';return}
 const L=s.latest||{},g=k=>L[k];const cells=[];
 if(g('nielsen:household_rating'))cells.push(['최근 시청률',g('nielsen:household_rating').v+'%','닐슨 전국, 제보 '+g('nielsen:household_rating').day]);
 if(g('netflix:weekly_views'))cells.push(['넷플릭스 주간 시청 수',big(+g('netflix:weekly_views').v)+'회',`${g('netflix:weekly_views').day} 주, 글로벌`]);
 if(g('netflix:weekly_rank'))cells.push(['넷플릭스 글로벌 순위',g('netflix:weekly_rank').v+'위',`Top 10 ${g('netflix:weeks_in_top10')?g('netflix:weeks_in_top10').v+'주째':''}`]);
 if(g('tmdb:rating')&&+g('tmdb:votes')?.v>=10)cells.push(['TMDB 평점',(+g('tmdb:rating').v).toFixed(1),fmt(+g('tmdb:votes').v)+'명 평가']);
 if(g('tmdb:popularity'))cells.push(['화제성 지수',(+g('tmdb:popularity').v).toFixed(0),'TMDB 인기도, 매일 갱신']);
 const aw=s.awards||[];
 box.innerHTML=(cells.length||aw.length||PROF)?`<div class="stats2">${cells.map(c=>`<span><small>${c[0]}</small><b class="num">${esc(c[1])}</b><small>${esc(c[2])}</small></span>`).join('')}</div>
 ${aw.length?`<p class="sub">수상 ${aw.slice(0,6).map(a=>esc((a.year?a.year+' ':'')+a.name)).join(', ')}${aw.length>6?` 외 ${aw.length-6}개`:''} <small class="dl">Wikidata</small></p>`:''}
 <details class="nf"><summary>시청률 제보하기${s.pending?` (검토 중 ${s.pending}건)`:''}</summary><p class="dl">기사나 공식 발표 링크가 있어야 해요. 운영자 확인 후 반영되고 20P를 드려요.</p>
 <div class="row2"><input type="date" id="mDay" max="${new Date().toISOString().slice(0,10)}"><select id="mSrc"><option value="nielsen">닐슨코리아</option><option value="tnms">TNMS</option><option value="other">기타</option></select><select id="mMet"><option value="household_rating">전국 가구 시청률(%)</option><option value="metro_rating">수도권 시청률(%)</option><option value="viewers">시청자 수(명)</option></select><input type="number" id="mVal" step="0.1" min="0" placeholder="값"></div>
 <input type="url" id="mUrl" placeholder="출처 링크(https://)"><input type="text" id="mNote" maxlength="100" placeholder="메모(선택, 예: 12회)"><button class="b sm" data-act="mreport">제보</button></details>`:'';}

/* ---------- 연기 점수와 연간 메타 지수 ---------- */
let PERF={};
async function loadPerf(pid){try{PERF[pid]=await rpc('perf_board',{pid})||[]}catch(e){PERF[pid]=[]}}
function perfOf(pid,w){return (PERF[pid]||[]).find(p=>p.tmdb_id===w.id&&p.media===(w.type==='영화'?'movie':'tv'))}
async function loadYearIndex(){const y=+($('#yIdx')?.value||NOW_Y);try{const d=await rpc('actor_year_index',{yr:y,lim:10});const b=$('#yIdxList');if(b)b.innerHTML=(d||[]).map((r,i)=>`<div class="rk"><b>${i+1}</b><span>${actorLink(r.name,`<b>${esc(r.name)}</b>`)}<small>연기 ${r.acting}, 화제성 ${r.buzz}, 평가 ${fmt(r.ratings)}</small></span><b class="num">${r.meta}</b></div>`).join('')||`<p class="empty3">${y}년 작품 연기 평가가 쌓이면 지수가 나와요. 배우 페이지 필모에서 평가해 보세요.</p>`}catch(e){}}

/* 새 주제 제안: 배역 줄 */
function propRows(list){const box=$('#pRoles');if(!box)return;const row=r=>`<div class="prow"><select class="pk" aria-label="종류"><option value="actor" ${r.kind!=='option'?'selected':''}>인물(배우, 성우)</option><option value="option" ${r.kind==='option'?'selected':''}>선택지(장르, 개발사 등)</option></select><input class="pc" type="text" maxlength="20" placeholder="배역 또는 항목 이름" value="${esc(r.ch||'')}"><input class="po" type="text" maxlength="20" placeholder="원작 배우 (선택)" value="${esc(r.orig||'')}"><input class="pa" type="text" maxlength="20" placeholder="배역 나이 (선택)" value="${esc(r.age||'')}"><button class="lk" data-act="pdel" aria-label="지우기">지우기</button></div>`;
 if(list===null){box.insertAdjacentHTML('beforeend',row({}));return}box.innerHTML=(list.length?list:[{},{}]).map(row).join('')}
const PRESET={game:[{ch:'장르',kind:'option'},{ch:'개발사',kind:'option'},{ch:'플랫폼',kind:'option'},{ch:'주인공 목소리',kind:'actor'}],
 '애니메이션':[{ch:'제작 스튜디오',kind:'option'},{ch:'그림체',kind:'option'},{ch:'주인공 성우',kind:'actor'}],'웹툰':[{ch:'연재 플랫폼',kind:'option'},{ch:'작가',kind:'option'},{ch:'장르',kind:'option'}]};
function propMode(){const c=$('#pCat').value;$('#pSrcL').hidden=c!=='ip2live';$('#pDstL').hidden=c!=='live2x';
 $('#pHint').textContent=c==='live2x'?'드라마나 영화 제목을 넣고, 게임이면 장르, 개발사, 플랫폼처럼 고를 항목을 배역 대신 적어요':c==='ip2live'?'웹툰, 소설, 만화, 게임 원작의 주요 인물을 배역으로 적어요':'리메이크 분류는 작품명을 넣으면 원작 배역과 배우를 자동으로 채워요';
 if(c==='live2x'&&![...document.querySelectorAll('#pRoles .pc')].some(x=>x.value.trim())){const d=$('#pDst').value;propRows(PRESET[d==='게임'?'game':d]||[])}}
document.addEventListener('change',e=>{if(e.target.id==='pCat'||e.target.id==='pDst'){if(e.target.id==='pDst')propRows([]);propMode()}});
let WANTS=new Set();
async function loadWants(){WANTS=new Set();if(!USER)return;const {data}=await sb.from('topic_wants').select('topic_id');(data||[]).forEach(x=>WANTS.add(x.topic_id))}
async function loadMatrix(){try{const d=await rpc('media_matrix',{});const b=$('#mmx');if(b)b.innerHTML=(d||[]).filter(r=>r.src!==r.dst||r.src==='기타').slice(0,8).map(r=>`<div class="rk"><span><b>${esc(r.src)} > ${esc(r.dst)}</b><small>주제 ${r.topics}, 시트 ${r.sheets}</small></span><b class="num">보고 싶어요 ${fmt(r.wants)}</b></div>`).join('')||'<p class="empty3">IP 실사화와 크로스 미디어 주제가 올라오면 매체별 수요가 쌓여요.</p>'}catch(e){}}
document.addEventListener('input',e=>{const t=e.target;if(t.id&&t.id.startsWith('ps')&&t.type==='range'){const o=document.getElementById('po'+t.id.slice(2));if(o)o.textContent=t.value}});
document.addEventListener('change',e=>{if(e.target.id==='pTitle'&&$('#pCat').value!=='wn'&&![...document.querySelectorAll('#pRoles .pc')].some(x=>x.value.trim()))document.querySelector('[data-act=pfetch]').click()});
