/* ================= 슬롯 릴: 드롭다운 대신 위아래로 돌리는 빠찡코식 선택기 ================= */
var WKP={};
async function wkPosters(ws){const need=[...new Set(ws.map(w=>w.tk).filter(k=>k&&!(k in WKP)))].slice(0,40);if(!need.length)return;need.forEach(k=>WKP[k]='');
 try{const r=await fetch(SB_URL+'/functions/v1/tmdb',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ANON,apikey:ANON},body:JSON.stringify({works:need})});if(r.ok){const d=await r.json();Object.assign(WKP,d.k||{})}}catch(e){}}
const RH=58;
function reelImg(sel,o){if(sel.id.startsWith('sp')){if(!o.value)return{ic:'?'};if(o.value==='__n')return{ic:'✎'};return{u:IMG['p:'+o.textContent.trim()]||'',ic:(o.textContent.trim()||'?')[0]}}
 if(sel.id.startsWith('sy')){if(!o.value)return{ic:'지금'};const wi=o.value.split('|')[1];let tk='';for(const k in ERA){const w=(ERA[k]||[]).find(x=>String(x.wi)===wi);if(w){tk=w.tk;break}}return{u:tk?WKP[tk]||'':'',ic:o.value.split('|')[0],poster:1}}return{ic:''}}
function reelify(sel){let rl=sel.nextElementSibling&&sel.nextElementSibling.classList&&sel.nextElementSibling.classList.contains('reel')?sel.nextElementSibling:null;
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
