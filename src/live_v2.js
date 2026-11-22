
/* ================= v2: 홈 피드(시안 B) + 보드 카드(시안 C) + 모바일 하단 탭 ================= */
const tPoster=t=>(t&&t.work&&t.work.poster)||IMG['w:'+(t&&t.id)]||'';
const tBack=t=>(t&&t.work&&t.work.backdrop)||tPoster(t);
const phStyle=u=>u?` style="background-image:url('${esc(u)}')"`:'';
let HOMEV=false,HOME={calls:[],posts:[],busy:false,at:0};
async function loadNames(names){const need=[...new Set(names)].filter(n=>n&&!(('p:'+n) in IMG)).slice(0,38);if(!need.length)return;
 try{const r=await fetch(SB_URL+'/functions/v1/tmdb',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ANON,apikey:ANON},body:JSON.stringify({names:need,titles:[]})});if(r.ok){const d=await r.json();for(const n in d.p)IMG['p:'+n]=d.p[n];need.forEach(n=>{if(!(('p:'+n) in IMG))IMG['p:'+n]=''});try{localStorage.setItem('tmdbImg2',JSON.stringify(IMG))}catch(e){}}}catch(e){}}
async function loadHome(force){if(HOME.busy||(!force&&Date.now()-HOME.at<30000))return;HOME.busy=true;
 try{const open=TOPICS.filter(isOpen).slice(0,8);
  const [roles,sheets]=await Promise.all([sb.from('roles').select('id,topic_id,ch,pos,kind,stage,actor').in('topic_id',open.map(t=>t.id)).order('pos'),sb.from('v_sheets').select('*').order('likes',{ascending:false}).order('updated_at',{ascending:false}).limit(12)]);
  const tallies=await Promise.all(open.map(t=>rpc('topic_tally',{tid:t.id}).catch(()=>[])));
  HOME.calls=open.map((t,i)=>{const rs=(roles.data||[]).filter(r=>r.topic_id===t.id&&!isSync(r)&&r.stage!=='cast'&&r.stage!=='airing');const r=rs[0];if(!r)return null;
   const cs=(tallies[i]||[]).filter(c=>c.role_id===r.id).sort((a,b)=>b.votes-a.votes).slice(0,3);const tot=(tallies[i]||[]).filter(c=>c.role_id===r.id).reduce((a,c)=>a+c.votes,0);return {t,r,cs,tot}}).filter(Boolean);
  const sh=sheets.data||[],cids=[...new Set(sh.flatMap(s=>Object.values(s.picks||{}).map(p=>p.c).filter(Boolean)))],tids=[...new Set(sh.map(s=>s.topic_id))];
  const [cands,sroles]=await Promise.all([cids.length?sb.from('candidates').select('id,name').in('id',cids):{data:[]},tids.length?sb.from('roles').select('id,topic_id,ch,pos,kind').in('topic_id',tids).order('pos'):{data:[]}]);
  const cn={};(cands.data||[]).forEach(c=>cn[c.id]=c.name);
  HOME.posts=sh.map(s=>({s,t:TOPICS.find(t=>t.id===s.topic_id),cast:(sroles.data||[]).filter(r=>r.topic_id===s.topic_id&&s.picks[r.id]).map(r=>({ch:r.ch,kind:r.kind,name:s.picks[r.id].c?cn[s.picks[r.id].c]:s.picks[r.id].n,y:s.picks[r.id].y}))})).filter(p=>p.t);
  HOME.at=Date.now();
  const names=[...HOME.calls.flatMap(c=>c.cs.map(x=>x.name)),...HOME.posts.flatMap(p=>p.cast.filter(c=>c.kind!=='option').map(c=>c.name)),...FANB.map(f=>f.name)];
  if(HOMEV)renderHome();await loadNames(names);
 }catch(e){}HOME.busy=false;if(HOMEV)renderHome()}
const IC={heart:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-4.4-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.6-9.5 9-9.5 9z"/></svg>',
 chat:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
 send:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>',
 home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z"/></svg>',
 grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
 plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/></svg>',
 star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>',
 user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>'};
const initial=n=>esc(String(n||'?')[0]);
function photo(n,cls='ph'){const u=IMG['p:'+n];return `<span class="${cls}"${phStyle(u)}>${u?'':initial(n)}</span>`}
function renderHome(){const box=$('#home');if(!box)return;
 const st=FANB.slice(0,12).map(f=>`<a class="story" href="#a/${encodeURIComponent(f.name)}"><span class="ring"><i${phStyle(IMG['p:'+f.name])}>${IMG['p:'+f.name]?'':initial(f.name)}</i></span><span>${esc(f.name)}</span></a>`).join('');
 const calls=HOME.calls.map(c=>`<a class="call" href="#${esc(c.t.id)}"><div class="cv"${phStyle(tBack(c.t))}><small>D-${dleft(c.t)}</small><b>${esc(c.t.title)}<br><span style="font:700 14px 'Noto Sans KR',sans-serif">${esc(c.r.ch)} 역은 누구?</span></b></div>
  <div class="who">${c.cs.length?c.cs.map((x,i)=>`<div>${photo(x.name)}<b>${i+1}. ${esc(x.name)}</b><small style="color:var(--mute)">${c.tot?Math.round(x.votes/c.tot*100)+'%':'첫 표를 기다려요'}</small></div>`).join(''):'<p class="sub" style="grid-column:1/-1;margin:0">아직 후보가 없어요. 첫 후보를 올려 보세요</p>'}</div>
  <div class="foot2"><span>${esc(CATS.find(x=>x.id===c.t.cat).name)}</span><span>${fmt(c.tot)}표</span></div></a>`).join('');
 const posts=HOME.posts.map(p=>{const cast=p.cast.slice(0,4);return `<article class="post"><header><span class="pa" aria-hidden="true">${initial(p.s.nickname)}</span><div style="display:flex;flex-direction:column;min-width:0"><a href="#u/${encodeURIComponent(p.s.nickname)}"><b>${esc(p.s.nickname)}</b></a><a href="#${esc(p.t.id)}" class="sub">${esc(p.t.title)} 캐스팅 시트</a></div></header>
  <div class="media"${phStyle(p.s.poster_url||tPoster(p.t))}><h3>${esc(p.t.title)}</h3><div class="cast" style="grid-template-columns:repeat(${Math.max(1,cast.length)},minmax(0,1fr))">${cast.map(c=>`<div>${c.kind==='option'?`<span class="ph" style="background:#141414">${initial(c.name)}</span>`:photo(c.name)}<small>${esc(c.ch)}</small><b>${esc(c.name||'')}${c.y?` (${c.y})`:''}</b></div>`).join('')}</div></div>
  <div class="bar"><button data-act="hlike" data-sid="${p.s.id}" aria-label="공감">${IC.heart}</button><a href="#${esc(p.t.id)}" aria-label="토론 보기" style="color:var(--ink);min-width:44px;min-height:44px;display:grid;place-items:center">${IC.chat}</a><button data-act="hshare" data-sid="${p.s.id}" aria-label="공유 문구 복사">${IC.send}</button><a class="mk" href="#${esc(p.t.id)}">나도 시트 만들기</a></div>
  <div class="cap"><b>공감 ${fmt(p.s.likes)}개</b>${p.s.reason?`<p style="margin:4px 0 0"><b>${esc(p.s.nickname)}</b> ${esc(p.s.reason)}</p>`:''}</div></article>`}).join('');
 box.innerHTML=`${st?`<div class="stories" aria-label="배우 팬 채널">${st}</div>`:''}
 <section class="hsec"><div class="sh"><h2>이번 주 캐스팅 콜</h2><span class="sub">배역마다 한 사람 한 표</span></div><div class="calls">${calls||'<p class="empty3">불러오는 중이에요</p>'}</div></section>
 <section class="hsec"><div class="sh"><h2>캐스팅 시트 피드</h2><span class="sub">공감 순</span></div>${posts||`<div class="post" style="padding:18px"><b>아직 올라온 캐스팅 시트가 없어요</b><p class="sub" style="margin:6px 0 12px">작품을 골라 첫 시트를 올리면 이 피드의 첫 게시물이 돼요.</p>${HOME.calls[0]?`<a class="b buy" href="#${esc(HOME.calls[0].t.id)}" style="display:inline-block;padding:10px 16px;text-decoration:none">${esc(HOME.calls[0].t.title)} 시트 만들기</a>`:''}</div>`}</section>`}
function showHome(on){HOMEV=on;const h=$('#home'),s=$('#topicView');if(h)h.hidden=!on;if(s)s.hidden=on;if(on){renderHome();loadHome()}renderTabbar()}
function renderTabbar(){const b=$('#tabbar');if(!b)return;const h=location.hash.slice(1),me=PROF?'#u/'+encodeURIComponent(PROF.nickname):'#me';
 const it=[['#','홈',IC.home,!h],['#explore','탐색',IC.grid,h==='explore'],['#make','만들기',IC.plus,false],['#actors','배우',IC.star,h.startsWith('a/')||h==='actors'],[me,'나',IC.user,h.startsWith('u/')]];
 b.innerHTML=it.map(x=>`<a href="${x[0]}" class="${x[3]?'on':''}" ${x[3]?'aria-current="page"':''}>${x[2]}<span>${x[1]}</span></a>`).join('')}
/* 특수 주소: 홈, 탐색, 만들기, 배우, 나 */
function navSpecial(h){if(!h||h==='home'){showHome(false);showDeck(true);renderTabbar();return}showDeck(false);
 if(h==='explore'){showHome(true);track('explore_view');return}
 if(h==='make'){if(!HOMEV&&D){const b=document.querySelector('.sheet [data-act=sheet]');if(b){b.closest('.sheet').scrollIntoView({behavior:'smooth'});return}}$('#propBox').open=true;$('#propBox').scrollIntoView({behavior:'smooth'});return}
 if(h==='actors'){$('#fanb').scrollIntoView({behavior:'smooth'});setTimeout(()=>{const i=$('#aSearch');if(i)i.focus()},400);return}
 if(h==='me'){if(needLogin())return;if(PROF)location.hash='u/'+encodeURIComponent(PROF.nickname);return}
 showHome(true)}
document.addEventListener('submit',e=>{if(e.target.id!=='gs')return;e.preventDefault();const q=$('#gq').value.trim();if(!q)return;
 const t=TOPICS.find(x=>x.title.replace(/\s/g,'')===q.replace(/\s/g,''))||TOPICS.find(x=>x.title.includes(q));
 location.hash=t?t.id:'a/'+encodeURIComponent(q);$('#gq').value=''});
