/* ================= 작품 페이지 탭: 투표, VS, 팀, 토론, 정보 ================= */
var TTABS=[['vote','🗳️','투표'],['vs','⚡','VS'],['team','👥','팀'],['talk','💬','토론'],['info','🎬','정보']];
var TTAB='vote',TTAB_NEXT=null,TF={f:'all',sort:'hot'};
(function setupTopicTabs(){const tv=$('#topicView');if(!tv||$('#tTabs'))return;const th=tv.querySelector('.th');
 const nav=document.createElement('nav');nav.id='tTabs';nav.className='ttabs';nav.setAttribute('aria-label','작품 메뉴');
 nav.innerHTML=TTABS.map(([k,ic,l])=>`<button data-act="ttab" data-k="${k}" class="${k===TTAB?'on':''}"><span aria-hidden="true">${ic}</span>${l}<i id="tt_${k}"></i></button>`).join('');
 th.after(nav);
 const pane=k=>{const d=document.createElement('div');d.className='tpane';d.dataset.k=k;return d};
 const P=Object.fromEntries(TTABS.map(([k])=>[k,pane(k)]));let at=nav;for(const k of ['vote','vs','team','talk','info']){at.after(P[k]);at=P[k]}
 const mv=(k,el)=>{if(el)P[k].appendChild(el)};
 mv('vote',$('#cTitle')&&$('#cTitle').parentElement);mv('vote',$('#chart')&&$('#chart').parentElement);
 const rh=[...tv.querySelectorAll('.sh h2')].find(h=>h.textContent.trim()==='배역 보드');mv('vote',rh&&rh.parentElement);mv('vote',$('#roles'));
 mv('vs',$('#duel'));mv('team',$('#talkBox'));mv('team',$('#sideTop'));
 const fd=document.createElement('section');fd.id='tFeed';fd.className='tfeed';P.talk.appendChild(fd);
 for(const id of ['tWork','tStats','tWatch','poster'])mv('info',$('#'+id));
 setTTab('vote')})();
function setTTab(k,f){TTAB=k;if(f!==undefined)TF.f=f;document.querySelectorAll('#tTabs button').forEach(b=>b.classList.toggle('on',b.dataset.k===k));
 document.querySelectorAll('.tpane').forEach(p=>p.classList.toggle('on',p.dataset.k===k));if(k==='talk')renderTFeed();
 if(k==='vs'&&!$('#duel').innerHTML.trim()){try{newDuel(true)}catch(e){}}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act="ttab"]');if(!b)return;e.preventDefault();setTTab(b.dataset.k,b.dataset.f);
 const nav=$('#tTabs');if(nav&&b.closest('.tpane'))nav.scrollIntoView({behavior:'smooth',block:'start'});try{track('topic_tab',{t:SEL,m:{k:b.dataset.k}})}catch(err){}});
addEventListener('hashchange',()=>{const h=decodeURIComponent(location.hash.slice(1));if(h.endsWith('/talk'))TTAB_NEXT='team';else if(h.endsWith('/feed'))TTAB_NEXT='talk'});

/* ===== 하나로 합친 토론: 작품 전체 글, 팀 글, 배역 글이 한 목록에 ===== */
function tfTag(c){const cb=(TALK.combos||[]).find(x=>x.ckey===c.ckey);
 if(c.role_id)return `<span class="tg r">${esc((c.role_ch||'').replace(/\s*\(.*\)$/,''))} 역${c.cand_name?`, ${esc(c.cand_name)} 지지`:''}</span>`;
 if(c.ckey)return `<span class="tg c">👥 ${cb?esc(Object.values(cb.picks||{}).slice(0,3).join(', ')):'캐스팅 팀'}${cb&&Object.keys(cb.picks||{}).length>3?' 외':''}</span>`;return ''}
function renderTFeed(){const box=$('#tFeed');if(!box||!D)return;const all=D.comments||[];const cnt=all.filter(c=>!c.parent_id).length,tt=$('#tt_talk');if(tt)tt.textContent=cnt?cnt:'';
 if(TTAB!=='talk')return;
 const roles=(D.roles||[]).filter(r=>!isSync(r)),myC=(TALK.combos||[]).find(c=>c.mine);
 const chips=[['all','전체'],['gen','작품 이야기'],...(myC?[['c'+myC.ckey,'내 팀']]:[]),...roles.map(r=>['r'+r.id,(r.ch||'').replace(/\s*\(.*\)$/,'')])];
 if(TF.f.startsWith('c')&&!chips.some(x=>x[0]===TF.f))chips.push([TF.f,'이 팀']);
 const ok=c=>TF.f==='all'||(TF.f==='gen'&&!c.role_id&&!c.ckey)||(TF.f[0]==='r'&&c.role_id===+TF.f.slice(1))||(TF.f[0]==='c'&&c.ckey===TF.f.slice(1));
 const top=all.filter(c=>!c.parent_id&&ok(c)).sort(TF.sort==='hot'?(a,b)=>b.up-a.up||new Date(b.created_at)-new Date(a.created_at):(a,b)=>new Date(b.created_at)-new Date(a.created_at));
 const kids=id=>all.filter(x=>x.parent_id===id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
 const item=(c,re)=>{const liked=D.cliked.has(c.id);return `<div class="tf${re?' re':''}"><div class="tf-h"><b>${esc(c.nickname||'')}</b><small>${new Date(c.created_at).toLocaleDateString('ko-KR')}</small>${re?'':tfTag(c)}</div>
  ${c.hidden?`<details class="folded"><summary>별로예요가 많아 접힌 글이에요</summary>${esc(c.body)}</details>`:`<p>${esc(c.body)}</p>`}
  <div class="tf-a"><button class="lk${liked?' on':''}" data-act="likec" data-id="${c.id}" ${c.mine?'disabled':''} aria-label="공감">♥ ${fmt(c.up)}</button>${re?'':`<button data-act="tf-re" data-id="${c.id}">답글${kids(c.id).length?` ${kids(c.id).length}`:''}</button>`}${c.mine?`<button data-act="tdel" data-id="${c.id}">삭제</button>`:`<button class="meh" data-act="tf-meh" data-id="${c.id}">별로예요</button>`}</div>
  ${re?'':`<div class="tf-rf" id="tfr${c.id}" hidden><input type="text" maxlength="500" placeholder="답글 쓰기" aria-label="답글"><button class="b sm" data-act="tf-post" data-parent="${c.id}">등록</button></div>`}</div>`};
 const tagOpts=`<option value="">작품 전체 이야기</option>${myC?`<option value="c${myC.ckey}">내 캐스팅 팀 이야기</option>`:''}${roles.map(r=>`<option value="r${r.id}">${esc((r.ch||'').replace(/\s*\(.*\)$/,''))} 역 이야기</option>`).join('')}`;
 box.innerHTML=`<div class="sh"><h2>토론</h2><span class="sub">배역 카드 의견과 팀 이야기가 여기 모두 모여요</span></div>
 <div class="tf-form"><textarea id="tfNew" maxlength="500" rows="2" placeholder="${USER?'이 캐스팅에 대한 생각. 근거를 들면 공감을 더 받아요':'로그인하면 글을 쓸 수 있어요'}"></textarea><div class="tf-row"><select id="tfTag" aria-label="글 주제">${tagOpts}</select><button class="b sm buy" data-act="tf-post">글 쓰기</button></div></div>
 <div class="tf-chips" role="tablist">${chips.map(([k,l])=>`<button class="${TF.f===k?'on':''}" data-act="tf-f" data-k="${k}">${esc(l)}</button>`).join('')}</div>
 <div class="tf-sort"><button class="${TF.sort==='hot'?'on':''}" data-act="tf-s" data-k="hot">공감순</button><button class="${TF.sort==='new'?'on':''}" data-act="tf-s" data-k="new">최신순</button><span>${top.length}개</span></div>
 ${top.map(c=>item(c)+kids(c.id).map(k=>item(k,true)).join('')).join('')||'<p class="empty3">아직 글이 없어요. 첫 의견을 남겨 주세요</p>'}
 <p class="dl">공감이 많은 글이 위로 올라가요. 별로예요가 5개 이상이면서 공감의 두 배를 넘으면 접혀요.</p>`;
 if(TF.f[0]==='r'||TF.f[0]==='c'){const sel=$('#tfTag');if(sel&&[...sel.options].some(o=>o.value===TF.f))sel.value=TF.f}}
async function tfPost(parent){if(needLogin())return;const inp=parent?document.querySelector(`#tfr${parent} input`):$('#tfNew');const tx=(inp&&inp.value||'').trim();if(!tx)return toast('내용을 적어 주세요');
 const tag=parent?'':($('#tfTag')||{}).value||'';try{await rpc('post_talk',{tid:SEL,ck:tag[0]==='c'?tag.slice(1):null,rid:tag[0]==='r'?+tag.slice(1):null,cid:null,parent:parent||null,txt:tx});toast('올렸어요');await loadTopic();renderTFeed();try{loadTalk(SEL)}catch(e){}}catch(err){toast(errMsg(err))}}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-act^="tf-"]');if(!b)return;const a=b.dataset.act;
 if(a==='tf-f'){TF.f=b.dataset.k;renderTFeed();return}
 if(a==='tf-s'){TF.sort=b.dataset.k;renderTFeed();return}
 if(a==='tf-re'){const f=$('#tfr'+b.dataset.id);if(f){f.hidden=!f.hidden;if(!f.hidden)f.querySelector('input').focus()}return}
 if(a==='tf-post'){b.disabled=true;await tfPost(b.dataset.parent?+b.dataset.parent:null);b.disabled=false;return}
 if(a==='tf-meh'){if(needLogin())return;try{await rpc('vote_thread',{cid:+b.dataset.id,val:-1});toast('의견을 반영했어요');await loadTopic();renderTFeed()}catch(err){toast(errMsg(err))}return}});
