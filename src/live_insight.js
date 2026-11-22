/* ================= 내 캐스팅 리포트: 내 투표를 인포그래픽으로 (본인 페이지에서만) ================= */
const LEADS=['male_lead','female_lead','lead'],SUBS=['male_sub','female_sub','support'];
async function loadInsights(){const box=$('#insight');if(!box)return;box.innerHTML='<p class="sub">내 투표를 그림으로 그리는 중이에요</p>';
 let rows=[];try{rows=await rpc('my_cast_graph',{})||[]}catch(e){box.innerHTML='';return}
 if(rows.length<2){box.innerHTML=`<div class="sh"><h2>내 캐스팅 리포트</h2></div><p class="dl">투표가 쌓이면 내가 자꾸 고르는 배우, 커플, 라이벌 구도를 그림으로 보여드려요. 지금 ${rows.length}표.</p>`;return}
 const names=[...new Set(rows.flatMap(r=>[r.pick,r.orig].filter(Boolean)))];
 try{await loadNames(names)}catch(e){}
 const byT={};rows.forEach(r=>{(byT[r.tid]||(byT[r.tid]={title:r.title,s:{}})).s[r.slot]=r});
 const works=Object.values(byT);
 // 1 최애 배우
 const fav=igCnt(rows.map(r=>r.pick)).slice(0,8);
 // 2 커플(같은 작품의 남주와 여주)
 const couples=[];works.forEach(w=>{const m=w.s.male_lead,f=w.s.female_lead;if(m&&f)couples.push({a:m.pick,b:f.pick,t:w.title})});
 // 3 원작 배우와 내 픽
 const match=rows.filter(r=>r.orig).map(r=>({o:r.orig,p:r.pick,t:r.title,ch:r.ch}));
 // 4 라이벌 구도(같은 성별의 주연과 서브)
 const rivals=[];works.forEach(w=>{[['male_lead','male_sub'],['female_lead','female_sub']].forEach(([a,b])=>{if(w.s[a]&&w.s[b])rivals.push({a:w.s[a].pick,b:w.s[b].pick,ca:w.s[a].ch,cb:w.s[b].ch,t:w.title})})});
 // 5 주연과 조연 쌍
 const ls=[];works.forEach(w=>{LEADS.forEach(a=>SUBS.forEach(b=>{if(w.s[a]&&w.s[b])ls.push({a:w.s[a].pick,b:w.s[b].pick,t:w.title})}))});
 box.innerHTML=`<div class="sh"><h2>내 캐스팅 리포트</h2><span class="sub">작품 ${works.length}편, ${rows.length}표로 그렸어요. 나만 볼 수 있어요.</span></div>
 <div class="ig-grid">
  ${igCard('나도 모르게 계속 고르는 배우',favLine(fav),favBars(fav))}
  ${igCard('나도 모르게 계속 이어주는 커플',pairLine(couples,'커플'),couples.length?pairGraph(couples,'c'):igEmpty('같은 작품에서 남주와 여주를 둘 다 고르면 커플 관계도가 생겨요.'))}
  ${igCard('원작 배우와 내가 매치업한 배우',matchLine(match),match.length?matchFlow(match):igEmpty('원작 배우가 있는 배역에 투표하면 이어져요.'))}
  ${igCard('나도 모르게 계속 붙이는 라이벌 구도',pairLine(rivals,'라이벌'),rivals.length?rivalCards(rivals):igEmpty('같은 작품에서 주연과 같은 성별의 서브를 함께 고르면 라이벌 구도가 보여요.'))}
  ${igCard('주연과 조연, 내 단골 조합',pairLine(ls,'조합'),ls.length?heat(ls):igEmpty('같은 작품에서 주연과 조연을 함께 고르면 히트맵이 채워져요.'))}
 </div>`}
function igCnt(arr){const m={};arr.forEach(k=>{if(k)m[k]=(m[k]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1])}
const jj=(w,a,b)=>{const c=(w||'').trim().slice(-1).charCodeAt(0);return w+(c>=0xac00&&c<=0xd7a3&&(c-0xac00)%28?a:b)};
const igEmpty=t=>`<p class="ig-empty">${esc(t)}</p>`;
function igCard(h,line,body){return `<article class="ig"><h3>${esc(h)}</h3>${line?`<p class="ig-line">${line}</p>`:''}${body}</article>`}
function favLine(f){if(!f.length)return '';const [n,c]=f[0];return c>1?`<b>${esc(n)}</b>, 서로 다른 배역에서 <b>${c}번</b> 골랐어요. 이쯤 되면 최애 인정.`:`아직 한 배우에 몰표는 없어요. 고르게 보는 타입.`}
function favBars(f){const mx=Math.max(...f.map(x=>x[1]));return `<div class="ig-bars">${f.map(([n,c])=>{const u=IMG['p:'+n];return `<div class="ig-bar"><span class="av"${u?` style="background-image:url('${esc(u)}')"`:''}>${u?'':esc(n[0])}</span><span class="nm">${actorLink(n)}</span><i style="--w:${Math.round(c/mx*100)}%"></i><b>${c}</b></div>`}).join('')}</div>`}
function igKey(a,b){return [a,b].sort().join('|')}
function pairLine(arr,word){if(!arr.length)return '';const m=igCnt2(arr);const top=m[0];return top[1]>1?`<b>${esc(jj(top[2].a,'과','와'))}</b> <b>${esc(top[2].b)}</b>, ${top[1]}개 작품에서 ${word}로 묶었어요. 무의식이 밀고 있는 조합.`:`${arr.length}개 ${word} 중 아직 반복된 짝은 없어요. 다음 작품에서 겹치면 알려드릴게요.`}
function igCnt2(arr){const m={};arr.forEach(p=>{const k=igKey(p.a,p.b);(m[k]||(m[k]=[k,0,p,[]]))[1]++;m[k][3].push(p.t)});return Object.values(m).sort((a,b)=>b[1]-a[1])}
/* 관계도: 사람을 원 위에 놓고 짝을 선으로 잇기(선 굵기 = 반복 횟수) */
function pairGraph(arr){const ps=igCnt2(arr).slice(0,12);const ns=[...new Set(ps.flatMap(p=>[p[2].a,p[2].b]))].slice(0,14);const W=320,R=118,cx=160,cy=150;
 const pos={};ns.forEach((n,i)=>{const a=-Math.PI/2+i*2*Math.PI/ns.length;pos[n]=[cx+R*Math.cos(a),cy+R*Math.sin(a)]});
 const edges=ps.filter(p=>pos[p[2].a]&&pos[p[2].b]).map(p=>{const [x1,y1]=pos[p[2].a],[x2,y2]=pos[p[2].b];return `<path d="M${x1},${y1} Q${cx},${cy} ${x2},${y2}" fill="none" stroke="var(--hot)" stroke-opacity="${p[1]>1?.95:.55}" stroke-width="${1.5+p[1]*2}"><title>${esc(p[2].a)} ♥ ${esc(p[2].b)}: ${esc(p[3].join(', '))}</title></path>`}).join('');
 const nodes=ns.map((n,i)=>{const [x,y]=pos[n],u=IMG['p:'+n],id='igc'+i+Math.random().toString(36).slice(2,6);return `<g><clipPath id="${id}"><circle cx="${x}" cy="${y}" r="17"/></clipPath><circle cx="${x}" cy="${y}" r="19" fill="var(--card)" stroke="var(--line)"/>${u?`<image href="${esc(u)}" x="${x-17}" y="${y-17}" width="34" height="34" clip-path="url(#${id})" preserveAspectRatio="xMidYMin slice"/>`:`<text x="${x}" y="${y+5}" text-anchor="middle" font-size="14">${esc(n[0])}</text>`}<text x="${x}" y="${y+(y>cy?34:-24)}" text-anchor="middle" font-size="11" fill="var(--ink)">${esc(n)}</text></g>`}).join('');
 return `<svg class="ig-svg" viewBox="0 0 ${W} 300" role="img" aria-label="커플 관계도">${edges}${nodes}</svg>`}
/* 매치업: 왼쪽 원작 배우, 오른쪽 내 픽, 곡선으로 연결 */
function matchFlow(arr){const os=igCnt(arr.map(x=>x.o)).map(x=>x[0]).slice(0,8),ps=igCnt(arr.map(x=>x.p)).map(x=>x[0]).slice(0,8);const H=Math.max(os.length,ps.length)*40+20,W=320;
 const yo=n=>20+os.indexOf(n)*40+12,yp=n=>20+ps.indexOf(n)*40+12;
 const m={};arr.forEach(x=>{if(os.includes(x.o)&&ps.includes(x.p)){const k=x.o+'|'+x.p;(m[k]||(m[k]={o:x.o,p:x.p,n:0,t:[]})).n++;m[k].t.push(`${x.t||''}${x.ch?` ${x.ch}`:''}`)}});
 const lines=Object.values(m).map(e=>`<path d="M104,${yo(e.o)} C160,${yo(e.o)} 160,${yp(e.p)} 216,${yp(e.p)}" fill="none" stroke="var(--acc)" stroke-opacity=".7" stroke-width="${1.5+e.n*2}"><title>${esc(e.o)} → ${esc(e.p)}</title></path>`).join('');
 const lab=(n,x,y,anc)=>`<text x="${x}" y="${y+4}" text-anchor="${anc}" font-size="12" fill="var(--ink)">${esc(n)}</text>`;
 return `<svg class="ig-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="원작 배우와 내 픽 연결"><text x="8" y="12" font-size="10" fill="var(--mute)">원작</text><text x="${W-8}" y="12" font-size="10" text-anchor="end" fill="var(--mute)">내 픽</text>${lines}${os.map(n=>`<circle cx="104" cy="${yo(n)}" r="4" fill="var(--ink)"/>`+lab(n,96,yo(n),'end')).join('')}${ps.map(n=>`<circle cx="216" cy="${yp(n)}" r="4" fill="var(--acc)"/>`+lab(n,224,yp(n),'start')).join('')}</svg>`}
function matchLine(arr){if(!arr.length)return '';const m=igCnt(arr.map(x=>x.o+'|'+x.p));const [k,c]=m[0];const [o,p]=k.split('|');const byO=igCnt(arr.map(x=>x.o))[0];
 return c>1?`<b>${esc(o)}</b> 자리에 <b>${esc(jj(p,'을','를'))}</b> ${c}번 앉혔어요. 공식 후계자 지정?`:`원작 배우 ${new Set(arr.map(x=>x.o)).size}명의 자리를 ${new Set(arr.map(x=>x.p)).size}명으로 채웠어요.${byO[1]>1?` ${esc(byO[0])} 자리에 제일 공을 들였네요.`:''}`}
function rivalCards(arr){return `<div class="ig-vs">${igCnt2(arr).slice(0,6).map(p=>{const a=p[2].a,b=p[2].b,ua=IMG['p:'+a],ub=IMG['p:'+b];return `<div class="vs"><span class="av"${ua?` style="background-image:url('${esc(ua)}')"`:''}></span><span class="n">${esc(a)}<small>${esc(p[2].ca||'')}</small></span><em>VS</em><span class="n r">${esc(b)}<small>${esc(p[2].cb||'')}</small></span><span class="av"${ub?` style="background-image:url('${esc(ub)}')"`:''}></span>${p[1]>1?`<b class="x">${p[1]}번</b>`:''}<small class="t">${esc(p[3].join(', '))}</small></div>`}).join('')}</div>`}
/* 히트맵: 줄 = 내가 고른 주연, 칸 = 내가 고른 조연, 색 = 같은 작품에서 함께 고른 횟수 */
function heat(arr){const rs=igCnt(arr.map(x=>x.a)).map(x=>x[0]).slice(0,7),cs=igCnt(arr.map(x=>x.b)).map(x=>x[0]).slice(0,7);const m={};let mx=1;arr.forEach(x=>{const k=x.a+'|'+x.b;m[k]=(m[k]||0)+1;mx=Math.max(mx,m[k])});
 return `<div class="ig-heat" style="--n:${cs.length}"><span></span>${cs.map(c=>`<span class="ch">${esc(c)}</span>`).join('')}${rs.map(r=>`<span class="rh">${esc(r)}</span>${cs.map(c=>{const v=m[r+'|'+c]||0;return `<span class="cell" style="--a:${v?(.25+.75*v/mx).toFixed(2):0}" title="${esc(r)} + ${esc(c)}: ${v}번">${v||''}</span>`}).join('')}`).join('')}</div><p class="ig-cap">줄은 내가 고른 주연, 칸은 내가 고른 조연이에요. 진할수록 같이 고른 횟수가 많아요.</p>`}
