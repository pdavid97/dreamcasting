/* 글로벌 내비게이션: 모바일은 하단 탭 5개, 데스크탑은 상단 메뉴. 화면 상태는 body[data-view] 하나로 관리 */
var VIEWX=null;
function curView(){if(PAGE)return 'page';if(DECKV)return 'deck';if(VIEWX)return VIEWX;if(HOMEV)return 'explore';return 'topic'}
function applyView(){document.body.dataset.view=curView()}
function navItems(){const v=curView(),me=PROF?'#u/'+encodeURIComponent(PROF.nickname):'#me',myPage=v==='page'&&PAGE&&PAGE.kind==='u'&&PROF&&PAGE.nick===PROF.nickname;
 const unread=(typeof NOTICES!=='undefined'&&NOTICES?NOTICES.filter(x=>!x.read).length:0);
 return [['#','광장',IC.home,v==='deck'],['#explore','작품',IC.grid,v==='explore'||v==='topic'],['#vs','VS 한판',IC.vs,v==='vs'],['#rank','랭킹',IC.trophy,v==='rank'||(v==='page'&&PAGE&&PAGE.kind==='a')],[me,USER?(PROF?'나':'닉네임'):'로그인',IC.user,myPage,unread]]}
function renderTabbar(){applyView();const html=navItems().map(x=>`<a href="${x[0]}" class="${x[3]?'on':''}" ${x[3]?'aria-current="page"':''}${x[4]?` aria-label="${x[1]}, 새 알림 ${x[4]}개"`:''}>${x[2]}${x[4]?`<i class="tb-badge">${x[4]>9?'9+':x[4]}</i>`:''}<span>${x[1]}</span></a>`).join('');
 const b=$('#tabbar');if(b)b.innerHTML=html;const g=$('#gnav');if(g)g.innerHTML=html}
/* 특수 주소: 홈(오늘의 카드), 작품, VS 한판, 랭킹, 만들기, 나 */
function navSpecial(h){VIEWX=null;
 if(!h||h==='home'){showHome(false);showDeck(true);renderTabbar();scrollTo({top:0});return}
 showDeck(false);
 if(h==='explore'){showHome(true);renderTabbar();scrollTo({top:0});track('explore_view');return}
 if(h==='search'){showHome(true);renderTabbar();scrollTo({top:0});setTimeout(()=>$('#gq')&&$('#gq').focus(),50);return}
 if(h==='vs'){showHome(false);VIEWX='vs';renderTabbar();renderDuel();scrollTo({top:0});track('vs_view');return}
 if(h==='rank'||h==='actors'){showHome(false);VIEWX='rank';renderTabbar();scrollTo({top:0});track('rank_view');return}
 if(h==='make'){showHome(true);renderTabbar();$('#propBox').open=true;$('#propBox').scrollIntoView({behavior:'smooth'});return}
 if(h==='me'){renderTabbar();if(needLogin())return;if(PROF)location.hash='u/'+encodeURIComponent(PROF.nickname);return}
 showHome(true);renderTabbar()}

/* 상단 바를 없애고 검색은 작품 탭 맨 위로 */
(function(){const f=$('#gs'),t=$('#tabs');if(f&&t&&t.parentNode){t.parentNode.insertBefore(f,t);f.classList.add('xsearch')}const c=document.querySelector('.chy');if(c&&t&&t.parentNode)t.parentNode.insertBefore(c,f||t)})();
document.addEventListener('click',e=>{const b=e.target.closest('[data-act="loginClose"]');if(b||e.target.id==='loginModal')$('#loginModal').classList.remove('on')});
