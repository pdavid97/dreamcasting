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
 const couples=[];works.forEach(w=>{const m=w.s.male_lead,f=w.s.female_lead;if(m&&f)couples.push({a:m.pick,b:f.pick,t:w.title,ya:null,yb:null})});
 // 3 원작 배우와 내 픽
 const match=rows.filter(r=>r.orig).map(r=>({o:r.orig,p:r.pick,t:r.title,ch:r.ch}));
 // 4 라이벌 구도(같은 성별의 주연과 서브)
 const rivals=[];works.forEach(w=>{[['male_lead','male_sub'],['female_lead','female_sub']].forEach(([a,b])=>{if(w.s[a]&&w.s[b])rivals.push({a:w.s[a].pick,b:w.s[b].pick,ca:w.s[a].ch,cb:w.s[b].ch,t:w.title,ya:null,yb:null})})});
 // 5 주연과 조연 쌍
 const ls=[];works.forEach(w=>{LEADS.forEach(a=>SUBS.forEach(b=>{if(w.s[a]&&w.s[b])ls.push({a:w.s[a].pick,b:w.s[b].pick,t:w.title,ca:w.s[a].ch,cb:w.s[b].ch,ya:null,yb:null})}))});
 const uniq=new Set(rows.map(r=>r.pick)).size,xp=Math.round(uniq/rows.length*100),top=fav[0],tu=top?IMG['p:'+top[0]]:'';
 const persona=xp<45?['한 우물 덕후','마음에 든 배우를 여러 작품에 계속 불러요']:xp<75?['안목 있는 큐레이터','믿는 배우와 새 얼굴을 섞어 골라요']:['새 얼굴 탐험가','작품마다 다른 배우를 시험해 봐요'];
 box.innerHTML=`<div class="sh"><h2>내 캐스팅 리포트</h2><span class="sub">나만 볼 수 있어요</span></div>
 <div class="ig-cover">
  <div class="ig-cv-t"><small>나의 캐스팅 DNA</small><b>${persona[0]}</b><span>${persona[1]}</span></div>
  ${top?`<a class="ig-cv-fav" href="#a/${encodeURIComponent(top[0])}"><span class="ph"${tu?` style="background-image:url('${esc(tu)}')"`:''}>${tu?'':esc(top[0][0])}</span><small>가장 많이 부른 배우</small><b>${esc(top[0])}</b><em>${top[1]}번</em></a>`:''}
  <div class="ig-cv-n"><span><b class="num" data-cnt="${rows.length}">0</b><small>던진 표</small></span><span><b class="num" data-cnt="${works.length}">0</b><small>작품</small></span><span><b class="num" data-cnt="${uniq}">0</b><small>고른 배우</small></span><span><b class="num" data-cnt="${xp}">0</b><small>탐험 지수</small></span></div>
  <div class="ig-meter" aria-hidden="true"><i style="--p:${xp}%"></i><span>한 우물</span><span>탐험</span></div>
 </div>
 <div class="ig-dots" id="igDots" aria-hidden="true"></div>
 <div class="ig-grid ig-story" id="igStory">
  ${igCard('나도 모르게 계속 고르는 배우',favLine(fav),favBars(fav))}
  ${igCard('나도 모르게 맺어주는 커플',coupleLine(couples),couples.length?coupleViz(couples):igEmpty('같은 작품에서 남주와 여주를 둘 다 고르면 내 커플 취향이 보여요.'))}
  ${igCard('원작 배우와 내가 매치업한 배우',matchLine(match),match.length?matchFlow(match):igEmpty('원작 배우가 있는 배역에 투표하면 이어져요.'))}
  ${igCard('나도 모르게 붙이는 라이벌 구도',rivalLine(rivals),rivals.length?rivalViz(rivals):igEmpty('같은 작품에서 주연과 같은 성별의 서브를 함께 고르면 라이벌 구도가 보여요.'))}
  ${igCard('주연과 조연, 내가 짜는 조합',lsLine(ls),ls.length?lsViz(ls):igEmpty('같은 작품에서 주연과 조연을 함께 고르면 조합이 보여요.'))}
 </div><div id="igDeep"><p class="sub">나도 모르는 내 취향과 내 배우 소식을 모으는 중이에요</p></div>`;igBind();loadDeep()}
function igCnt(arr){const m={};arr.forEach(k=>{if(k)m[k]=(m[k]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1])}
const jj=(w,a,b)=>{const c=(w||'').trim().slice(-1).charCodeAt(0);return w+(c>=0xac00&&c<=0xd7a3&&(c-0xac00)%28?a:b)};
const igEmpty=t=>`<p class="ig-empty">${esc(t)}</p>`;
function igCard(h,line,body){return `<article class="ig"><h3>${esc(h)}</h3>${line?`<p class="ig-line">${line}</p>`:''}${body}<p class="ig-tip" aria-live="polite"></p></article>`}
function favLine(f){if(!f.length)return '';const [n,c]=f[0];return c>1?`<b>${esc(n)}</b>, 서로 다른 배역에서 <b>${c}번</b> 골랐어요. 이쯤 되면 최애 인정.`:`아직 한 배우에 몰표는 없어요. 고르게 보는 타입.`}
function favBars(f){const mx=Math.max(...f.map(x=>x[1]));return `<div class="ig-bars">${f.map(([n,c])=>{const u=IMG['p:'+n];return `<div class="ig-bar" data-tip="${esc(n)}, ${c}번 골랐어요"><span class="av"${u?` style="background-image:url('${esc(u)}')"`:''}>${u?'':esc(n[0])}</span><span class="nm">${actorLink(n)}</span><i style="--w:${Math.round(c/mx*100)}%"></i><b>${c}</b></div>`}).join('')}</div>`}
function igKey(a,b){return [a,b].sort().join('|')}
function pairLine(arr,word){if(!arr.length)return '';const m=igCnt2(arr);const top=m[0];return top[1]>1?`<b>${esc(jj(top[2].a,'과','와'))}</b> <b>${esc(top[2].b)}</b>, ${top[1]}개 작품에서 ${word}로 묶었어요. 무의식이 밀고 있는 조합.`:`${arr.length}개 ${word} 중 아직 반복된 짝은 없어요. 다음 작품에서 겹치면 알려드릴게요.`}
function igCnt2(arr){const m={};arr.forEach(p=>{const k=igKey(p.a,p.b);(m[k]||(m[k]=[k,0,p,[]]))[1]++;m[k][3].push(p.t)});return Object.values(m).sort((a,b)=>b[1]-a[1])}
/* 관계도: 사람을 원 위에 놓고 짝을 선으로 잇기(선 굵기 = 반복 횟수) */
function pairGraph(arr){const ps=igCnt2(arr).slice(0,12);const ns=[...new Set(ps.flatMap(p=>[p[2].a,p[2].b]))].slice(0,14);const W=320,R=118,cx=160,cy=150;
 const pos={};ns.forEach((n,i)=>{const a=-Math.PI/2+i*2*Math.PI/ns.length;pos[n]=[cx+R*Math.cos(a),cy+R*Math.sin(a)]});
 const edges=ps.filter(p=>pos[p[2].a]&&pos[p[2].b]).map(p=>{const [x1,y1]=pos[p[2].a],[x2,y2]=pos[p[2].b];return `<path d="M${x1},${y1} Q${cx},${cy} ${x2},${y2}" fill="none" stroke="var(--hot)" stroke-opacity="${p[1]>1?.95:.55}" stroke-width="${1.5+p[1]*2}" class="e" data-a="${esc(p[2].a)}" data-b="${esc(p[2].b)}" data-tip="${esc(jj(p[2].a,"과","와"))} ${esc(p[2].b)}, ${esc(p[3].join(', '))}"><title>${esc(p[2].a)} ♥ ${esc(p[2].b)}: ${esc(p[3].join(', '))}</title></path>`}).join('');
 const nodes=ns.map((n,i)=>{const [x,y]=pos[n],u=IMG['p:'+n],id='igc'+i+Math.random().toString(36).slice(2,6);return `<g class="nd" data-n="${esc(n)}" tabindex="0"><clipPath id="${id}"><circle cx="${x}" cy="${y}" r="17"/></clipPath><circle cx="${x}" cy="${y}" r="19" fill="var(--card)" stroke="var(--line)"/>${u?`<image href="${esc(u)}" x="${x-17}" y="${y-17}" width="34" height="34" clip-path="url(#${id})" preserveAspectRatio="xMidYMin slice"/>`:`<text x="${x}" y="${y+5}" text-anchor="middle" font-size="14">${esc(n[0])}</text>`}<text x="${x}" y="${y+(y>cy?34:-24)}" text-anchor="middle" font-size="11" fill="var(--ink)">${esc(n)}</text></g>`}).join('');
 return `<svg class="ig-svg" viewBox="0 0 ${W} 300" role="img" aria-label="커플 관계도">${edges}${nodes}</svg>`}
/* 매치업: 배역 한 줄마다 원작 배우 → 내 픽 */
function matchFlow(arr){const av=n=>{const u=IMG['p:'+n];return `<span class="av"${u?` style="background-image:url('${esc(u)}')"`:''}>${u?'':esc((n||'?')[0])}</span>`};
 return `<div class="ig-mt">${arr.slice(0,10).map(x=>`<div class="mt"><small class="w">${esc(x.t||'')}${x.ch?` <b>${esc(x.ch)}</b>`:''}</small><a class="p o" href="#a/${encodeURIComponent(x.o)}">${av(x.o)}<span>${dispHTML(x.o)}</span></a><i aria-hidden="true">→</i><a class="p m" href="#a/${encodeURIComponent(x.p)}">${av(x.p)}<span>${dispHTML(x.p)}</span></a></div>`).join('')}${arr.length>10?`<p class="ig-more">외 ${arr.length-10}개 배역</p>`:''}</div>`}
function matchLine(arr){if(!arr.length)return '';const m=igCnt(arr.map(x=>x.o+'|'+x.p));const [k,c]=m[0];const [o,p]=k.split('|');
 const same=arr.filter(x=>x.o===x.p).length;
 return c>1?`<b>${esc(o)}</b> 자리에 <b>${esc(jj(p,'을','를'))}</b> ${c}번 앉혔어요. 공식 후계자 지정?`:`원작 배우가 있는 배역 <b>${arr.length}개</b>에 투표했어요. 배역마다 원작 배우 자리에 누구를 앉혔는지 모아 봤어요.${same?` 그중 ${same}개는 원작 배우를 다시 골랐네요.`:''}`}

/* ===== 쌍 카드 3종: 같은 "같이 고른 두 사람"이지만 관계마다 다른 축으로 읽기 =====
   커플: 나이차(누가 연상인가)  라이벌: 도전자(서브)가 더 젊은가  주조연: 세대를 어떻게 쌓는가 */
const YNOW=new Date().getFullYear();
const igAv=(n,cls='')=>{const u=IMG['p:'+n];return `<span class="av ${cls}"${u?` style="background-image:url('${esc(u)}')"`:''}>${u?'':esc((n||'?')[0])}</span>`};
const igYrs=y=>y?YNOW-y:null;
const igMean=a=>a.reduce((x,y)=>x+y,0)/a.length;
function igRepeat(arr,word){const m=igCnt2(arr);return m[0]&&m[0][1]>1?` 그리고 <b>${esc(jj(m[0][2].a,'과','와'))} ${esc(m[0][2].b)}</b>는 ${m[0][1]}개 작품에서 ${word}로 묶었어요.`:''}
/* 커플: 나이차 저울 */
function coupleLine(arr){const g=arr.filter(x=>x.ya&&x.yb).map(x=>x.yb-x.ya);if(!g.length)return pairLine(arr,'커플');
 const av=igMean(g),noona=g.filter(x=>x<0).length,span=Math.max(...g.map(Math.abs));
 let t=noona*2>=g.length?`커플 ${g.length}쌍 중 <b>${noona}쌍이 여자 연상</b>이에요. 연상연하 케미에 끌리는 타입.`:Math.abs(av)<2?`평균 나이차 <b>${Math.abs(av).toFixed(1)}살</b>, 동갑내기 같은 커플을 좋아해요.`:av>=8?`평균 <b>남자가 ${av.toFixed(0)}살 많아요</b>. 나이차 큰 어른 멜로 취향.`:`평균 <b>남자가 ${av.toFixed(1)}살 많은</b> 정석 커플을 만들어요.`;
 if(span>=20&&g.length>2)t+=` 그런데 나이차가 ${span}살 나는 커플도 맺었어요. 나이보다 케미 우선?`;return t+igRepeat(arr,'커플')}
function coupleViz(arr){const L=25,W=320,x0=24,x1=296,X=g=>x0+(Math.max(-L,Math.min(L,g))+L)/(2*L)*(x1-x0);
 const g=arr.filter(x=>x.ya&&x.yb);const lane={};
 const dots=g.map(x=>{const d=x.yb-x.ya,cx=X(d),k=Math.round(cx/14);lane[k]=(lane[k]||0)+1;const cy=62-(lane[k]-1)*16;
  return `<circle class="cd" cx="${cx}" cy="${cy}" r="6" fill="var(--hot)" stroke="var(--card)" stroke-width="2" data-tip="${esc(x.t)}: ${esc(x.a)} ${igYrs(x.ya)}살, ${esc(x.b)} ${igYrs(x.yb)}살. ${d===0?'동갑':d>0?`남자가 ${d}살 많아요`:`여자가 ${-d}살 많아요`}"/>`}).join('');
 const av=g.length?igMean(g.map(x=>x.yb-x.ya)):null;
 const svg=`<svg class="ig-svg ig-scale" viewBox="0 0 ${W} 104" role="img" aria-label="커플 나이차 분포">
  <defs><linearGradient id="igCg" x1="0" x2="1"><stop offset="0" stop-color="var(--acc)" stop-opacity=".35"/><stop offset=".5" stop-color="var(--line)" stop-opacity=".6"/><stop offset="1" stop-color="var(--hot)" stop-opacity=".35"/></linearGradient></defs>
  <rect x="${x0}" y="72" width="${x1-x0}" height="6" rx="3" fill="url(#igCg)"/>
  <line x1="${X(0)}" x2="${X(0)}" y1="66" y2="84" stroke="var(--mute)" stroke-width="1"/>
  ${[-10,10].map(v=>`<text x="${X(v)}" y="94" font-size="9" text-anchor="middle" fill="var(--mute)">${Math.abs(v)}</text>`).join('')}
  <text x="${x0}" y="101" font-size="10" fill="var(--mute)">← 여자 연상</text><text x="${X(0)}" y="101" font-size="10" text-anchor="middle" fill="var(--mute)">동갑</text><text x="${x1}" y="101" font-size="10" text-anchor="end" fill="var(--mute)">남자 연상 →</text>
  ${av!=null?`<g><path d="M${X(av)-6},${66} L${X(av)+6},${66} L${X(av)},${72} Z" fill="var(--ink)"/><text x="${X(av)}" y="14" font-size="10" text-anchor="middle" font-weight="700" fill="var(--ink)">내 평균</text><line x1="${X(av)}" x2="${X(av)}" y1="18" y2="64" stroke="var(--ink)" stroke-dasharray="2 3"/></g>`:''}${dots}</svg>`;
 const chips=`<div class="ig-pairs">${arr.slice(-6).reverse().map(x=>{const d=x.ya&&x.yb?x.yb-x.ya:null;return `<div class="pr" data-tip="${esc(x.t)}: ${esc(x.a)}와 ${esc(x.b)}"><span class="duo">${igAv(x.a)}${igAv(x.b)}<i>♥</i></span><span class="nm"><b>${esc(x.a)}</b><b>${esc(x.b)}</b><small>${esc(x.t)}</small></span>${d==null?'':`<em class="${d<0?'f':'m'}">${d===0?'동갑':d>0?`남 +${d}`:`여 +${-d}`}</em>`}</div>`}).join('')}</div>`;
 return (g.length?svg:'')+chips}
/* 라이벌: 도전자(서브)가 더 젊은가 */
function rivalLine(arr){const g=arr.filter(x=>x.ya&&x.yb);if(!g.length)return pairLine(arr,'라이벌');
 const young=g.filter(x=>x.yb>x.ya).length,old=g.filter(x=>x.yb<x.ya).length;
 const t=young>old?`<b>${g.length}번 중 ${young}번</b>, 서브를 주연보다 젊게 앉혔어요. 떠오르는 도전자가 판을 흔드는 구도를 좋아해요.`:old>young?`<b>${g.length}번 중 ${old}번</b>, 서브에 주연보다 선배를 앉혔어요. 주연이 노련한 상대를 넘어서는 성장 서사 취향.`:`젊은 도전자와 노련한 맞수를 반반 섞어요. 구도보다 배우 자체를 보는 타입.`;
 return t+igRepeat(arr,'라이벌')}
function rivalViz(arr){const g=arr.filter(x=>x.ya&&x.yb),young=g.filter(x=>x.yb>x.ya).length,same=g.filter(x=>x.yb===x.ya).length,old=g.length-young-same;
 const seg=g.length?`<div class="ig-split" aria-hidden="true">${young?`<span class="y" style="flex:${young}">젊은 도전자 ${young}</span>`:''}${same?`<span class="s" style="flex:${same}">동갑 ${same}</span>`:''}${old?`<span class="o" style="flex:${old}">노련한 맞수 ${old}</span>`:''}</div>`:'';
 const mx=Math.max(1,...g.map(x=>Math.abs(x.yb-x.ya)));
 return seg+`<div class="ig-duel">${arr.slice(-6).reverse().map(x=>{const aa=igYrs(x.ya),ab=igYrs(x.yb),d=x.ya&&x.yb?x.yb-x.ya:null;
  return `<div class="du" data-tip="${esc(x.t)}: 주연 ${esc(x.a)}${aa?` ${aa}살`:''}, 서브 ${esc(x.b)}${ab?` ${ab}살`:''}">
   <span class="sd l">${igAv(x.a)}<span><b>${esc(x.a)}</b><small>${esc(x.ca||'주연')}${aa?`, ${aa}살`:''}</small></span></span>
   <span class="mid"><em>VS</em>${d==null?'':`<i class="${d>0?'y':d<0?'o':'s'}" style="--w:${Math.round(Math.abs(d)/mx*100)}%"></i><small>${d===0?'동갑':d>0?`서브가 ${d}살 어림`:`서브가 ${-d}살 위`}</small>`}</span>
   <span class="sd r"><span><b>${esc(x.b)}</b><small>${esc(x.cb||'서브')}${ab?`, ${ab}살`:''}</small></span>${igAv(x.b)}</span>
   <small class="t">${esc(x.t)}</small></div>`}).join('')}</div>`}
/* 주조연: 세대 덤벨 차트 */
function lsLine(arr){const g=arr.filter(x=>x.ya&&x.yb);if(!g.length)return pairLine(arr,'조합');
 const d=igMean(g.map(x=>x.ya-x.yb));
 const t=d>=5?`조연을 주연보다 평균 <b>${d.toFixed(0)}살 선배</b>로 채워요. 베테랑이 뒤를 받쳐 주는 그림을 좋아해요.`:d<=-5?`조연에 주연보다 평균 <b>${(-d).toFixed(0)}살 어린</b> 배우를 써요. 주연이 앞에서 끌고 가는 그림 취향.`:`주연과 조연을 <b>동년배</b>로 맞춰요(평균 ${Math.abs(d).toFixed(1)}살 차). 친구 같은 앙상블 취향.`;
 return t+igRepeat(arr,'주조연')}
function lsViz(arr){const g=arr.filter(x=>x.ya&&x.yb).slice(-8).reverse();if(!g.length)return heat(arr);
 const ys=g.flatMap(x=>[x.ya,x.yb]),lo=Math.floor((Math.min(...ys)-2)/10)*10,hi=Math.ceil((Math.max(...ys)+2)/10)*10;
 const W=320,x0=96,x1=306,X=y=>x0+(y-lo)/(hi-lo||1)*(x1-x0),RH=30,H=g.length*RH+34;
 const grid=[];for(let y=lo;y<=hi;y+=10)grid.push(`<line x1="${X(y)}" x2="${X(y)}" y1="18" y2="${H-14}" stroke="var(--line)"/><text x="${X(y)}" y="${H-2}" font-size="9" text-anchor="middle" fill="var(--mute)">${y}년생</text>`);
 const rows=g.map((x,i)=>{const y=30+i*RH,a=X(x.ya),b=X(x.yb);return `<g class="e" data-tip="${esc(x.t)}: 주연 ${esc(x.a)}(${x.ya}년생), 조연 ${esc(x.b)}(${x.yb}년생)">
  <text x="0" y="${y-3}" font-size="10" fill="var(--mute)">${esc((x.t||'').slice(0,9))}</text><text x="0" y="${y+9}" font-size="10" fill="var(--ink)">${esc((x.a||'').slice(0,5))} + ${esc((x.b||'').slice(0,5))}</text>
  <line x1="${a}" x2="${b}" y1="${y}" y2="${y}" stroke="var(--mute)" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/>
  <circle cx="${a}" cy="${y}" r="6" fill="var(--acc)"/><circle cx="${b}" cy="${y}" r="6" fill="var(--hot)"/></g>`}).join('');
 return `<div class="ig-legend"><span><i style="background:var(--acc)"></i>주연</span><span><i style="background:var(--hot)"></i>조연</span><span class="r">왼쪽일수록 선배</span></div><svg class="ig-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="주연과 조연의 출생 연도">${grid.join('')}${rows}</svg>`}
function rivalCards(arr){return `<div class="ig-vs">${igCnt2(arr).slice(0,6).map(p=>{const a=p[2].a,b=p[2].b,ua=IMG['p:'+a],ub=IMG['p:'+b];return `<div class="vs"><span class="av"${ua?` style="background-image:url('${esc(ua)}')"`:''}></span><span class="n">${esc(a)}<small>${esc(p[2].ca||'')}</small></span><em>VS</em><span class="n r">${esc(b)}<small>${esc(p[2].cb||'')}</small></span><span class="av"${ub?` style="background-image:url('${esc(ub)}')"`:''}></span>${p[1]>1?`<b class="x">${p[1]}번</b>`:''}<small class="t">${esc(p[3].join(', '))}</small></div>`}).join('')}</div>`}
/* 히트맵: 줄 = 내가 고른 주연, 칸 = 내가 고른 조연, 색 = 같은 작품에서 함께 고른 횟수 */
function heat(arr){const rs=igCnt(arr.map(x=>x.a)).map(x=>x[0]).slice(0,7),cs=igCnt(arr.map(x=>x.b)).map(x=>x[0]).slice(0,7);const m={};let mx=1;arr.forEach(x=>{const k=x.a+'|'+x.b;m[k]=(m[k]||0)+1;mx=Math.max(mx,m[k])});
 return `<div class="ig-heat" style="--n:${cs.length}"><span></span>${cs.map(c=>`<span class="ch">${esc(c)}</span>`).join('')}${rs.map(r=>`<span class="rh">${esc(r)}</span>${cs.map(c=>{const v=m[r+'|'+c]||0;return `<span class="cell" style="--a:${v?(.25+.75*v/mx).toFixed(2):0}" title="${esc(r)} + ${esc(c)}: ${v}번" data-tip="${v?`주연 ${esc(r)}, 조연 ${esc(c)}. 같은 작품에서 ${v}번 함께 골랐어요`:`주연 ${esc(r)}, 조연 ${esc(c)}. 아직 함께 고른 적 없어요`}">${v||''}</span>`}).join('')}`).join('')}</div><p class="ig-cap">줄은 내가 고른 주연, 칸은 내가 고른 조연이에요. 진할수록 같이 고른 횟수가 많아요.</p>`}

/* 리포트 상호작용: 숫자 올라가기, 화면에 들어오면 막대 자라기, 노드를 누르면 그 사람의 선만 강조, 무엇이든 누르면 설명 줄 */
function igBind(){const box=$('#insight');if(!box)return;
 box.querySelectorAll('[data-cnt]').forEach(el=>{const to=+el.dataset.cnt,t0=performance.now();const f=t=>{const k=Math.min(1,(t-t0)/900);el.textContent=Math.round(to*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(f)};requestAnimationFrame(f)});
 const cards=[...box.querySelectorAll('.ig')];const io='IntersectionObserver' in window?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');igDot(cards.indexOf(e.target))}}),{threshold:.5}):null;
 cards.forEach(c=>io?io.observe(c):c.classList.add('in'));
 const dots=$('#igDots');if(dots)dots.innerHTML=cards.map((_,i)=>`<i data-i="${i}"></i>`).join('');igDot(0);
 box.onclick=e=>{const card=e.target.closest('.ig');if(!card)return;const tipEl=card.querySelector('.ig-tip');
  const nd=e.target.closest('.nd');if(nd){const n=nd.dataset.n,on=!nd.classList.contains('sel');card.querySelectorAll('.nd').forEach(x=>x.classList.toggle('sel',on&&x===nd));
   card.classList.toggle('focus',on);card.querySelectorAll('.e').forEach(x=>x.classList.toggle('hi',on&&(x.dataset.a===n||x.dataset.b===n)));
   const L=[...card.querySelectorAll('.e.hi')].map(x=>x.dataset.a===n?x.dataset.b:x.dataset.a);if(tipEl)tipEl.textContent=on?`${n}: ${L.length?L.join(', ')+'와 이어져 있어요':'이어진 짝이 없어요'}`:'';return}
  const t=e.target.closest('[data-tip]');if(t&&tipEl){card.querySelectorAll('.tipon').forEach(x=>x.classList.remove('tipon'));t.classList.add('tipon');tipEl.textContent=t.dataset.tip}}}
function igDot(i){const d=$('#igDots');if(!d)return;[...d.children].forEach((x,k)=>x.classList.toggle('on',k===i))}

/* ===== 나도 모르는 내 취향(광장 데이터) + 내 배우 소식(외부 데이터) ===== */
const IG_ARCH=[['재벌, 후계자',/재벌|회장|본부장|후계자|대표|ceo|heir/i],['왕족, 귀족',/황제|황후|왕자|공주|황태자|왕비|대공|공작|영애|귀족|emperor|queen|prince/i],['기사, 무사',/기사|무사|검객|무림|장군|knight|sword/i],['형사, 검사, 변호사',/형사|경찰|검사|변호사|detective|lawyer/i],['의사',/의사|외과|doctor/i],['헌터, 각성자',/헌터|각성|레벨|hunter/i],['킬러, 요원',/킬러|암살|요원|스파이|killer|agent/i],['아이돌, 가수',/아이돌|가수|idol|singer/i],['학생, 청춘',/학생|고등|대학|청춘|student/i],['복수극 주인공',/복수|가해자|피해자|revenge/i],['초월적 존재',/도깨비|저승|신|요괴|뱀파이어|구미호|vampire/i]];
const goExt=(p,k,u)=>goURL('',p,k,u);
function dday(t){const d=Math.ceil((new Date(t)-Date.now())/864e5);return d<=0?'오늘 마감':`D-${d}`}
function fmtDate(t){if(!t)return '';const d=new Date(t);return `${d.getMonth()+1}.${d.getDate()}`}
async function loadDeep(){const box=$('#igDeep');if(!box)return;let I=null,S=null;try{[I,S]=await Promise.all([rpc('my_insights',{}),rpc('my_style',{}).catch(()=>null)])}catch(e){}
 if(!I){box.innerHTML='';return}
 const H=I.hidden||[];try{await loadNames(H.map(h=>h.name))}catch(e){}
 box.innerHTML=`<div class="sh ig-sh"><h2>나도 모르는 내 취향</h2><span class="sub">표, VS 한판, 응원, 인생작, 오래 본 카드까지 합쳐서</span></div>
 <div class="ig-grid ig-story">${[igHidden(H),igArch(I),igStyle(S,I),igVsCrowd(S),igCrowd(I.crowd||[]),igTwin(I.twin),igRaces(I.races||[])].join('')}</div>
 <div class="sh ig-sh"><h2>내 배우 소식</h2><span class="sub">숨은 최애 ${esc(H.slice(0,4).map(h=>h.name).join(', ')||'')} 기준</span></div>
 <div id="igNews" class="ig-grid ig-story"><p class="sub">신작, 행사, 굿즈 소식을 찾는 중이에요</p></div>`;
 igBind2(box);loadNews(H.slice(0,4).map(h=>h.name))}
function igHidden(H){if(!H.length)return igCard('숨은 최애','',igEmpty('투표, VS 한판, 응원이 쌓이면 진짜 최애를 찾아드려요.'));
 const mx=Math.max(...H.map(h=>h.score)),top=H[0],seg=[['votes',3,'투표','var(--acc)'],['best',3,'인생작','#8e24aa'],['duels',2,'VS 승리','var(--hot)'],['cheers',2,'응원','#e3121e'],['taps',1,'오래 본 카드','#90a4ae']];
 const line=!top.followed?`<b>${esc(top.name)}</b>, 팬 채널엔 없지만 신호가 제일 강해요. 이쯤 되면 입덕 확인.`:`<b>${esc(top.name)}</b>, 팬 채널 배우이자 신호도 1위. 흔들림 없는 최애.`;
 return igCard('숨은 최애',line,`<div class="hb">${H.slice(0,6).map(h=>{const u=IMG['p:'+h.name];return `<div class="hb-r" data-tip="${esc(h.name)}: 투표 ${h.votes}, VS 승리 ${h.duels}, 응원 ${h.cheers}일, 인생작 ${h.best}, 오래 본 카드 ${h.taps}"><a class="av" href="#a/${encodeURIComponent(h.name)}"${u?` style="background-image:url('${esc(u)}')"`:''}>${u?'':esc(h.name[0])}</a><span class="nm">${esc(h.name)}${h.followed?'':' <em>팬 채널 밖</em>'}</span><span class="hb-bar" style="--w:${Math.round(h.score/mx*100)}%">${seg.map(([k,w,_,c])=>h[k]?`<i style="flex:${h[k]*w};background:${c}"></i>`:'').join('')}</span><b>${h.score}</b></div>`}).join('')}</div>
 <div class="hb-lg">${seg.map(([,w,l,c])=>`<span><i style="background:${c}"></i>${l} ${w}점</span>`).join('')}</div>`)}
function igArch(I){const R=I.roles||[],cnt={};R.forEach(r=>{const t=`${r.ch} ${r.descr}`;IG_ARCH.forEach(([k,re])=>{if(re.test(t))cnt[k]=(cnt[k]||0)+1})});const L=Object.entries(cnt).sort((a,b)=>b[1]-a[1]);const mx=L.length?L[0][1]:1;
 const me=I.sub_me??0,all=I.sub_all??0,d=me-all;const type=d>=10?['서브병 지수 높음','서브 배역에 광장 평균보다 마음을 많이 줘요']:d<=-10?['주연 직진파','주연 배역에 표가 몰려요']:['주연, 서브 균형형','광장 평균과 비슷하게 골고루 골라요'];
 return igCard('내가 끌리는 배역 타입',L.length?`<b>${esc(L[0][0])}</b> 배역에 제일 자주 표를 던졌어요. ${esc(type[0])}.`:esc(type[1]),
 `${L.length?`<div class="arch">${L.slice(0,8).map(([k,n])=>`<span style="--s:${(.8+.7*n/mx).toFixed(2)}" data-tip="${esc(k)} 배역에 ${n}표">${esc(k)} <b>${n}</b></span>`).join('')}</div>`:''}
 <div class="dual"><div data-tip="내 표 중 서브 배역 ${me}%"><small>나</small><span><i style="width:${me}%"></i></span><b>${me}%</b></div><div data-tip="광장 전체 표 중 서브 배역 ${all}%"><small>광장 평균</small><span><i class="g" style="width:${all}%"></i></span><b>${all}%</b></div><p class="ig-cap">서브 배역에 던진 표의 비중</p></div>`)}
function igAge(A){if(!A.length)return igCard('원작 충실파 vs 재해석파','',igEmpty('원작 배우가 있는 배역에 투표하면 나이 결을 비교해 드려요.'));
 const g=A.map(a=>({...a,d:a.pick_age-a.orig_age})),avg=Math.round(g.reduce((s,x)=>s+x.d,0)/g.length);const ty=avg<=-3?'젊게 재해석파':avg>=3?'성숙하게 재해석파':'원작 충실파';
 const X=d=>Math.max(-25,Math.min(25,d)),W=300,cx=150,sc=5.4;
 const dots=g.map((x,i)=>`<circle class="e" cx="${cx+X(x.d)*sc}" cy="${40+((i%4)-1.5)*11}" r="7" fill="${x.d<0?'var(--acc)':'var(--hot)'}" fill-opacity=".85" stroke="var(--card)" data-tip="${esc(x.title)} ${esc(x.ch)}: 원작 ${esc(x.orig)} ${x.orig_age}살 때, 내 픽 ${esc(x.pick)} 지금 ${x.pick_age}살 (${x.d>0?'+':''}${x.d})"><title>${esc(x.pick)}</title></circle>`).join('');
 return igCard('원작 충실파 vs 재해석파',`평균 <b>${avg>0?'+':''}${avg}살</b>, <b>${ty}</b>. 원작 배우가 그 역을 맡았을 때 나이와 내 픽의 지금 나이를 비교했어요.`,
 `<svg class="ig-svg" viewBox="0 0 ${W} 92" role="img" aria-label="나이 차 분포"><line x1="10" x2="290" y1="40" y2="40" stroke="var(--line)" stroke-width="2"/><line x1="${cx}" x2="${cx}" y1="8" y2="72" stroke="var(--ink)" stroke-dasharray="3 3"/><text x="${cx}" y="88" text-anchor="middle" font-size="10" fill="var(--mute)">원작 나이 그대로</text><text x="12" y="88" font-size="10" fill="var(--mute)">더 젊게</text><text x="288" y="88" font-size="10" text-anchor="end" fill="var(--mute)">더 성숙하게</text><line x1="${cx+X(avg)*sc}" x2="${cx+X(avg)*sc}" y1="14" y2="66" stroke="var(--ink)" stroke-width="3"/>${dots}</svg>`)}
function igCrowd(C){if(!C.length)return igCard('광장 민심 일치율','',igEmpty('투표가 쌓이면 보여드려요.'));
 const agree=C.filter(c=>c.now_mine>=c.now_top&&c.now_top>0).length,pct=Math.round(agree/C.length*100);
 const fore=C.filter(c=>c.then_top>0&&c.then_mine<c.then_top&&c.now_mine>=c.now_top),first=C.filter(c=>c.then_top===0);
 const R=34,L=2*Math.PI*R;
 return igCard('광장 민심 일치율과 선견지명',pct>=70?`<b>${pct}%</b> 일치, 광장 민심을 정확히 읽는 타입.`:pct<=30?`<b>${pct}%</b>만 일치, 나만의 길을 가는 소신파.`:`<b>${pct}%</b> 일치, 민심과 소신 사이 균형.`,
 `<div class="crowd"><svg viewBox="0 0 90 90" class="donut" role="img" aria-label="일치율 ${pct}%"><circle cx="45" cy="45" r="${R}" fill="none" stroke="var(--line)" stroke-width="12"/><circle cx="45" cy="45" r="${R}" fill="none" stroke="var(--acc)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(L*pct/100).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 45 45)" class="dn"/><text x="45" y="50" text-anchor="middle" font-size="18" font-weight="800" fill="var(--ink)">${pct}%</text></svg>
 <div><p><b>선견지명 ${fore.length}번</b><small>내가 골랐을 땐 1위가 아니었는데 지금은 1위</small></p>${fore.slice(0,3).map(c=>`<a class="chip" href="#${esc(c.tid)}">${esc(c.title)} ${esc(c.ch)}: ${esc(c.pick)}</a>`).join('')}
 <p><b>1호 지지자 ${first.length}번</b><small>그 배역에서 처음으로 표를 던진 사람이 나</small></p></div></div>`)}
function igTwin(T){if(!T)return igCard('나의 취향 쌍둥이','',igEmpty('나와 같은 배역에 3번 이상 투표한 유저가 생기면 찾아드려요.'));const pct=Math.round(T.same/T.shared*100);
 return igCard('나의 취향 쌍둥이',`<b>${esc(T.nick)}</b> 님과 같은 배역 ${T.shared}개 중 <b>${T.same}개</b>에서 같은 배우를 골랐어요.`,
 `<a class="twin" href="#u/${encodeURIComponent(T.nick)}"><span class="tw-a">나</span><span class="tw-m"><b>${pct}%</b><small>싱크로</small></span><span class="tw-a">${esc(T.nick[0])}</span></a><p class="ig-cap">${T.sheets?`${esc(T.nick)} 님의 캐스팅 시트 ${T.sheets}장을 구경해 보세요.`:`${esc(T.nick)} 님 페이지에서 다른 픽도 확인해 보세요.`}</p>`)}
function igRaces(R){if(!R.length)return igCard('내 최애, 마감 임박 레이스','',igEmpty('숨은 최애나 팬 채널 배우가 투표 중인 배역에 오르면 알려드려요.'));
 return igCard('내 최애, 마감 임박 레이스',`${R.length}개 배역에서 내 배우가 뛰고 있어요.`,`<div class="races">${R.slice(0,6).map(r=>{const gap=Math.max(0,r.top-r.mine);return `<a href="#${esc(r.tid)}" class="race${gap?'':' lead'}"><span class="dd">${dday(r.closes_at)}</span><span><b>${esc(r.name)}</b><small>${esc(r.title)} ${esc(r.ch)}</small></span><em>${gap?`1위까지 ${gap}표`:'지금 1위'}${r.voted?'':', 아직 내 표 없음'}</em></a>`}).join('')}</div>`)}
async function loadNews(names){const box=$('#igNews');if(!box)return;let works=[];try{works=((await rpc('av_room',{nick:PROF.nickname}))||[]).slice(0,8).map(w=>({media:w.media,id:w.tmdb_id,title:w.title}))}catch(e){}
 const region=(PRIV&&/^[A-Z]{2}$/.test(PRIV.region_self||'')&&PRIV.region_self!=='ZZ')?PRIV.region_self:'KR';let F=null;
 try{const r=await fetch(SB_URL+'/functions/v1/fanfeed',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ANON,apikey:ANON},body:JSON.stringify({names,works,region})});F=await r.json();if(!r.ok||F.error)throw 0}catch(e){box.innerHTML=igEmpty('소식을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.');return}
 const P=F.per||[];const up=P.flatMap(p=>p.up.map(u=>({...u,who:p.name}))).sort((a,b)=>a.date.localeCompare(b.date));
 const ev=P.flatMap(p=>p.ev.map(e=>({...e,who:p.name}))).sort((a,b)=>(b.at||'').localeCompare(a.at||''));
 const gd=P.flatMap(p=>p.gd.map(e=>({...e,who:p.name}))).sort((a,b)=>(b.at||'').localeCompare(a.at||''));
 const art=e=>`<a class="nw" href="${goExt('news','news',e.u)}" target="_blank" rel="noopener"><span class="nw-w">${esc(e.who)}</span><b>${esc(e.t)}</b><small>${esc(e.src||'')}${e.at?` ${fmtDate(e.at)}`:''}</small></a>`;
 const pv=(F.providers||[]).filter(p=>p.flat.length||p.rent.length||p.buy.length);
 box.innerHTML=[
  igCard('곧 만나는 신작',up.length?`<b>${esc(up[0].who)}</b>의 다음 작품, ${esc(up[0].date)} 공개 예정.`:'',up.length?`<div class="upc">${up.slice(0,8).map(u=>`<button class="up" data-act="wk-open" data-m="${esc(u.media)}" data-id="${u.id}">${u.poster?`<img src="${esc(u.poster)}" alt="" loading="lazy">`:'<span class="ph"></span>'}<b>${esc(u.title)}</b><small>${esc(u.who)}${u.ch?`, ${esc(u.ch)}`:''}</small><em>${esc(u.date)}</em></button>`).join('')}</div><p class="ig-cap">TMDB에 등록된 공개 예정일 기준이에요.</p>`:igEmpty('TMDB에 등록된 공개 예정작이 아직 없어요.')),
  igCard('팬미팅, 내한, 무대인사, 콘서트',ev.length?`최근 60일 기사 ${ev.length}건.`:'',ev.length?`<div class="nws">${ev.slice(0,6).map(art).join('')}</div><p class="ig-cap">기사 제목 기준이라 정확한 일정과 예매는 기사에서 확인해 주세요.</p>`:igEmpty('최근 60일 안에 행사 기사가 없어요.')),
  igCard('굿즈, 앨범, 팝업, 소장판',gd.length?`최근 60일 기사 ${gd.length}건.`:'',`${gd.length?`<div class="nws">${gd.slice(0,5).map(art).join('')}</div>`:igEmpty('최근 60일 안에 굿즈 소식이 없어요.')}<div class="shops">${names.slice(0,3).map(n=>`<span>${esc(n)}</span><a href="${goExt('yes24','shop','https://www.yes24.com/Product/Search?query='+encodeURIComponent(n))}" target="_blank" rel="noopener">예스24</a><a href="${goExt('aladin','shop','https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=All&SearchWord='+encodeURIComponent(n))}" target="_blank" rel="noopener">알라딘</a>`).join('')}</div>`),
  igCard('내 AV룸 작품, 지금 어디서 볼까',pv.length?`AV룸 ${pv.length}편을 지금 볼 수 있어요. 시청처 정보 JustWatch 제공`:'',pv.length?`<div class="wps">${pv.map(p=>`<a class="wp" href="${p.link?goExt('tmdb','watch',p.link):'#'}" target="_blank" rel="noopener"><b>${esc(p.title)}</b><span>${[...p.flat.map(x=>[x,'구독']),...p.rent.map(x=>[x,'대여']),...p.buy.map(x=>[x,'구매'])].slice(0,5).map(([x,k])=>x.logo?`<img src="${esc(x.logo)}" alt="${esc(x.name)} ${k}" title="${esc(x.name)} ${k}">`:`<i>${esc(x.name)}</i>`).join('')}</span></a>`).join('')}</div><p class="ig-cap">시청처 정보는 JustWatch 제공(TMDB 경유), ${esc(F.region)} 기준이에요.</p>`:igEmpty(works.length?'AV룸 작품의 시청처 정보가 아직 없어요.':'AV룸에 작품을 담으면 지금 볼 수 있는 곳을 알려드려요.'))
 ].join('');igBind2(box)}
function igBind2(root){root.querySelectorAll('.ig').forEach(c=>c.classList.add('in'));root.onclick=e=>{const card=e.target.closest('.ig');if(!card)return;const t=e.target.closest('[data-tip]');const tip=card.querySelector('.ig-tip');if(t&&tip){card.querySelectorAll('.tipon').forEach(x=>x.classList.remove('tipon'));t.classList.add('tipon');tip.textContent=t.dataset.tip}}}

/* ===== 주간 결산: 최근 7일 vs 그 전 7일 ===== */
async function loadWeek(){const box=$('#weekbox');if(!box)return;box.innerHTML='<p class="sub">이번 주를 정리하는 중이에요</p>';
 let w=null;try{w=await rpc('my_week',{})}catch(e){}if(!w){box.innerHTML='';return}
 if(w.fav)try{await loadNames([w.fav.name,...(w.fav_prev?[w.fav_prev.name]:[])])}catch(e){}
 const dl=(a,b,u='')=>{const d=a-b;return d===0?'<em class="wkx-eq">지난주와 같아요</em>':`<em class="${d>0?'wkx-up':'wkx-dn'}">${d>0?'▲':'▼'} ${Math.abs(d)}${u}</em>`};
 const mx=Math.max(1,...w.days.map(x=>x.n)),dn=['일','월','화','수','목','금','토'];
 const fu=w.fav&&IMG['p:'+w.fav.name];
 const favTxt=!w.fav?'이번 주에는 아직 고른 배우가 없어요':!w.fav_prev?`이번 주 가장 많이 부른 배우예요. ${w.fav.k}번 골랐어요.`:w.fav_prev.name===w.fav.name?`2주 연속 최애 자리를 지켰어요. 이쯤 되면 찐팬.`:`지난주 최애 ${esc(w.fav_prev.name)}에서 갈아탔어요. 새로운 마음?`;
 box.innerHTML=`<div class="sh"><h2>주간 결산</h2><span class="sub">최근 7일, 지난주와 비교</span></div><button class="wkx-story" data-act="week-story">▶ 스토리로 보기</button>
 <div class="wkx-hero"><small>이번 주 던진 표</small><b class="num" data-cnt="${w.n}">${w.n}</b>${dl(w.n,w.n_prev,'표')}
  <div class="wkx-days">${w.days.map(x=>{const d=new Date(x.d+'T00:00:00');return `<div class="wd" title="${d.getMonth()+1}/${d.getDate()} ${x.n}표"><div class="wb"><div class="wf" style="height:${Math.max(4,Math.round(x.n/mx*100))}%"></div></div><div class="wl">${dn[d.getDay()]}${x.n?` ${x.n}`:''}</div></div>`}).join('')}</div></div>
 <div class="wkx-tiles"><div><b>${w.works}</b><small>작품</small></div><div><b>${w.actors}</b><small>고른 배우</small><em>새 얼굴 ${w.new_actors}</em></div><div><b>+${fmt(w.pts)}</b><small>얻은 포인트</small>${dl(w.pts,w.pts_prev,'P')}</div><div><b>${w.hits}</b><small>적중 판</small><em>${w.hitp?`+${w.hitp}P`:`결과 ${w.results}건`}</em></div></div>
 ${w.fav?`<a class="wkx-fav" href="#a/${encodeURIComponent(w.fav.name)}"><span class="av"${fu?` style="background-image:url('${esc(fu)}')"`:''}></span><div><small>이번 주 최애</small><b>${dispHTML(w.fav.name)}</b><p>${favTxt}</p></div></a>`:`<p class="sub">${favTxt}</p>`}
 ${w.closing?`<a class="wkx-next" href="#">⏳ 내가 투표한 판 중 <b>${w.closing}개</b>가 7일 안에 결과 발표돼요<i>→</i></a>`:''}`}
/* ===== 주간 결산 스토리: 9:16 카드를 탭해서 넘기고 마지막 장에서 공유 ===== */
async function openWeekStory(){if(!USER){openLoginSheet&&openLoginSheet();return}let w=null;try{w=await rpc('my_week',{})}catch(e){}if(!w){toast('결산을 불러오지 못했어요');return}
 if(w.fav)try{await loadNames([w.fav.name])}catch(e){}
 const fu=w.fav&&IMG['p:'+w.fav.name],d=w.n-w.n_prev;
 const slides=[
  {bg:'radial-gradient(120% 80% at 20% 10%,#FF4F7B 0%,#6A1F8C 55%,#1A0F2E 100%)',h:`<span class="ws-tag">이번 주 결산</span><h1>나의 한 주<br>캐스팅</h1><p>최근 7일 동안 광장에서 남긴 기록이에요</p><small class="ws-tip">화면을 탭해서 넘겨요</small>`},
  {bg:'radial-gradient(120% 80% at 80% 10%,#7B5CFF 0%,#2B1D6B 55%,#0F0B22 100%)',h:`<p class="ws-k">던진 표</p><b class="ws-big">${w.n}</b><p>${d>0?`지난주보다 ${d}표 더 던졌어요`:d<0?`지난주보다 ${-d}표 적어요`:'지난주와 같은 페이스'}</p><p>${w.works}개 작품, ${w.actors}명의 배우, 그중 새 얼굴 ${w.new_actors}명</p>`},
  {bg:'radial-gradient(120% 80% at 50% 30%,#FF8A3D 0%,#B0244F 55%,#2A0B1A 100%)',h:w.fav?`<p class="ws-k">이번 주 최애</p><span class="ws-av"${fu?` style="background-image:url('${esc(fu)}')"`:''}></span><b class="ws-nm">${dispHTML(w.fav.name)}</b><p>${w.fav_prev&&w.fav_prev.name===w.fav.name?'2주 연속 최애 자리를 지켰어요':w.fav_prev?`지난주 최애 ${esc(w.fav_prev.name)}에서 갈아탔어요`:`${w.fav.k}번 이 배우를 불렀어요`}</p>`:`<p class="ws-k">이번 주 최애</p><h1>아직<br>비어 있어요</h1><p>한 표만 던져도 채워져요</p>`},
  {bg:'radial-gradient(120% 80% at 30% 20%,#00C2A8 0%,#14507A 55%,#0A1424 100%)',h:`<p class="ws-k">적중과 포인트</p><b class="ws-big">${w.hits}</b><p>개 판에서 1위를 맞혔어요${w.hitp?`, +${w.hitp}P`:''}</p><span class="ws-pts">+${fmt(w.pts)}P</span><p>${w.closing?`7일 안에 내 판 ${w.closing}개의 결과가 나와요`:''}</p><button class="ws-share" data-act="ws-share">결산 공유하기</button>`}
 ];
 let i=0;const el=document.createElement('div');el.className='wstory';document.body.appendChild(el);
 const draw=()=>{const s=slides[i];el.innerHTML=`<div class="ws-card" style="background:${s.bg}"><div class="ws-bars">${slides.map((_,k)=>`<i class="${k<=i?'on':''}"></i>`).join('')}</div><button class="ws-x" data-act="ws-close" aria-label="닫기">×</button><div class="ws-body">${s.h}</div><button class="ws-prev" data-act="ws-prev" aria-label="이전 장"></button><button class="ws-next" data-act="ws-next" aria-label="다음 장"></button></div>`};
 el.addEventListener('click',async e=>{const a=e.target.closest('[data-act]');if(!a)return;const k=a.dataset.act;
  if(k==='ws-close'){el.remove();return}if(k==='ws-next'){if(i<slides.length-1){i++;draw()}else el.remove();return}if(k==='ws-prev'){if(i>0){i--;draw()}return}
  if(k==='ws-share'){const txt=`드림캐스팅 이번 주 결산: ${w.n}표, 최애 ${w.fav?w.fav.name:'아직 없음'}, 적중 ${w.hits}판 ${location.origin+location.pathname}`;try{if(navigator.share)await navigator.share({text:txt});else{await navigator.clipboard.writeText(txt);toast('공유 문구를 복사했어요')}}catch(err){}track('week_share',{})}});
 draw();track('week_story',{})}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act="week-story"]');if(!b)return;e.preventDefault();e.stopPropagation();openWeekStory()},true);

/* C2 나와 광장 비교, C3 내 캐스팅 성향 */
function igPct(a,b){return b?Math.round(a/b*100):null}
function igDual(lab,me,all,tip){return `<div data-tip="${esc(tip)}"><small>${esc(lab)}</small><span><i style="width:${me||0}%"></i></span><b>${me==null?'-':me+'%'}</b></div><div data-tip="광장 전체 기준"><small>광장 평균</small><span><i class="g" style="width:${all||0}%"></i></span><b>${all==null?'-':all+'%'}</b></div>`}
function igVsCrowd(S){const V=(S&&S.votes)||[],A=(S&&S.all)||{};
 if(V.length<3)return igCard('나와 광장, 얼마나 닮았나','',igEmpty('표를 3개 이상 던지면 광장 평균과 비교해 드려요.'));
 const top=igPct(V.filter(v=>v.top).length,V.length),m5=V.filter(v=>v.tot>=5),minor=igPct(m5.filter(v=>v.n/v.tot<.2).length,m5.length),m3=V.filter(v=>v.tot>=3),solo=igPct(m3.filter(v=>v.n===1).length,m3.length);
 const d=(top||0)-(A.top||0),line=d>=15?`내 픽의 <b>${top}%</b>가 지금 1위. 광장 평균보다 <b>${d}%p</b> 높은 민심 저격수.`:d<=-15?`내 픽의 <b>${top}%</b>만 지금 1위. 광장 평균보다 <b>${-d}%p</b> 낮은 소신파.`:`내 픽의 <b>${top}%</b>가 지금 1위. 광장 평균과 비슷한 결이에요.`;
 const bc={};V.forEach(v=>{const k=v.cat||'etc';(bc[k]=bc[k]||[0,0]);bc[k][0]++;if(v.top)bc[k][1]++});
 const cats=Object.entries(bc).filter(x=>x[1][0]>=2).sort((a,b)=>b[1][1]/b[1][0]-a[1][1]/a[1][0]).slice(0,6);
 const cn=k=>((typeof CATS!=='undefined'&&CATS.find(c=>c.id===k))||{}).name||k;
 return igCard('나와 광장, 얼마나 닮았나',line,`<div class="dual">${igDual('다수 픽',top,A.top,`내 표 ${V.length}개 중 지금 1위인 배우를 고른 비율`)}<p class="ig-cap">고른 배우가 지금 그 배역 1위인 비율</p></div>
 <div class="dual">${igDual('소수 의견',minor,A.minor,'표가 5개 이상 모인 배역에서 득표율 20% 미만 배우를 고른 비율')}<p class="ig-cap">득표율 20% 미만 배우를 고른 비율 (표 5개 이상 배역)</p></div>
 <div class="dual">${igDual('나만 고름',solo,A.solo,'표가 3개 이상 모인 배역에서 그 배우에게 표를 준 사람이 나 혼자인 비율')}<p class="ig-cap">그 배우에게 표를 준 사람이 나 혼자 (표 3개 이상 배역)</p></div>
 ${cats.length?`<div class="arch">${cats.map(([k,[n,t]])=>`<span style="--s:1" data-tip="${esc(cn(k))} ${n}표 중 ${t}표가 지금 1위">${esc(cn(k))} <b>${Math.round(t/n*100)}%</b></span>`).join('')}</div><p class="ig-cap">판 종류별 다수 픽 비율</p>`:''}`)}
function igStyle(S,I){const V=(S&&S.votes)||[],A=(I&&I.age)||[];
 if(V.length<3)return igCard('내 캐스팅 성향 리포트','',igEmpty('표를 3개 이상 던지면 원작 충실형인지 의외형인지 알려 드려요.'));
 const sg=s=>/^male/.test(s||'')?2:/^female/.test(s||'')?1:0;
 const gv=V.filter(v=>sg(v.slot)&&(v.pg===1||v.pg===2)),gp=igPct(gv.filter(v=>v.pg===sg(v.slot)).length,gv.length);
 const rv=V.filter(v=>v.preg&&v.ereg),rp=igPct(rv.filter(v=>v.preg===v.ereg).length,rv.length);
 const ap=null;
 const dims=[['나이',ap,A.length,'원작 배우가 그 역을 맡았을 때와 5살 안쪽'],['성별',gp,gv.length,'배역 성별 그대로'],['국적권',rp,rv.length,'작품이 만들어질 나라의 배우']].filter(x=>x[1]!=null);
 const avg=dims.length?Math.round(dims.reduce((s,x)=>s+x[1],0)/dims.length):null;
 const ty=avg==null?'':avg>=80?'원작 충실형':avg<=50?'의외형 캐스팅':'충실과 의외 사이';
 const cnt=a=>{const m={};a.forEach(k=>{if(k)m[k]=(m[k]||0)+1});return Object.entries(m).sort((x,y)=>y[1]-x[1])};
 const gs=cnt(V.flatMap(v=>Array.isArray(v.g)?v.g:[])).slice(0,4),ns=cnt(V.map(v=>v.net)).slice(0,4),ks=cnt(V.map(v=>v.kind));
 const chips=(L,u)=>`<div class="arch">${L.map(([k,n])=>`<span style="--s:1" data-tip="${esc(k)} ${n}${u}">${esc(k)} <b>${n}</b></span>`).join('')}</div>`;
 return igCard('내 캐스팅 성향 리포트',avg==null?'':`원작 일치도 <b>${avg}%</b>, <b>${ty}</b>.`,
 `${dims.length?`<div class="sty">${dims.map(([l,p,n,t])=>`<div data-tip="${esc(t)}: ${n}개 중 ${p}%"><small>${l}</small><span><i style="width:${p}%"></i></span><b>${p}%</b></div>`).join('')}<p class="ig-cap">원작과 같은 결로 고른 비율</p></div>`:''}
 ${gs.length?`<p class="ig-sub">자주 고른 장르</p>${chips(gs,'표')}`:''}
 ${ns.length?`<p class="ig-sub">자주 고른 방송사, 플랫폼</p>${chips(ns,'표')}`:''}
 ${ks.length>1?`<p class="ig-cap">${ks.map(([k,n])=>`${esc(k)} ${n}표`).join(', ')}</p>`:''}`)}
