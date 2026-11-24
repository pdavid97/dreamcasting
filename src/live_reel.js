/* ================= 슬롯 릴: 드롭다운 대신 위아래로 돌리는 빠찡코식 선택기 ================= */
var WKP={};
async function wkPosters(ws){const need=[...new Set(ws.map(w=>w.tk).filter(k=>k&&!(k in WKP)))].slice(0,40);if(!need.length)return;need.forEach(k=>WKP[k]='');
 try{const r=await fetch(SB_URL+'/functions/v1/tmdb',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ANON,apikey:ANON},body:JSON.stringify({works:need})});if(r.ok){const d=await r.json();Object.assign(WKP,d.k||{})}}catch(e){}}
const RH=58;
function reelImg(sel,o){if(sel.id.startsWith('sp')){if(!o.value)return{ic:'?'};if(o.value==='__n')return{ic:'✎'};return{u:IMG['p:'+o.textContent.trim()]||'',ic:(o.textContent.trim()||'?')[0]}}
 if(sel.id.startsWith('sy')){if(!o.value)return{ic:'지금'};const [yy,wi,tt]=o.value.split('|');let tk='';for(const k in ERA){const w=(ERA[k]||[]).find(x=>wi?String(x.wi)===wi:(String(x.y)===yy&&x.t.slice(0,60)===tt));if(w){tk=w.tk;break}}return{u:tk?WKP[tk]||'':'',ic:o.value.split('|')[0],poster:1}}return{ic:''}}
function reelify(sel){return;let rl=sel.nextElementSibling&&sel.nextElementSibling.classList&&sel.nextElementSibling.classList.contains('reel')?sel.nextElementSibling:null;
 if(!rl){rl=document.createElement('div');rl.className='reel';sel.classList.add('reel-src');sel.after(rl);
  new MutationObserver(()=>drawReel(sel,rl)).observe(sel,{childList:true});
  sel.addEventListener('change',()=>{if(!rl._self)reelTo(rl,sel.selectedIndex,false);rl._self=false})}
 drawReel(sel,rl)}
function drawReel(sel,rl){const os=[...sel.options];const lab=sel.getAttribute('aria-label')||'';
 rl.innerHTML=`<button type="button" class="rl-b up" aria-label="이전" data-d="-1">▲</button><div class="rl-win" tabindex="0" role="listbox" aria-label="${esc(lab)}"><div class="rl-pad"></div>${os.map((o,i)=>{const m=reelImg(sel,o);return `<div class="rl-it${m.poster?' ps':''}" role="option" data-i="${i}"><span class="rl-ph"${m.u?` style="background-image:url('${esc(m.u)}')"`:''}>${m.u?'':esc(m.ic||'')}</span><span class="rl-tx">${esc(o.textContent)}</span></div>`}).join('')}<div class="rl-pad"></div></div><span class="rl-frame" aria-hidden="true"></span><button type="button" class="rl-b dn" aria-label="다음" data-d="1">▼</button>`;
 const win=rl.querySelector('.rl-win');let t=null,last=-1;
 win.addEventListener('scroll',()=>{const i=Math.round(win.scrollTop/RH);if(i!==last){last=i;rl.querySelectorAll('.rl-it').forEach((e,k)=>e.classList.toggle('on',k===i));try{navigator.vibrate&&navigator.vibrate(4)}catch(e){}}
  clearTimeout(t);t=setTimeout(()=>{if(i>=0&&i<sel.options.length&&sel.selectedIndex!==i){sel.selectedIndex=i;rl._self=true;sel.dispatchEvent(new Event('change',{bubbles:true}))}},160)},{passive:true});
 win.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();reelTo(rl,Math.round(win.scrollTop/RH)+(e.key==='ArrowDown'?1:-1),true)}});
 rl.querySelectorAll('.rl-b').forEach(b=>b.onclick=()=>reelTo(rl,Math.round(win.scrollTop/RH)+ +b.dataset.d,true));
 rl.querySelectorAll('.rl-it').forEach(e=>e.onclick=()=>reelTo(rl,+e.dataset.i,true));
 reelTo(rl,Math.max(0,sel.selectedIndex),false)}
function reelTo(rl,i,smooth){const win=rl.querySelector('.rl-win');if(!win)return;const n=rl.querySelectorAll('.rl-it').length;i=Math.max(0,Math.min(n-1,i));win.scrollTo({top:i*RH,behavior:smooth?'smooth':'auto'});rl.querySelectorAll('.rl-it').forEach((e,k)=>e.classList.toggle('on',k===i))}
function reelAll(root){(root||document).querySelectorAll('select[id^="sp"],select[id^="sy"]').forEach(reelify)}
/* DB에 출연 기록이 없는 배우: TMDB 출연작으로 "작품 속 모습"을 채움 */
async function filmoFallback(nm){try{if(typeof loadOrig==='function')await loadOrig([nm]);const alt=(typeof ORIG!=='undefined'&&ORIG[nm])||'';
 const r=await fetch(SB_URL+'/functions/v1/tmdb',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ANON,apikey:ANON},body:JSON.stringify({filmo:nm,alt})});if(!r.ok)return [];const d=await r.json();
 if(d.p&&!IMG['p:'+nm])IMG['p:'+nm]=d.p;return (d.f||[]).map(x=>{if(x.tk&&x.p)WKP[x.tk]=x.p;return {wi:'',tk:x.tk,t:x.t,y:x.y,ch:x.ch}})}catch(e){return []}}
/* ===== 내 팀 꾸미기: 위아래로 배우, 좌우로 그 배우의 작품 속 모습. 랜덤 돌리기는 좌우 ===== */
var SLT={ri:0};
const slBig=u=>u?u.replace('/w185/','/w342/'):'';
function slotRoles(){return D?D.roles.filter(r=>!isSync(r)&&document.getElementById('sp'+r.id)):[]}
function eraVal(w){return `${w.y}|${w.wi||''}|${w.t.slice(0,60)}`}
function slotStage(box){const host=box.querySelector('.sheet');if(!host)return;let st=host.querySelector('#slotStage');if(!st){st=document.createElement('div');st.id='slotStage';st.className='slt';host.insertBefore(st,host.querySelector('.sb'))}
 const rs=slotRoles();if(!rs.length){st.remove();return}if(SLT.ri>=rs.length)SLT.ri=0;const r=rs[SLT.ri],sp=$('#sp'+r.id);
 const picked=x=>{const s=$('#sp'+x.id);return s&&s.value};
 const os=[...sp.options].map((o,i)=>({i,o})).filter(x=>x.o.value);
 st.innerHTML=`<div class="sl-roles">${rs.map((x,k)=>`<button type="button" class="${k===SLT.ri?'on':''}${picked(x)?' ok':''}" data-act="sl-role" data-k="${k}">${picked(x)?'✓ ':''}${esc(String(x.ch||'').replace(/\s*\(.*\)$/,''))}</button>`).join('')}</div>
 <p class="sl-hint">위아래로 배우, 좌우로 그 배우의 작품 속 모습</p>
 <div class="sl-box"><span class="sl-pay l" aria-hidden="true"></span><span class="sl-pay r" aria-hidden="true"></span><div class="sl-win" tabindex="0" role="listbox" aria-label="${esc(r.ch)} 배우 고르기"><div class="sl-pad"></div>${os.map(({i,o})=>{const m=reelImg(sp,o);return `<div class="sl-it" data-i="${i}" role="option"><div class="sl-h"><div class="sl-sl" data-v=""><span class="sl-img"${m.u?` style="background-image:url('${esc(slBig(m.u))}')"`:''}>${m.u?'':`<i>${esc(m.ic||'')}</i>`}</span><span class="sl-cap"><b>${esc(o.textContent)}</b><small>${o.value==='__n'?'후보에 없는 배우':'지금의 모습'}</small></span></div></div><span class="sl-cnt"></span></div>`}).join('')}<div class="sl-pad"></div></div></div>
 ${sp.value==='__n'?`<input class="sl-name" type="text" maxlength="20" placeholder="배우 이름을 적어 주세요" value="${esc(($('#sn'+r.id)||{value:''}).value)}" data-mirror="sn${r.id}">`:''}
 <p class="sl-age">${esc(($('#sa'+r.id)||{textContent:''}).textContent||'')}</p>
 <div class="sl-acts"><button type="button" class="sl-rand" data-act="sl-rand">🎰 랜덤 시절</button><button type="button" class="sl-go" data-act="sl-go">${SLT.ri<rs.length-1?'이 모습으로, 다음 배역':'이 모습으로, 완성'}</button></div>`;
 const win=st.querySelector('.sl-win'),items=[...win.querySelectorAll('.sl-it')],H=()=>items[0]?items[0].offsetHeight+12:330;
 const mark=j=>items.forEach((e,k)=>e.classList.toggle('on',k===j));
 const applyActor=j=>{const it=items[j];if(!it)return;const k=+it.dataset.i;if(sp.selectedIndex!==k){sp.selectedIndex=k;sp._slot=true;sp.dispatchEvent(new Event('change',{bubbles:true}));const ag=st.querySelector('.sl-age');setTimeout(()=>{if(ag)ag.textContent=($('#sa'+r.id)||{textContent:''}).textContent},400)}fillEras(r,it)};
 st._apply=()=>applyActor(Math.round(win.scrollTop/H()));
 let start=items.findIndex(e=>+e.dataset.i===sp.selectedIndex);if(start<0)start=0;requestAnimationFrame(()=>{win.scrollTop=start*H();mark(start);fillEras(r,items[start])});
 let t=null,last=start;win.onscroll=()=>{const j=Math.round(win.scrollTop/H());if(j!==last){last=j;mark(j);try{navigator.vibrate&&navigator.vibrate(4)}catch(e){}}clearTimeout(t);t=setTimeout(()=>applyActor(j),200)};
 win.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();win.scrollTo({top:(Math.round(win.scrollTop/H())+(e.key==='ArrowDown'?1:-1))*H(),behavior:'smooth'})}if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const h=items[Math.round(win.scrollTop/H())].querySelector('.sl-h');h.scrollBy({left:(e.key==='ArrowRight'?1:-1)*h.clientWidth,behavior:'smooth'})}};
 items.forEach((e,k)=>e.addEventListener('click',()=>{if(k!==Math.round(win.scrollTop/H())){clearTimeout(t);win.scrollTo({top:k*H(),behavior:'smooth'})}}))}
/* 가운데 배우 카드 안에 좌우로 넘기는 작품 속 모습 슬라이드를 채움 */
async function fillEras(r,it){if(!it)return;const sp=$('#sp'+r.id),o=sp.options[+it.dataset.i];if(!o||o.value==='__n'||it._filled)return;it._filled=true;const nm=o.textContent.trim();
 const ws=await eraWorks(nm);if(!it.isConnected)return;const h=it.querySelector('.sl-h');
 h.insertAdjacentHTML('beforeend',ws.slice(0,40).map(w=>`<div class="sl-sl ps" data-v="${esc(eraVal(w))}" data-tk="${esc(w.tk||'')}"><span class="sl-img"${w.tk&&WKP[w.tk]?` style="background-image:url('${esc(slBig(WKP[w.tk]))}')"`:''}>${w.tk&&WKP[w.tk]?'':`<i>${w.y}</i>`}</span><span class="sl-cap"><b>${esc(w.t)} (${w.y})</b><small>${w.ch?esc(w.ch)+' 역, ':''}이 작품 속 모습</small></span></div>`).join(''));
 const n=h.children.length,cnt=it.querySelector('.sl-cnt');const sy=$('#sy'+r.id);
 const upd=()=>{const j=Math.round(h.scrollLeft/h.clientWidth);cnt.innerHTML=n>1?`<b>‹</b> ${j===0?'지금':`작품 ${j} / ${n-1}`} <b>›</b>`:'';return j};upd();
 const cur=sy&&sy.value?[...h.children].findIndex(x=>x.dataset.v===sy.value):-1;if(cur>0)h.scrollLeft=cur*h.clientWidth;upd();
 let t=null;h.onscroll=()=>{const j=upd();clearTimeout(t);t=setTimeout(()=>applyEra(r,it,j),220)}}
function applyEra(r,it,j){const sp=$('#sp'+r.id),sy=$('#sy'+r.id),k=+it.dataset.i;if(!sy)return;if(sp.selectedIndex!==k){sp.selectedIndex=k;sp._slot=true;sp.dispatchEvent(new Event('change',{bubbles:true}))}
 const sl=it.querySelector('.sl-h').children[j];if(!sl)return;const v=sl.dataset.v;
 const set=()=>{if([...sy.options].some(o=>o.value===v)){if(sy.value!==v){sy.value=v;sy._slot=true;sy.dispatchEvent(new Event('change',{bubbles:true}))}const ag=$('#slotStage .sl-age');if(ag)ag.textContent=($('#sa'+r.id)||{textContent:''}).textContent;return true}return false};
 if(!set()){sy.dataset.pre=v;setTimeout(set,600)}
 if(v&&sl.dataset.tk&&!sl._shot){sl._shot=true;taggedShot(o2n(sp),sl.dataset.tk).then(u=>{if(u){const im=sl.querySelector('.sl-img');im.style.backgroundImage=`url('${u}')`;im.innerHTML='';sl.classList.add('shot')}})}}
function o2n(sp){return sp.selectedOptions[0]?sp.selectedOptions[0].textContent.trim():''}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act^="sl-"]');if(!b)return;const a=b.dataset.act,rs=slotRoles(),box=$('#sideTop');
 if(a==='sl-role'){SLT={ri:+b.dataset.k}}
 else if(a==='sl-rand'){const it=$('#slotStage .sl-it.on'),h=it&&it.querySelector('.sl-h');if(!h||h.children.length<2){toast('작품 목록을 불러오는 중이에요');return}const n=h.children.length,target=1+Math.floor(Math.random()*Math.min(n-1,20));let k=0;const steps=16;
  const tick=()=>{const j=k>=steps-1?target:1+Math.floor(Math.random()*(n-1));h.scrollTo({left:j*h.clientWidth,behavior:'auto'});try{navigator.vibrate&&navigator.vibrate(3)}catch(e){}k++;if(k<steps)setTimeout(tick,45+Math.pow(k/steps,3)*320)};tick();return}
 else if(a==='sl-go'){const st0=$('#slotStage');if(st0&&st0._apply)st0._apply();const r=rs[SLT.ri],sp=r&&$('#sp'+r.id);if(!sp||!sp.value){toast('배우를 골라 주세요');return}
  if(SLT.ri<rs.length-1)SLT={ri:SLT.ri+1};else{const ta=$('#sReason');if(ta){ta.scrollIntoView({behavior:'smooth',block:'center'});ta.focus()}return}}
 if(box)slotStage(box)});
document.addEventListener('input',e=>{const m=e.target.dataset&&e.target.dataset.mirror;if(!m)return;const s=document.getElementById(m);if(s){s.value=e.target.value;s.dispatchEvent(new Event('change',{bubbles:true}))}});
document.addEventListener('change',e=>{const t=e.target;if(t&&t._slot)t._slot=false});
