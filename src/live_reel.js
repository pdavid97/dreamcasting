/* ================= 슬롯 릴: 드롭다운 대신 위아래로 돌리는 빠찡코식 선택기 ================= */
var WKP={};
async function wkPosters(ws){const need=[...new Set(ws.map(w=>w.tk).filter(k=>k&&!(k in WKP)))].slice(0,40);if(!need.length)return;need.forEach(k=>WKP[k]='');
 try{const r=await fetch(SB_URL+'/functions/v1/tmdb',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ANON,apikey:ANON},body:JSON.stringify({works:need})});if(r.ok){const d=await r.json();Object.assign(WKP,d.k||{})}}catch(e){}}
const RH=58;
function reelImg(sel,o){if(sel.id.startsWith('sp')){if(!o.value)return{ic:'?'};if(o.value==='__n')return{ic:'✎'};return{u:IMG['p:'+o.textContent.trim()]||'',ic:(o.textContent.trim()||'?')[0]}}
 if(sel.id.startsWith('sy')){if(!o.value)return{ic:'지금'};const [yy,wi,tt]=o.value.split('|');let tk='';for(const k in ERA){const w=(ERA[k]||[]).find(x=>wi?String(x.wi)===wi:(String(x.y)===yy&&x.t.slice(0,60)===tt));if(w){tk=w.tk;break}}return{u:tk?WKP[tk]||'':'',ic:o.value.split('|')[0],poster:1}}return{ic:''}}
function reelify(sel){if(sel.id.startsWith('sy'))new MutationObserver(()=>{const box=$('#sideTop');if(box&&$('#slotStage')&&SLT.step==='e')slotStage(box)}).observe(sel,{childList:true});return;let rl=sel.nextElementSibling&&sel.nextElementSibling.classList&&sel.nextElementSibling.classList.contains('reel')?sel.nextElementSibling:null;
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
/* ===== 내 팀 꾸미기 A안: 한 화면에 큰 릴 하나 (배우 → 시절), 시절은 랜덤 돌리기 ===== */
var SLT={ri:0,step:'a'};
const slBig=u=>u?u.replace('/w185/','/w342/'):'';
function slotRoles(){return D?D.roles.filter(r=>!isSync(r)&&document.getElementById('sp'+r.id)):[]}
function slotStage(box){const host=box.querySelector('.sheet');if(!host)return;let st=host.querySelector('#slotStage');if(!st){st=document.createElement('div');st.id='slotStage';st.className='slt';host.insertBefore(st,host.querySelector('.sb'))}
 const rs=slotRoles();if(!rs.length){st.remove();return}if(SLT.ri>=rs.length)SLT.ri=0;const r=rs[SLT.ri],sp=$('#sp'+r.id),sy=$('#sy'+r.id);
 if(SLT.step==='e'&&(!sy||!sp.value))SLT.step='a';const sel=SLT.step==='a'?sp:sy;
 const picked=x=>{const s=$('#sp'+x.id);return s&&s.value};
 const os=[...sel.options].map((o,i)=>({i,o})).filter(x=>SLT.step==='e'||x.o.value);
 const card=({i,o})=>{const m=reelImg(sel,o),nm=o.textContent.replace(/ 속 모습$/,'');return `<div class="sl-it${m.poster?' ps':''}" data-i="${i}" role="option"><span class="sl-img"${m.u?` style="background-image:url('${esc(slBig(m.u))}')"`:''}>${m.u?'':`<i>${esc(m.ic||'')}</i>`}</span><span class="sl-cap"><b>${esc(nm)}</b>${SLT.step==='e'&&o.value?'<small>이 작품 속 모습</small>':SLT.step==='e'?'<small>지금 나이 그대로</small>':''}</span></div>`};
 st.innerHTML=`<div class="sl-roles">${rs.map((x,k)=>`<button type="button" class="${k===SLT.ri?'on':''}${picked(x)?' ok':''}" data-act="sl-role" data-k="${k}">${picked(x)?'✓ ':''}${esc(String(x.ch||'').replace(/\s*\(.*\)$/,''))}</button>`).join('')}</div>
 <div class="sl-steps"><button type="button" class="${SLT.step==='a'?'on':''}" data-act="sl-step" data-s="a">1. 배우</button><button type="button" class="${SLT.step==='e'?'on':''}" data-act="sl-step" data-s="e" ${sy&&sp.value&&sp.value!=='__n'?'':'disabled'}>2. 어느 시절 모습</button></div>
 <div class="sl-box"><span class="sl-pay l" aria-hidden="true"></span><span class="sl-pay r" aria-hidden="true"></span><div class="sl-win" tabindex="0" role="listbox" aria-label="${esc(r.ch)} ${SLT.step==='a'?'배우':'시절'} 고르기"><div class="sl-pad"></div>${os.map(card).join('')}<div class="sl-pad"></div></div></div>
 ${SLT.step==='a'&&sp.value==='__n'?`<input class="sl-name" type="text" maxlength="20" placeholder="배우 이름을 적어 주세요" value="${esc(($('#sn'+r.id)||{value:''}).value)}" data-mirror="sn${r.id}">`:''}
 <p class="sl-age">${esc(($('#sa'+r.id)||{textContent:''}).textContent||'')}</p>
 <div class="sl-acts">${SLT.step==='e'?'<button type="button" class="sl-rand" data-act="sl-rand">🎰 랜덤 돌리기</button>':''}<button type="button" class="sl-go" data-act="sl-go">${SLT.step==='a'?(sp.value==='__n'?'다음 배역':'이 배우로, 시절 고르기'):(SLT.ri<rs.length-1?'이 모습으로, 다음 배역':'이 모습으로, 완성')}</button></div>`;
 const win=st.querySelector('.sl-win'),items=[...win.querySelectorAll('.sl-it')],H=()=>items[0]?items[0].offsetHeight+12:300;
 const idxOf=k=>items.findIndex(e=>+e.dataset.i===k);
 const mark=j=>items.forEach((e,k)=>e.classList.toggle('on',k===j));
 let start=idxOf(sel.selectedIndex);if(start<0)start=0;requestAnimationFrame(()=>{win.scrollTop=start*H();mark(start)});
 let t=null,last=start;win.onscroll=()=>{const j=Math.round(win.scrollTop/H());if(j!==last){last=j;mark(j);try{navigator.vibrate&&navigator.vibrate(4)}catch(e){}}clearTimeout(t);t=setTimeout(()=>apply(Math.round(win.scrollTop/H())),180)};
 const apply=j=>{const it=items[j];if(!it)return;const k=+it.dataset.i;if(sel.selectedIndex!==k){sel.selectedIndex=k;sel._slot=true;sel.dispatchEvent(new Event('change',{bubbles:true}))}};st._apply=()=>apply(Math.round(win.scrollTop/H()));
 items.forEach((e,k)=>e.onclick=()=>{clearTimeout(t);apply(k);last=k;mark(k);win.scrollTo({top:k*H(),behavior:'smooth'})});
 st._spin=()=>{const n=items.length;if(n<3)return;const ks=items.map(e=>+e.dataset.i);let j=Math.round(win.scrollTop/H()),target=1+Math.floor(Math.random()*(n-1));if(target===j)target=1+(target%(n-1));const steps=22,selId=sel.id;let k=0;
  const tick=()=>{j=k>=steps-1?target:(k>=steps-4?Math.max(1,(target-(steps-1-k)+n)%n):(j+1+Math.floor(Math.random()*3))%n);const w=$('#slotStage .sl-win');if(w){const its=w.querySelectorAll('.sl-it');w.scrollTop=j*(its[0]?its[0].offsetHeight+12:300);its.forEach((e,q)=>e.classList.toggle('on',q===j))}try{navigator.vibrate&&navigator.vibrate(3)}catch(e){}k++;
   if(k<steps)setTimeout(tick,40+Math.pow(k/steps,3)*300);else{const s2=document.getElementById(selId);if(s2&&s2.selectedIndex!==ks[target]){s2.selectedIndex=ks[target];s2._slot=true;s2.dispatchEvent(new Event('change',{bubbles:true}))}const box=$('#sideTop');if(box)setTimeout(()=>slotStage(box),60)}};tick()}}

document.addEventListener('click',e=>{const b=e.target.closest('[data-act^="sl-"]');if(!b)return;const a=b.dataset.act,rs=slotRoles(),box=$('#sideTop');
 if(a==='sl-role'){SLT={ri:+b.dataset.k,step:'a'}}else if(a==='sl-step'){SLT.step=b.dataset.s}
 else if(a==='sl-rand'){const st=$('#slotStage');if(st&&st._spin)st._spin();return}
 else if(a==='sl-go'){const st0=$('#slotStage');if(st0&&st0._apply)st0._apply();const r=rs[SLT.ri],sp=r&&$('#sp'+r.id),sy=r&&$('#sy'+r.id);if(!sp||!sp.value){toast('배우를 골라 주세요');return}
  if(SLT.step==='a'&&sy&&sp.value!=='__n')SLT.step='e';else if(SLT.ri<rs.length-1)SLT={ri:SLT.ri+1,step:'a'};else{const ta=$('#sReason');if(ta){ta.scrollIntoView({behavior:'smooth',block:'center'});ta.focus()}return}}
 if(box)slotStage(box)});
document.addEventListener('input',e=>{const m=e.target.dataset&&e.target.dataset.mirror;if(!m)return;const s=document.getElementById(m);if(s){s.value=e.target.value;s.dispatchEvent(new Event('change',{bubbles:true}))}});
/* 시절 목록이 늦게 도착하면 지금 보는 릴만 다시 그림 */
document.addEventListener('change',e=>{const t=e.target;if(!t.id||!/^s[py]\d/.test(t.id)||t._slot){if(t)t._slot=false;return}const box=$('#sideTop');if(box&&$('#slotStage'))setTimeout(()=>slotStage(box),0)});
