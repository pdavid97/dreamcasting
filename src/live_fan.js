/* 배우 페이지 팬 참여: 오늘의 응원, 인생작 투표, 이 배역 어때요 */
IC.crown='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z"/></svg>';
function fanZone(pid,name){const F=PAGE.fan||{};const fans=F.fans||[];
 return `<section class="fz" id="fz">
 <div class="cheer">
  <button class="cheer-b${F.mine?' on':''}" data-act="cheer" data-pid="${pid}" ${F.mine?'aria-pressed="true"':''}>${IC.heart}<b>${F.mine?'오늘 응원 완료':'오늘의 응원 보내기'}</b><small>${F.mine?'내일 또 와 주세요':'하루 한 번, 랭킹에 바로 반영'}</small></button>
  <div class="cheer-st">
   <span><b class="num">${fmt(F.today||0)}</b><small>오늘 응원</small></span>
   <span><b class="num">${fmt(F.week||0)}</b><small>이번 주</small></span>
   <span><b class="num">${F.rank?F.rank+'위':'-'}</b><small>주간 응원 랭킹${F.ranked?` (${fmt(F.ranked)}명 중)`:''}</small></span>
   <span><b class="num">${F.streak||0}일</b><small>내 연속 응원</small></span>
  </div>
 </div>
 ${fans.length?`<div class="fz-fans"><small>이번 달 ${esc(name)} 응원 왕</small>${fans.map((f,i)=>`<a href="#u/${encodeURIComponent(f.nick)}"><span class="fz-rk">${i+1}</span>${esc(f.nick)}<em>${f.n}일</em></a>`).join('')}</div>`:`<p class="dl" style="margin:8px 0 0">아직 이번 달 응원 기록이 없어요. 첫 응원 왕이 되어 보세요.</p>`}
 </section>`}
function dreamRoles(pid,name){const L=(PAGE.fan&&PAGE.fan.dream)||[];if(!L.length)return '';
 return `<section id="dream"><div class="sh"><h2>${esc(name)} 님, 이 배역은 어때요?</h2><span class="sub">투표 중인데 아직 후보가 아닌 배역</span></div>
 <div class="dream">${L.map(r=>`<article class="dr"${r.poster?` style="--bg:url('${esc(r.poster)}')"`:''}><div class="dr-t"><small>${esc(r.title)}</small><b>${esc(r.ch)} 역</b><span>${r.orig?`원작 ${esc(r.orig)}, `:''}후보 ${r.cands}명</span></div>
  <div class="dr-a"><button class="b sm buy" data-act="dream-add" data-rid="${r.rid}" data-nm="${esc(name)}">후보로 올리기</button><a class="b sm" href="#${esc(r.tid)}">보러 가기</a></div></article>`).join('')}</div>
 <p class="dl">후보로 올리면 내 한 표가 함께 들어가요. 배역 성별과 국적권이 맞는 작품만 골라 보여 드려요.</p></section>`}
function bestWorks(name){const F=PAGE.fan||{},B=F.best||[],tot=F.best_total||0;
 return `<section id="bestw"><div class="sh"><h2>팬이 뽑은 ${esc(name)} 인생작</h2><span class="sub">${fmt(tot)}명 참여</span></div>
 ${B.length?`<ol class="bw">${B.map((b,i)=>{const pct=tot?b.n/tot:0,mine=+F.my_best===+b.tmdb_id;return `<li class="${mine?'mine':''}"><button data-act="wk-open" data-m="${esc(b.media)}" data-id="${b.tmdb_id}" class="bw-p">${b.poster?`<img src="${esc(b.poster)}" alt="" loading="lazy">`:''}</button><div><b>${i+1}. ${esc(b.title)}</b>${mine?' <span class="pick">내 픽</span>':''}<div class="vb"><span><i style="width:${(pct*100).toFixed(1)}%"></i></span><b>${(pct*100).toFixed(0)}% ${fmt(b.n)}명</b></div></div></li>`}).join('')}</ol>`:'<p class="empty3">아직 투표가 없어요. 아래 필모그래피에서 왕관을 눌러 첫 인생작을 골라 주세요.</p>'}
 </section>`}
function refreshFan(){if(!PAGE||PAGE.kind!=='a')return;const name=PAGE.name;
 const z=$('#fz');if(z)z.outerHTML=fanZone(PAGE.pid,name);
 const bw=$('#bestw');if(bw)bw.outerHTML=bestWorks(name);
 const dr=$('#dream');if(dr){const h=dreamRoles(PAGE.pid,name);if(h)dr.outerHTML=h;else dr.remove()}
 document.querySelectorAll('.fc-best').forEach(b=>{const w=PAGE.works[+b.dataset.i];b.classList.toggle('on',!!(w&&PAGE.fan&&+PAGE.fan.my_best===+w.id))})}
function burst(el){const r=el.getBoundingClientRect();for(let i=0;i<14;i++){const s=document.createElement('span');s.className='burst';s.textContent='♥';const a=Math.random()*Math.PI*2,d=50+Math.random()*70;
 s.style.cssText=`left:${r.left+r.width/2}px;top:${r.top+r.height/2}px;--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d-30}px;font-size:${12+Math.random()*14}px`;document.body.appendChild(s);setTimeout(()=>s.remove(),900)}}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
 if(a==='cheer'){if(needLogin())return;if(PAGE.fan&&PAGE.fan.mine){toast('오늘 응원은 이미 보냈어요. 내일 또 만나요');return}
  burst(b);b.classList.add('on');try{PAGE.fan=Object.assign(PAGE.fan||{},await rpc('cheer',{pid:+b.dataset.pid}));track('cheer',{m:{pid:+b.dataset.pid}});refreshFan();toast(PAGE.fan.streak>1?`${PAGE.fan.streak}일 연속 응원 중이에요`:'응원을 보냈어요')}catch(err){b.classList.remove('on');toast(errMsg(err))}return}
 if(a==='best'){e.stopPropagation();if(needLogin())return;const w=PAGE.works[+b.dataset.i];if(!w)return;const m=w.type==='영화'?'movie':'tv';
  try{PAGE.fan=Object.assign(PAGE.fan||{},await rpc('pick_best',{pid:PAGE.pid,tid:+w.id,med:m,ttl:w.title,pst:w.poster||null}));track('best_pick',{m:{pid:PAGE.pid,id:w.id}});refreshFan();burst(b);toast(`${w.title}, 내 인생작으로 골랐어요`)}catch(err){toast(errMsg(err))}return}
 if(a==='dream-add'){if(needLogin())return;b.disabled=true;
  try{await rpc('add_candidate',{rid:+b.dataset.rid,nm:b.dataset.nm,pitch:null});track('dream_add',{r:+b.dataset.rid});toast('후보로 올리고 한 표 넣었어요');const card=b.closest('.dr');if(card){card.classList.add('done');b.textContent='후보 등록 완료'}}catch(err){b.disabled=false;toast(errMsg(err))}return}
});
