'use strict';

const SECTIONS = {
  '12.1':'Programación dinámica',
  '12.2':'Ecuación de Euler',
  '12.3':'Horizonte infinito',
  '12.4':'Principio del máximo',
  '12.5':'Más variables'
};
const CATEGORIES = [
  {key:'calculo',label:'Cálculo',icon:'C',color:'var(--blue)',solid:'#77d9ff',description:'Cuentas y respuesta numérica'},
  {key:'vf',label:'V/F',icon:'V',color:'var(--green)',solid:'#91efaa',description:'Verdadero y falso'},
  {key:'formulacion',label:'Formulación',icon:'F',color:'var(--yellow)',solid:'#ffe483',description:'Modelación y formulación del problema'},
  {key:'evaluacion',label:'Evaluación',icon:'e',color:'var(--purple)',solid:'#d8c1ff',description:'Preguntas de evaluación y análisis'},
  {key:'conceptual',label:'Análisis',icon:'a',color:'var(--pink)',solid:'#ffc5b5',description:'Comprensión y análisis conceptual'},
  {key:'otros',label:'Reto',icon:'★',color:'#dfe8f2',solid:'#dfe8f2',description:'Preguntas complementarias y retos'}
];
const PLAYER_COLORS = ['#00a7ff','#ff3b30','#20d36b','#ffd21e','#9b5cff','#ff7a00'];
const $ = id => document.getElementById(id);
const rint = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const categoryByKey = key => CATEGORIES.find(c=>c.key===key) || CATEGORIES[0];
const categoryShort = key => ({calculo:'C', vf:'V', formulacion:'F', evaluacion:'e', conceptual:'a', otros:'★'})[key] || String(key).toUpperCase();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let state = {
  selectedSections:['12.1','12.2','12.3','12.4','12.5'], players:[], current:0,
  level:'medio', qTime:90, timeLeft:0, paused:false, timerId:null,
  board:[], nodeMap:new Map(), graph:new Map(), coords:{}, activeQuestion:null,
  pendingCategory:null, pendingNode:null, finalChallenge:false, rolled:false, diceValue:0,
  reachable:[], routeLines:[], correctStreak:0, startedAt:null, endedAt:null,
  winner:null, history:[], lastQuestionTypes:[], pendingIsCheese:false, moving:false, questionStartedMs:0, security:{hidden:0,screenshot:0,fullscreen:0,blur:0,escape:0,screenShare:0,external:0,fastCalc:0,rightClick:0,devtools:0,total:0}, fullscreenRequired:true, fx:true, music:true, totalTimer:null, totalSeconds:0, quizAnnulled:false, annulReason:'', annulledAt:null, lastSecurityAttemptAt:0, ignoreSecurityUntil:0
};

function securityDefaults(){
  return {hidden:0,screenshot:0,fullscreen:0,blur:0,escape:0,screenShare:0,external:0,fastCalc:0,rightClick:0,devtools:0,total:0};
}
function ensureSecurityState(){
  state.security={...securityDefaults(), ...(state.security||{})};
  if(!Number.isFinite(state.security.total)){
    state.security.total=(state.security.hidden||0)+(state.security.screenshot||0)+(state.security.fullscreen||0)+(state.security.blur||0)+(state.security.escape||0)+(state.security.screenShare||0)+(state.security.external||0)+(state.security.fastCalc||0)+(state.security.rightClick||0)+(state.security.devtools||0);
  }
  return state.security;
}

function typeset(root=document.body){
  if(window.MathJax?.typesetPromise){ MathJax.typesetClear?.([root]); return MathJax.typesetPromise([root]).catch(console.warn); }
  return Promise.resolve();
}
function validTeacherPassword(value){
  const clean=String(value||'').trim().toLowerCase().replace(/\s+/g,'');
  const now=new Date();
  const valid=new Set();
  for(let d=-1; d<=1; d++){
    const x=new Date(now.getTime()+d*60000);
    valid.add(String(x.getHours()).padStart(2,'0')+String(x.getMinutes()).padStart(2,'0'));
  }
  return valid.has(clean);
}
function updateClock(){ const d=new Date(); const txt=d.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}); const c=$('clock'); if(c) c.textContent=txt; const gc=$('alwaysClockText'); if(gc) gc.textContent=txt; }
function formatTime(s){ const m=Math.floor(s/60), r=s%60; return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`; }
function startTotalTimer(){ clearInterval(state.totalTimer); state.totalSeconds=0; $('totalTime').textContent='00:00'; state.totalTimer=setInterval(()=>{state.totalSeconds++; $('totalTime').textContent=formatTime(state.totalSeconds);},1000); }
function showScreen(id){ ['lockScreen','setupScreen'].forEach(x=>$(x).classList.remove('active')); $('gameScreen').classList.add('hidden'); if(id==='gameScreen') $('gameScreen').classList.remove('hidden'); else $(id).classList.add('active'); updateClock(); setTimeout(()=>{ updateClock(); checkFullscreenState(); },80); }
function isFullScreen(){ return Boolean(document.fullscreenElement || document.webkitFullscreenElement); }
function fullscreenCapable(){ const el=document.documentElement; return Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled || el.requestFullscreen || el.webkitRequestFullscreen); }
async function requestFullScreen(){
  const el=document.documentElement;
  try{
    if(!isFullScreen()){
      if(el.requestFullscreen) await el.requestFullscreen({navigationUI:'hide'});
      else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  }catch(e){}
  setTimeout(()=>{ checkFullscreenState(); fitBoardToViewport(); },180);
}
function checkFullscreenState(){
  const block=$('fullscreenBlock');
  if(!block || !fullscreenCapable()) return;
  const required=state.fullscreenRequired;
  if(required && !isFullScreen()) block.classList.remove('hidden');
  else block.classList.add('hidden');
}
async function insistFullscreen(){
  if(state.fullscreenRequired && !isFullScreen()) await requestFullScreen();
  checkFullscreenState();
}
function armFullscreenFromGesture(){
  const go=()=>{ if(state.fullscreenRequired && !isFullScreen()) requestFullScreen(); };
  ['pointerdown','click','touchstart','keydown'].forEach(ev=>document.addEventListener(ev,go,{capture:true,passive:true}));
}
function setBoardView(mode){
  const frame=$('boardFrame'); frame.classList.remove('view-front','view-3d','view-orbit'); frame.classList.add(mode);
  ['frontViewBtn','threeDViewBtn','orbitViewBtn'].forEach(id=>$(id)?.classList.remove('selected'));
  ({'view-front':'frontViewBtn','view-3d':'threeDViewBtn','view-orbit':'orbitViewBtn'}[mode] && $({'view-front':'frontViewBtn','view-3d':'threeDViewBtn','view-orbit':'orbitViewBtn'}[mode]).classList.add('selected'));
}

function fitBoardToViewport(){
  const frame=$('boardFrame');
  const scene=$('boardScene');
  const zone=document.querySelector('.board-zone');
  if(!frame || !zone) return;
  const rect=zone.getBoundingClientRect();
  const topbar=document.querySelector('.game-topbar.compact');
  const topH=topbar?.getBoundingClientRect().height || 0;
  const w=Math.max(260, rect.width || window.innerWidth);
  const h=Math.max(260, rect.height || (window.innerHeight-topH));
  // El tamaño se calcula con el espacio real disponible para que el tablero no se corte
  // en PC, iPad, pantallas pequeñas o cuando el panel docente queda debajo.
  const pad = window.innerWidth < 700 ? 14 : 18;
  const maxNatural = window.innerWidth < 900 ? 900 : 1120;
  const minNatural = window.innerWidth < 700 ? 260 : 340;
  const size=Math.floor(Math.max(minNatural, Math.min(w-pad, h-pad, maxNatural)));
  frame.style.setProperty('--fit-board-size', size+'px');
  // Escala única para casillas, fichas, texto y caminos. Así todos los elementos
  // conservan proporción y posición al cambiar la resolución del dispositivo.
  const scale=Math.max(.50, Math.min(1.14, size/740));
  document.documentElement.style.setProperty('--board-scale', String(scale));
  if(scene) scene.style.setProperty('--board-scale', String(scale));
}

function toggleMusic(){ state.music=!state.music; $('musicBtn').textContent=`♫ Música ${state.music?'ON':'OFF'}`; }
function toggleFx(){ state.fx=!state.fx; $('fxBtn').textContent=`🔊 FX: ${state.fx?'ON':'OFF'}`; }

function initSetup(){
  $('sectionChoices').innerHTML=Object.entries(SECTIONS).map(([k,v])=>`<label class="check-card"><input type="checkbox" value="${k}" checked> <span><b>${k}</b> · ${v}</span></label>`).join('');
  renderPlayerConfig();
}
function renderPlayerConfig(){
  const n=Number($('playerCount').value||2); $('playersConfig').innerHTML='';
  for(let i=0;i<n;i++){
    const row=document.createElement('div'); row.className='player-row';
    row.innerHTML=`<input id="pname${i}" value="Jugador ${i+1}" maxlength="20"><div class="color-dot" style="background:${PLAYER_COLORS[i]};color:${PLAYER_COLORS[i]}"></div>`;
    $('playersConfig').appendChild(row);
  }
}
function createPlayers(){
  const n=Number($('playerCount').value||2); const wedges=Object.fromEntries(CATEGORIES.map(c=>[c.key,false]));
  state.players=Array.from({length:n},(_,i)=>({id:i,name:($(`pname${i}`)?.value||`Jugador ${i+1}`).trim()||`Jugador ${i+1}`,color:PLAYER_COLORS[i],pos:'C',wedges:{...wedges},correct:0,wrong:0,total:0,history:[]}));
}
function startGame(){
  const selected=Array.from(document.querySelectorAll('#sectionChoices input:checked')).map(x=>x.value);
  if(!selected.length){ alert('Selecciona al menos una sección.'); return; }
  state.selectedSections=selected; state.level=$('levelSelect').value; state.qTime=Number($('timeSelect').value||0); state.current=0;
  state.rolled=false; state.diceValue=0; state.correctStreak=0; state.history=[]; state.lastQuestionTypes=[]; state.pendingIsCheese=false; state.winner=null; state.security=securityDefaults(); state.quizAnnulled=false; state.annulReason=''; state.annulledAt=null; state.lastSecurityAttemptAt=0; state.ignoreSecurityUntil=0; state.fullscreenRequired=true; state.startedAt=new Date().toLocaleString('es-CO');
  document.body.classList.add('quiz-secure-active'); createPlayers(); buildBoard(); showScreen('gameScreen'); fitBoardToViewport(); renderBoard(); renderPlayers(); renderTurn(); startTotalTimer();
  $('sectionsPill').textContent=state.selectedSections.join(', '); $('modeInfo').textContent=`${state.level} · 1 anillo + radios`;
  setBoardView('view-front'); fitBoardToViewport();
  requestFullScreen(); setTimeout(checkFullscreenState,250); setTimeout(()=>typeset(),300);
}

function addNode(node){ state.board.push(node); state.nodeMap.set(node.id,node); state.graph.set(node.id,new Set()); }
function addEdge(a,b){ state.graph.get(a).add(b); state.graph.get(b).add(a); }
function buildBoard(){
  state.board=[]; state.nodeMap=new Map(); state.graph=new Map(); state.coords={};
  addNode({id:'C',kind:'center',label:'Centro',category:'final',text:'CENTRO',cheese:false});

  // Modelo corregido: un solo anillo exterior y seis radios hacia el centro,
  // como un Trivial Pursuit clásico. No hay anillos interiores de preguntas.
  const outerN=36, spokeLen=5, gateStep=outerN/6;

  for(let i=0;i<outerN;i++){
    const isGate=i%gateStep===0;
    const catIndex=isGate?Math.floor(i/gateStep):(i*3+Math.floor(i/2))%CATEGORIES.length;
    addNode({
      id:`O${i}`,
      kind:'outer',
      outerIndex:i,
      label:`Anillo exterior ${i}`,
      category:CATEGORIES[catIndex].key,
      text:CATEGORIES[catIndex].icon,
      cheese:false,
      spoke:isGate?Math.floor(i/gateStep):-1
    });
  }
  for(let i=0;i<outerN;i++) addEdge(`O${i}`,`O${(i+1)%outerN}`);

  for(let s=0;s<6;s++){
    const gate=`O${s*gateStep}`;
    for(let j=1;j<=spokeLen;j++){
      const cat=CATEGORIES[(s+j+(j%2?2:4))%CATEGORIES.length];
      const isCheese = j===2; // casilla queso claramente identificada
      addNode({
        id:`S${s}_${j}`,
        kind:'spoke',
        label:isCheese?`Radio ${s+1}.${j} · QUESO`:`Radio ${s+1}.${j}`,
        category:cat.key,
        text:cat.icon,
        cheese:isCheese,
        spoke:s,
        depth:j
      });
    }
    addEdge(gate,`S${s}_1`);
    for(let j=1;j<spokeLen;j++) addEdge(`S${s}_${j}`,`S${s}_${j+1}`);
    addEdge(`S${s}_${spokeLen}`,'C');
  }
}
function nodeAngleById(id){
  const node=state.nodeMap.get(id); if(!node) return -Math.PI/2;
  if(node.kind==='outer') return -Math.PI/2 + 2*Math.PI*node.outerIndex/36;
  if(node.kind==='spoke') return -Math.PI/2 + 2*Math.PI*node.spoke/6;
  return 0;
}
function computeCoord(node){
  const board=$('board');
  const size=board.clientWidth||900;
  const center=size/2;
  const R=size*.405;
  if(node.kind==='center') return {x:center,y:center};
  const angle=nodeAngleById(node.id);
  let r=R;
  if(node.kind==='spoke'){
    // Cinco casillas separadas entre el anillo y el centro, como en la referencia fotográfica.
    const radii=[0.333,0.268,0.203,0.138,0.073];
    r=size*radii[Math.max(0,Math.min(radii.length-1,node.depth-1))];
  }
  return {x:center+r*Math.cos(angle), y:center+r*Math.sin(angle)};
}
function renderBoard(){
  fitBoardToViewport();
  const board=$('board'); board.innerHTML=''; $('pathLayer').innerHTML=''; state.coords={};
  const baseSize=$('boardFrame')?.clientWidth || board.clientWidth || 900; const scale=Math.max(.55, Math.min(1.08, baseSize/740)); $('boardScene')?.style.setProperty('--board-scale', String(scale));
  state.board.forEach(node=>{
    const coord=computeCoord(node); state.coords[node.id]=coord;
    const cat=categoryByKey(node.category==='final'?'calculo':node.category);
    const div=document.createElement('div'); div.className=`tile ${node.kind} ${node.cheese?'cheese':''}`; div.dataset.node=node.id;
    const rot = node.kind==='center' ? 0 : (nodeAngleById(node.id) + Math.PI/2);
    div.style.setProperty('--rot', `${rot}rad`);
    div.style.left=coord.x+'px'; div.style.top=coord.y+'px';
    div.style.background=node.kind==='center'?'':`linear-gradient(180deg, color-mix(in srgb, ${cat.solid} 92%, white 8%), ${cat.solid})`;
    div.style.color=node.kind==='center'?'#07172c':'#07172c';
    div.title=`${node.label} · ${node.kind==='center'?'Pregunta central':cat.label}${node.cheese?' · PREGUNTA QUESO':''}`;
    const symbol=cat.icon || categoryShort(node.category);
    div.innerHTML=node.kind==='center'?
      `<span class="center-logo" aria-hidden="true">▣</span><strong class="center-caption">CENTRO</strong><small>elige tu ruta</small>`:
      (node.cheese?
        `<span class="tile-symbol cheese-symbol">${symbol}</span><em>Q</em>`:
        `<span class="tile-symbol solo">${symbol}</span>`);
    div.addEventListener('click',()=>chooseDestination(node.id));
    board.appendChild(div);
  });
  renderTokens(); renderReachableHighlights();
}
function renderTokens(){
  const layer=$('tokenLayer');
  layer.innerHTML='';
  const groups=new Map();
  state.players.forEach(p=>{ if(!groups.has(p.pos)) groups.set(p.pos,[]); groups.get(p.pos).push(p); });
  const board=$('board');
  const base=Math.max(4, Math.min(10, (board?.clientWidth||700)*0.013));
  const offsets=[[-base,-base],[base,-base],[-base,base],[base,base],[0,-base*1.35],[0,base*1.35]];
  state.players.forEach(p=>{
    const coord=state.coords[p.pos]||computeCoord(state.nodeMap.get(p.pos)||state.nodeMap.get('C'));
    const group=groups.get(p.pos)||[p];
    const idx=group.findIndex(g=>g.id===p.id);
    const token=document.createElement('div');
    token.className='token';
    token.dataset.player=String(p.id);
    token.style.setProperty('--player-color', p.color);
    token.style.setProperty('color', '#ffffff', 'important');
    token.style.setProperty('background', `radial-gradient(circle at 34% 24%, #fff 0 7%, rgba(255,255,255,.78) 8% 18%, ${p.color} 42%, color-mix(in srgb, ${p.color} 72%, #000 28%) 100%)`, 'important');
    // La ficha queda solapando la casilla. Si varias fichas caen en la misma casilla,
    // se abre una micro-distribución dentro de esa casilla para que cada pelota conserve
    // su color y siga estando encima del espacio, no al lado del tablero.
    const micro = group.length>1 ? offsets[idx%6] : [0,0];
    token.style.left=(coord.x+micro[0])+'px';
    token.style.top=(coord.y+micro[1])+'px';
    token.style.zIndex=String(220+idx);
    token.textContent=String(p.id+1);
    token.title=`${p.name} · ficha ${idx+1}`;
    layer.appendChild(token);
  });
}
function renderReachableHighlights(){
  document.querySelectorAll('.tile').forEach(t=>{t.classList.remove('reachable','current-choice','final-eligible');}); $('pathLayer').innerHTML='';
  const p=state.players[state.current]; if(p){ const current=document.querySelector(`.tile[data-node="${p.pos}"]`); current?.classList.add('current-choice'); if(p.pos==='C' && allWedges(p)) current?.classList.add('final-eligible'); }
  state.reachable.forEach(opt=>{ document.querySelector(`.tile[data-node="${opt.node}"]`)?.classList.add('reachable'); drawPath(opt.path); });
}
function drawPath(path){
  if(!path || path.length<2) return; const poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');
  const board=$('board'), size=board.clientWidth||900; const pts=path.map(id=>{const c=state.coords[id]; return `${(c.x/size*1000).toFixed(1)},${(c.y/size*1000).toFixed(1)}`;}).join(' ');
  poly.setAttribute('points',pts); poly.setAttribute('class','route-line'); $('pathLayer').appendChild(poly);
}
function getReachable(start, dist){
  const out=[], seen=new Map([[start,0]]), queue=[{id:start,d:0,path:[start]}];
  while(queue.length){ const cur=queue.shift(); if(cur.d===dist){ if(cur.id!==start) out.push({node:cur.id,path:cur.path}); continue; }
    for(const nb of state.graph.get(cur.id)||[]){ const nd=cur.d+1; const key=`${nb}|${nd}|${cur.path.slice(-2).join('-')}`; if(cur.path.length>1 && nb===cur.path[cur.path.length-2]) continue; if(nd<=dist){ queue.push({id:nb,d:nd,path:[...cur.path,nb]}); } }
  }
  const map=new Map(); out.forEach(o=>{ if(!map.has(o.node) || o.path.length<map.get(o.node).path.length) map.set(o.node,o); });
  return Array.from(map.values()).slice(0,20);
}
function rollDice(){
  if(state.rolled||state.winner) return; state.rolled=true; $('rollBtn').disabled=true; clearReachable();
  $('dice').classList.add('rolling'); let ticks=0;
  const anim=setInterval(()=>{ $('dice').textContent=rint(1,6); if(++ticks>9){ clearInterval(anim); state.diceValue=rint(1,6); $('dice').textContent=state.diceValue; $('dice').classList.remove('rolling'); showMoveOptions(state.diceValue); }},60);
}
function showMoveOptions(d){
  const p=state.players[state.current]; state.reachable=getReachable(p.pos,d);
  renderReachableHighlights();
  $('moveHint').textContent=`Resultado ${d}: elige una de las ${state.reachable.length} casillas iluminadas.`;
  $('gameLog').textContent=`${p.name}, selecciona la ruta. Las flechas azules muestran todos los destinos posibles con el dado.`;
}
function clearReachable(){ state.reachable=[]; renderReachableHighlights(); }
async function animateTokenAlongPath(player, path){
  if(!player || !path || path.length<2) return;
  let token=document.querySelector(`.token[data-player="${player.id}"]`);
  if(!token){ renderTokens(); token=document.querySelector(`.token[data-player="${player.id}"]`); }
  if(!token) return;
  token.classList.add('moving');
  token.style.transition='left .46s linear, top .46s linear';
  for(const id of path.slice(1)){
    const coord=state.coords[id] || computeCoord(state.nodeMap.get(id));
    player.pos=id;
    token.classList.remove('hopping'); void token.offsetWidth; token.classList.add('hopping');
    token.style.left=coord.x+'px';
    token.style.top=coord.y+'px';
    renderPlayers();
    await sleep(500);
  }
  token.classList.remove('moving','hopping');
  token.style.transition='';
}
async function chooseDestination(nodeId){
  if(!state.rolled || state.winner || state.moving) return;
  const opt=state.reachable.find(o=>o.node===nodeId); if(!opt) return;
  state.moving=true; $('rollBtn').disabled=true;
  const p=state.players[state.current]; clearReachable();
  $('gameLog').textContent=`${p.name} se mueve paso a paso hasta la casilla elegida.`;
  await animateTokenAlongPath(p,opt.path);
  p.pos=nodeId; renderTokens(); renderPlayers(); state.moving=false;
  const node=state.nodeMap.get(nodeId); state.pendingNode=nodeId; state.pendingIsCheese=!!node.cheese;
  if(nodeId==='C'){
    state.pendingIsCheese=false;
    if(allWedges(p)){ state.pendingCategory='final'; state.finalChallenge=true; $('gameLog').textContent=`${p.name} llegó al centro con 6 quesos. Debe responder la pregunta final.`; const q=generateFinalQuestion(); q.isCheese=false; setTimeout(()=>showQuestion(q),350); }
    else { state.pendingCategory='calculo'; state.finalChallenge=false; $('gameLog').textContent=`${p.name} llegó al centro, pero aún necesita completar los 6 quesos.`; const q=generateQuestion('calculo'); q.isCheese=false; setTimeout(()=>showQuestion(q),350); }
    return;
  }
  state.pendingCategory=node.category; state.finalChallenge=false; const cat=categoryByKey(node.category);
  $('gameLog').textContent=node.cheese?`${p.name} cayó en casilla QUESO de ${cat.label}. Si acierta gana ese queso.`:`${p.name} cayó en ${cat.label}. Es tarjeta de práctica: acierta para seguir, pero no entrega queso.`;
  const q=generateQuestion(cat.key); q.isCheese=!!node.cheese; setTimeout(()=>showQuestion(q),350);
}
function nextPlayer(){ state.moving=false; state.current=(state.current+1)%state.players.length; state.correctStreak=0; state.pendingIsCheese=false; state.rolled=false; state.diceValue=0; $('dice').textContent='?'; clearReachable(); renderTurn(); renderPlayers(); }
function samePlayerAgain(){ state.moving=false; state.pendingIsCheese=false; state.rolled=false; state.diceValue=0; $('dice').textContent='?'; clearReachable(); renderTurn(); renderPlayers(); }
function allWedges(p){ return CATEGORIES.every(c=>p.wedges[c.key]); }
function finishWithWinner(p){ if(state.quizAnnulled) return; state.winner=p.name; state.endedAt=new Date().toLocaleString('es-CO'); clearInterval(state.totalTimer); renderPlayers(); $('gameLog').textContent=`🏆 ${p.name} respondió el reto final y ganó la partida.`; $('rollBtn').disabled=true; showReport(true); }
function playerGrade(p){ if(state.quizAnnulled) return 0; const base=p.total?(p.correct/p.total)*50:0; const bonus=state.winner===p.name?10:0; return Math.min(50,base+bonus); }
function nodeLabel(id){ const n=state.nodeMap.get(id); return n?.label || id; }
function renderPlayers(){
  $('playersPanel').innerHTML=state.players.map((p,i)=>{
    const wedges=CATEGORIES.map(c=>`<span class="wedge ${p.wedges[c.key]?'on':''}" style="background:${c.solid};color:${c.solid}" title="${c.label}"></span>`).join('');
    const pct=p.total?Math.round(100*p.correct/p.total):0; const complete=allWedges(p);
    return `<div class="player-card ${i===state.current?'active':''}" style="color:${p.color}"><div class="player-head"><div><div class="player-name" style="color:${p.color}">${p.name}</div><div class="player-sub">${nodeLabel(p.pos)} ${complete?'· busca el centro':''}</div></div><div class="points">${p.correct} pts</div></div><div class="wedges">${wedges}</div><div class="stats">Aciertos: ${p.correct}/${p.total} · ${pct}% · Nota: ${playerGrade(p).toFixed(1)}/50</div><div class="bar"><span style="width:${pct}%"></span></div></div>`;
  }).join('');
}
function renderTurn(){ const p=state.players[state.current]; $('turnText').textContent=p?`${p.name} está en turno. ${allWedges(p)?'Busca el centro para el reto final.':'Completa tus quesos y vuelve al centro.'}`:'Jugador'; $('rollBtn').disabled=state.rolled||!p||!!state.winner||!!state.quizAnnulled; }
function commonFeedback(steps,mistake){
  return `<div class="process-title"><b>Proceso específico de esta tarjeta:</b></div>
  <ol class="feedback-steps">
    <li><b>Usa solamente la expresión y los datos que aparecen en esta pregunta.</b> No mezcles fórmulas de otras tarjetas.</li>
    <li><b>Ejecuta el paso matemático central de esta pregunta.</b> ${steps}</li>
    <li><b>Concluye exactamente lo que la tarjeta pide.</b> La respuesta final debe ser el número, opción, conjunto de afirmaciones o patrón V/F obtenido en el cálculo anterior.</li>
  </ol>
  <div class="feedback-warning"><b>Error concreto que esta pregunta busca evitar:</b> ${mistake}</div>`;
}
function numericQ(section,cat,title,prompt,answer,feedback,hint=''){return {section,category:cat,type:'calculo',title,prompt,answer:Number(answer),feedback,hint,isCalc:true};}
function mcQ(section,cat,title,prompt,options,correct,feedback,hint='',isCalc=true){return {section,category:cat,type:'mc',title,prompt,options,correct,feedback,hint,isCalc};}
function multiQ(section,cat,title,prompt,options,correctSet,feedback,hint='',isCalc=true){return {section,category:cat,type:'multi',title,prompt,options,correctSet,feedback,hint,isCalc};}
function tfQ(section,cat,title,prompt,statements,feedback,hint='',isCalc=true){return {section,category:cat,type:'tf',title,prompt,statements,feedback,hint,isCalc};}
const FACTORIES = [
  {section:'12.1', cats:['calculo','formulacion'], calc:true, make(){ const b=rint(1,5), k=rint(1,6), m=2*b*k; return numericQ('12.1','formulacion','Bellman de un paso',`Suponga que \\(J_{s+1}(x)=${m}x+7\\) y que se debe maximizar \\[\\Phi(u)=1+x-${b}u^2+J_{s+1}(x+u).\\] Calcule el entero \\(u^*\\).`,k,commonFeedback(`\\(\\Phi'(u)=-${2*b}u+${m}\\). Entonces \\(u^*=${m}/${2*b}=${k}\\).`,'No se deriva \\(J_{s+1}\\) como constante: se evalúa en \\(x+u\\).'),'Deriva respecto a \\(u\\).');}},
  {section:'12.1', cats:['calculo','formulacion'], calc:true, make(){ const x0=rint(0,5), u0=rint(1,4), u1=rint(1,4), u2=rint(1,4); const ans=x0+u0+u1+u2; return numericQ('12.1','calculo','Trayectoria admisible',`En la transición \\(x_{t+1}=x_t+u_t\\), con \\(x_0=${x0}\\), \\(u_0=${u0}\\), \\(u_1=${u1}\\), \\(u_2=${u2}\\), calcule \\(x_3\\).`,ans,commonFeedback(`\\(x_1=${x0}+${u0}\\), \\(x_2=x_1+${u1}\\), \\(x_3=x_2+${u2}=${ans}\\).`,'Hay que iterar tres veces, no sumar solo el último control.'),'Construye la trayectoria periodo por periodo.');}},
  {section:'12.1', cats:['calculo','formulacion'], calc:true, make(){ const A=rint(2,5), b=rint(1,4), k=rint(1,5), m=2*b*k; return numericQ('12.1','formulacion','Control con transición amplificada',`Si \\(J_{s+1}(x)=${m}x\\), \\(g(x,u)=x+${A}u\\) y \\(f(x,u)=x-${b*A}u^2\\), calcule \\(u^*\\) al maximizar \\(f(x,u)+J_{s+1}(g(x,u))\\).`,k,commonFeedback(`La derivada es \\(-${2*b*A}u+${m*A}=0\\). Por tanto \\(u^*=${k}\\).`,'El factor de la transición también entra por regla de la cadena.'),'Sustituye primero \\(g(x,u)\\).');}},
  {section:'12.1', cats:['calculo','formulacion'], calc:true, make(){ const a=rint(2,5), x=rint(5,12), u=rint(1,5); const ans=a*(x-u); return numericQ('12.1','calculo','Ahorro y estado futuro',`En un modelo de consumo-ahorro, \\(x_{t+1}=${a}(x_t-u_t)\\). Si \\(x_t=${x}\\) y \\(u_t=${u}\\), calcule \\(x_{t+1}\\).`,ans,commonFeedback(`\\(x_{t+1}=${a}(${x}-${u})=${ans}\\).`,'El control se resta del estado antes de multiplicar por el retorno.'),'Primero ahorro, luego retorno.');}},
  {section:'12.1', cats:['vf','formulacion'], calc:true, make(){ return tfQ('12.1','vf','Falso/Verdadero con Bellman',`Considere \\(\\Phi(u)=1+x-2u^2+8(x+u)\\). Marque V o F.`,[{text:`La condición de primer orden es \\(-4u+8=0\\).`,value:true},{text:`El control óptimo entero es \\(u^*=4\\).`,value:false},{text:`La función es cóncava en \\(u\\).`,value:true}],commonFeedback(`\\(\\Phi'(u)=-4u+8\\), así \\(u^*=2\\), no 4.`,'No confundas el coeficiente lineal con el óptimo.'),'Deriva y revisa la concavidad.');}},
  {section:'12.1', cats:['vf','formulacion'], calc:false, make(){ return multiQ('12.1','vf','Varias afirmaciones: Bellman',`Para un problema finito con \\(x_{t+1}=g(t,x_t,u_t)\\), seleccione las afirmaciones correctas.`,[`La función de valor resume el valor máximo desde un estado.`,`La ecuación de Bellman se resuelve hacia atrás desde la condición terminal.`,`Toda trayectoria factible es óptima.`,`El control puede depender del estado en retroalimentación.`],[0,1,3],commonFeedback('I, II y IV son correctas. La factibilidad no garantiza optimalidad.','La palabra “toda” suele esconder el error conceptual.'),'Distingue factibilidad de optimalidad.',false);}},
  {section:'12.1', cats:['calculo','formulacion'], calc:true, make(){ const T=rint(3,6), s=rint(0,2); const ans=T-s; return numericQ('12.1','calculo','Número de etapas restantes',`Si el horizonte terminal es \\(T=${T}\\) y se está en el tiempo \\(s=${s}\\), ¿cuántas decisiones quedan desde \\(s\\) hasta \\(T-1\\)?`,ans,commonFeedback(`Las decisiones son \\(u_s,u_{s+1},\\ldots,u_{T-1}\\), en total \\(T-s=${ans}\\).`,'No cuentes \\(u_T\\) cuando la transición termina en \\(x_T\\).'),'Cuenta controles, no estados.');}},

  {section:'12.2', cats:['calculo','evaluacion'], calc:true, make(){ const a=rint(1,4), r=rint(1,6), xm=rint(2,9), xt=rint(1,6), xp=rint(2,9); const ans=xp+r+xm-2*a*xt; return numericQ('12.2','evaluacion','Euler con polinomio',`Sea \\(F(x,y)=xy-${a}y^2+${r}x\\). Con \\(x_{t-1}=${xm}\\), \\(x_t=${xt}\\), \\(x_{t+1}=${xp}\\), calcule \\[F_1(x_t,x_{t+1})+F_2(x_{t-1},x_t).\\]`,ans,commonFeedback(`\\(F_1(x,y)=y+${r}\\), \\(F_2(x,y)=x-${2*a}y\\). Valor: \\(${xp}+${r}+${xm}-${2*a}(${xt})=${ans}\\).`,'La Euler suma derivadas de dos términos consecutivos.'),'Calcula cada derivada parcial en el punto correcto.');}},
  {section:'12.2', cats:['calculo','evaluacion'], calc:true, make(){ const beta=2, xt=rint(5,12), xp=rint(1,4); const ans=xt-beta*xp; return numericQ('12.2','evaluacion','Consumo implícito',`En la transformación sin control explícito, sea \\(c_t=x_t-\\beta x_{t+1}\\). Si \\(\\beta=${beta}\\), \\(x_t=${xt}\\) y \\(x_{t+1}=${xp}\\), calcule \\(c_t\\).`,ans,commonFeedback(`\\(c_t=${xt}-${beta}(${xp})=${ans}\\).`,'El consumo no es \\(x_{t+1}-\\beta x_t\\); respeta el orden.'),'Sustituye directamente.');}},
  {section:'12.2', cats:['calculo','evaluacion'], calc:true, make(){ const xm=rint(1,5), xt=rint(3,8), ans=2*xt-xm; return numericQ('12.2','evaluacion','Ecuación de Euler lineal',`Una Euler discreta conduce a \\(x_{t+1}-2x_t+x_{t-1}=0\\). Si \\(x_{t-1}=${xm}\\) y \\(x_t=${xt}\\), calcule \\(x_{t+1}\\).`,ans,commonFeedback(`\\(x_{t+1}=2x_t-x_{t-1}=2(${xt})-${xm}=${ans}\\).`,'No es una ecuación de primer orden: usa dos estados anteriores.'),'Despeja \\(x_{t+1}\\).');}},
  {section:'12.2', cats:['vf','evaluacion'], calc:true, make(){ return tfQ('12.2','vf','V/F con Euler logarítmica',`Para \\(F(x,y)=\\ln(x-2y)\\), marque V o F.`,[{text:`\\(F_1(x,y)=\\frac{1}{x-2y}\\).`,value:true},{text:`\\(F_2(x,y)=\\frac{2}{x-2y}\\).`,value:false},{text:`La variable \\(x_t\\) aparece en dos términos consecutivos del funcional.`,value:true}],commonFeedback(`La segunda es falsa porque \\(F_2(x,y)=-2/(x-2y)\\).`,'El signo negativo viene de derivar \\(x-2y\\).'),'Atención al signo en \\(F_2\\).');}},
  {section:'12.2', cats:['vf','evaluacion'], calc:true, make(){ return multiQ('12.2','vf','Seleccione derivadas correctas',`Sea \\(F(t,x,y)=t+x^2-3xy\\). Seleccione todas las expresiones correctas.`,[`\\(F_1(t,x,y)=2x-3y\\)`,`\\(F_2(t,x,y)=-3x\\)`,`\\(F_1(t,x,y)=2y-3x\\)`,`La Euler interior usa \\(F_2(t-1,x_{t-1},x_t)+F_1(t,x_t,x_{t+1})\\).`],[0,1,3],commonFeedback('Las correctas son I, II y IV. La III intercambia variables.','No confundas derivar respecto a la primera variable de estado con derivar respecto a la segunda.'),'Deriva con respecto a \\(x\\) y \\(y\\).');}},
  {section:'12.2', cats:['calculo','evaluacion'], calc:true, make(){ const A=rint(1,4), B=rint(1,5), x=rint(1,6), y=rint(1,6); const ans=2*A*x+B*y; return numericQ('12.2','evaluacion','Derivada parcial evaluada',`Sea \\(F(x,y)=${A}x^2+${B}xy-y^2\\). Calcule \\(F_1(x,y)\\) en \\((x,y)=(${x},${y})\\).`,ans,commonFeedback(`\\(F_1=2(${A})x+${B}y\\). Evaluando: \\(${2*A}(${x})+${B}(${y})=${ans}\\).`,'No derives el término \\(-y^2\\) respecto a \\(x\\).'),'Solo se deriva respecto a la primera variable.');}},

  {section:'12.3', cats:['calculo','conceptual'], calc:true, make(){ const n=rint(2,9), c=rint(1,6); const ans=c*n; return numericQ('12.3','conceptual','Bellman estacionaria lineal',`Si el coeficiente \\(B\\) de una función de valor satisface \\[B=${c}+\\left(1-\\frac1{${n}}\\right)B,\\] calcule el entero \\(B\\).`,ans,commonFeedback(`\\(B-(1-1/${n})B=${c}\\Rightarrow B/${n}=${c}\\Rightarrow B=${ans}\\).`,'No trates \\(B\\) como si estuviera solo en el lado izquierdo.'),'Pasa los términos con \\(B\\) al mismo lado.');}},
  {section:'12.3', cats:['calculo','conceptual'], calc:true, make(){ const a=pick([8,12,16,20]), b=pick([12,16,20,24]), c=pick([16,24,32,40]); const ans=a+b/2+c/4; return numericQ('12.3','calculo','Suma descontada finita',`Con descuento \\(\\beta=\\frac12\\), calcule \\[${a}+\\frac12(${b})+\\frac14(${c}).\\]`,ans,commonFeedback(`La suma es \\(${a}+${b/2}+${c/4}=${ans}\\).`,'Aplica el descuento a cada periodo, no a la suma completa.'),'Evalúa término por término.');}},
  {section:'12.3', cats:['calculo','conceptual'], calc:true, make(){ const n=rint(2,6), k=rint(2,8), d=n*k; const ans=k; return numericQ('12.3','conceptual','Cota de contracción',`Si \\(d(J,K)=${d}\\) y \\(\\beta=\\frac1{${n}}\\), calcule el entero \\(\\beta d(J,K)\\).`,ans,commonFeedback(`\\(\\beta d(J,K)=\\frac1{${n}}\\cdot ${d}=${ans}\\).`,'El descuento debe cumplir \\(0<\\beta<1\\); por eso se usa una fracción.'),'Multiplica por el descuento.');}},
  {section:'12.3', cats:['calculo','conceptual'], calc:true, make(){ const a=rint(1,4), b=rint(1,5), x=rint(1,6); const ans=a*x+b; return numericQ('12.3','calculo','Dinámica estacionaria',`Para la ley estacionaria \\(x_{t+1}=${a}x_t+${b}\\), con \\(x_t=${x}\\), calcule \\(x_{t+1}\\).`,ans,commonFeedback(`\\(x_{t+1}=${a}(${x})+${b}=${ans}\\).`,'En horizonte infinito la ley se repite sin depender explícitamente de \\(t\\).'),'Sustituye el estado actual.');}},
  {section:'12.3', cats:['vf','conceptual'], calc:false, make(){ return multiQ('12.3','vf','Varias afirmaciones: horizonte infinito',`Seleccione las afirmaciones correctas sobre la ecuación de Bellman estacionaria.`,[`Se escribe típicamente como \\(J(x)=\\max_u\\{f(x,u)+\\beta J(g(x,u))\\}\\).`,`El descuento ayuda a valorar pagos futuros.`,`La función de valor siempre depende explícitamente de \\(t\\).`,`El método de adivinar y verificar exige sustituir la forma candidata.`],[0,1,3],commonFeedback('I, II y IV son correctas. En el caso estacionario no se necesita \\(J_t\\).','No confundas horizonte infinito estacionario con horizonte finito.'),'Piensa en autonomía y descuento.',false);}},
  {section:'12.3', cats:['calculo','conceptual'], calc:true, make(){ const a=rint(1,4), x=rint(2,8), u=rint(1,4); const ans=-(x*x+u*u+a*x*u); return numericQ('12.3','calculo','Pago cuadrático',`En una Bellman aparece \\(f(x,u)=-(x^2+u^2+${a}xu)\\). Calcule \\(f(${x},${u})\\).`,ans,commonFeedback(`\\(f=-(${x}^2+${u}^2+${a}\\cdot${x}\\cdot${u})=${ans}\\).`,'El signo negativo afecta toda la suma.'),'Calcula dentro del paréntesis y cambia el signo.');}},

  {section:'12.4', cats:['calculo','otros'], calc:true, make(){ const b=rint(1,5), k=rint(1,6), c=2*b*k; return numericQ('12.4','otros','FOC del Hamiltoniano',`Sea \\(H=-${b}u^2+p(x+${c}u)\\). De \\(H_u=0\\), se obtiene \\(u^*=Kp\\). Calcule el entero \\(K\\).`,k,commonFeedback(`\\(H_u=-${2*b}u+${c}p=0\\Rightarrow u=(${c}/${2*b})p=${k}p\\).`,'No se iguala \\(H\\) a cero; se deriva respecto al control.'),'Deriva respecto a \\(u\\).');}},
  {section:'12.4', cats:['calculo','otros'], calc:true, make(){ const p=rint(1,6); const ans=1+p; return numericQ('12.4','otros','Ecuación adjunta',`Para \\(H=1+x-u^2+p(x+3u)\\), calcule \\(H_x\\) cuando \\(p=${p}\\).`,ans,commonFeedback(`\\(H_x=1+p\\cdot1=1+${p}=${ans}\\).`,'No uses \\(g_u\\) cuando se pide \\(H_x\\).'),'Diferencia control y estado.');}},
  {section:'12.4', cats:['calculo','otros'], calc:true, make(){ const T=rint(3,7), t=rint(0,2); const ans=T-t; return numericQ('12.4','otros','Coestado hacia atrás',`En el ejemplo con \\(H=1+x-u^2+p(x+u)\\) y \\(p_T=0\\), se obtiene \\(p_{t-1}=1+p_t\\). Si \\(T=${T}\\), calcule \\(p_${t}\\).`,ans,commonFeedback(`Como \\(p_T=0\\) y cada paso hacia atrás suma 1, \\(p_t=T-t=${ans}\\).`,'La adjunta se calcula hacia atrás, no hacia adelante.'),'Empieza en \\(p_T=0\\).');}},
  {section:'12.4', cats:['calculo','otros'], calc:true, make(){ const beta=rint(1,3), x=rint(2,8), w=rint(4,10), v=rint(1,3), p=rint(1,4); const ans=beta*x*(w-2*v)-p*x; return numericQ('12.4','otros','Extracción de petróleo',`En un modelo de extracción, \\(H_v=\\beta x(w-2v)-px\\). Calcule \\(H_v\\) si \\(\\beta=${beta}\\), \\(x=${x}\\), \\(w=${w}\\), \\(v=${v}\\), \\(p=${p}\\).`,ans,commonFeedback(`\\(H_v=${beta}(${x})(${w}-2${v})-${p}(${x})=${ans}\\).`,'Primero calcula \\(w-2v\\).'),'Sustituye con cuidado.');}},
  {section:'12.4', cats:['vf','otros'], calc:false, make(){ return tfQ('12.4','vf','V/F: principio del máximo discreto',`Marque V o F sobre el principio del máximo discreto con una variable.`,[{text:`Si el control interior es óptimo, se usa \\(H_u=0\\).`,value:true},{text:`El Hamiltoniano siempre se maximiza en el control en el caso discreto.`,value:false},{text:`La ecuación adjunta típica es \\(p_{t-1}=H_x(t,x_t^*,u_t^*,p_t)\\).`,value:true}],commonFeedback('La segunda es falsa: en el caso discreto la condición variacional no siempre implica maximización directa del Hamiltoniano.','El teorema da condiciones necesarias; revisa suficiencia con concavidad.'),'Recuerda la diferencia con tiempo continuo.',false);}},
  {section:'12.4', cats:['calculo','otros'], calc:true, make(){ const a=rint(1,5), p=rint(1,6), u=rint(1,5); const ans=-2*u+a*p; return numericQ('12.4','otros','Derivada respecto al control',`Sea \\(H=-u^2+p(x+${a}u)\\). Calcule \\(H_u\\) en \\(u=${u}\\), \\(p=${p}\\).`,ans,commonFeedback(`\\(H_u=-2u+${a}p=-2(${u})+${a}(${p})=${ans}\\).`,'No derives \\(px\\) respecto a \\(u\\): es cero.'),'Deriva término a término.');}},

  {section:'12.5', cats:['calculo','otros'], calc:true, make(){ const a=rint(1,4), b=rint(1,4), x=rint(1,5), p1=rint(1,4), p2=rint(1,4); const ans=-2*x+a*p1+b*p2; return numericQ('12.5','otros','Adjunta con dos estados',`Sea \\(H=-x^2-y^2-u^2+p_1(${a}x+u)+p_2(${b}x+2u)\\). Calcule \\(H_x\\) en \\(x=${x}\\), \\(p_1=${p1}\\), \\(p_2=${p2}\\).`,ans,commonFeedback(`\\(H_x=-2x+${a}p_1+${b}p_2=-2(${x})+${a}(${p1})+${b}(${p2})=${ans}\\).`,'Cada ecuación de estado aporta al Hamiltoniano por su coestado.'),'Suma los aportes de \\(p_1\\) y \\(p_2\\).');}},
  {section:'12.5', cats:['calculo','otros'], calc:true, make(){ const k=rint(1,6), p1=2, p2=4*k-4; return numericQ('12.5','otros','FOC con dos coestados',`Sea \\(H=-2u^2+p_1(x+2u)+p_2(y+u)\\). Con \\(p_1=2\\) y \\(p_2=${p2}\\), calcule el entero \\(u^*\\) que satisface \\(H_u=0\\).`,k,commonFeedback(`\\(H_u=-4u+2p_1+p_2=-4u+4+${p2}\\). Entonces \\(u^*=${k}\\).`,'No olvides el aporte del segundo coestado.'),'Deriva respecto al único control.');}},
  {section:'12.5', cats:['calculo','otros'], calc:true, make(){ const a=rint(1,5), b=rint(1,5), x=rint(1,5), y=rint(1,5); const ans=3*x+2*b*y; return numericQ('12.5','calculo','Traza de Jacobiano',`Sea \\(G(x,y)=(x^2+${a}y,\\;xy+${b}y^2)\\). Calcule la traza de \\(DG(x,y)\\) en \\((x,y)=(${x},${y})\\).`,ans,commonFeedback(`\\(DG=\\begin{pmatrix}2x&${a}\\ y&x+${2*b}y\\end{pmatrix}\\). La traza es \\(3x+${2*b}y=${ans}\\).`,'La traza suma las entradas diagonales, no todos los elementos.'),'Primero escribe el Jacobiano.');}},
  {section:'12.5', cats:['calculo','otros'], calc:true, make(){ const a=rint(1,4), b=rint(1,4), x=rint(1,4), y=rint(1,4); const ans=(2*x)*(a*x+2*y)-b*a*y; return numericQ('12.5','calculo','Determinante de Jacobiano',`Sea \\(G(x,y)=(x^2+${b}y,\\;${a}xy+y^2)\\). Calcule \\(\\det DG(x,y)\\) en \\((x,y)=(${x},${y})\\).`,ans,commonFeedback(`\\(DG=\\begin{pmatrix}2x&${b}\\ ${a}y&${a}x+2y\\end{pmatrix}\\). Entonces \\(\\det DG=${2*x}(${a*x+2*y})-${b}(${a*y})=${ans}\\).`,'No multipliques solo la diagonal: resta el producto cruzado.'),'Construye la matriz primero.');}},
  {section:'12.5', cats:['vf','otros'], calc:false, make(){ return multiQ('12.5','vf','Varias afirmaciones: estados vectoriales',`En un problema con \\(x_t\\in\\mathbb R^n\\), \\(u_t\\in\\mathbb R^r\\), seleccione las correctas.`,[`El Hamiltoniano incluye un producto punto entre coestado y dinámica.`,`Puede existir un coestado por cada componente del estado.`,`El gradiente \\(\\nabla_uH\\) tiene tantas componentes como controles.`,`Siempre se reduce sin pérdida a un solo estado.`],[0,1,2],commonFeedback('I, II y III son correctas. IV es falsa porque varias variables pueden ser esenciales.','No colapses dimensiones sin justificación.'),'Cuenta dimensiones de estados y controles.',false);}},
  {section:'12.5', cats:['calculo','otros'], calc:true, make(){ const x=rint(1,6), y=rint(1,6), u=rint(1,4), v=rint(1,4); const ans=x-u+y+v; return numericQ('12.5','calculo','Dos transiciones',`Considere \\(x_{t+1}=x_t-u_t\\) y \\(y_{t+1}=y_t+v_t\\). Si \\((x_t,y_t)=(${x},${y})\\), \\((u_t,v_t)=(${u},${v})\\), calcule \\(x_{t+1}+y_{t+1}\\).`,ans,commonFeedback(`\\(x_{t+1}=${x}-${u}\\), \\(y_{t+1}=${y}+${v}\\), suma \\(=${ans}\\).`,'Aplica cada transición a su propia variable.'),'Calcula ambos estados futuros.');}},

  {section:'12.1', cats:['formulacion','vf'], calc:true, make(){ const b=2, m=12; return mcQ('12.1','formulacion','Elige la condición correcta',`Para \\(\\Phi(u)=1+x-${b}u^2+${m}(x+u)\\), ¿cuál condición de primer orden es correcta?`,[`\\(-4u+12=0\\)`,`\\(-2u+12=0\\)`,`\\(-4u+12x=0\\)`,`\\(1-4u+12=0\\)`],0,commonFeedback(`La derivada de \\(-${b}u^2\\) es \\(-${2*b}u\\) y la derivada de \\(${m}u\\) es \\(${m}\\).`,'Todas las opciones son plausibles si se olvida algún término; por eso hay que derivar.'),'Deriva término por término.');}},
  {section:'12.4', cats:['otros','vf'], calc:true, make(){ const p=3,u=2; return mcQ('12.4','otros','Elige el valor correcto',`Sea \\(H=-u^2+p(x+4u)\\). Con \\(u=${u}\\), \\(p=${p}\\), ¿cuánto vale \\(H_u\\)?`,[`\\(8\\)`,`\\(12\\)`,`\\(-4\\)`,`\\(4\\)`],0,commonFeedback(`\\(H_u=-2u+4p=-2(${u})+4(${p})=8\\).`,'Las opciones corresponden a olvidar el término del coestado o el signo.'),'Calcula \\(-2u+4p\\).');}},
];

// Banco ampliado v24: más tarjetas de cálculo, planteamiento y elección de ecuaciones
// de programación dinámica, Bellman, Euler discreta y principio del máximo.
FACTORIES.push(
  {section:'12.1', cats:['calculo','formulacion'], calc:true, make(){
    const x0=rint(0,4), u0=rint(1,3), u1=rint(1,3), u2=rint(1,3);
    const x1=2*x0+u0, x2=2*x1+u1, x3=2*x2+u2;
    return numericQ('12.1','calculo','Calcular la trayectoria completa',`Considere la dinámica finita \\(x_{t+1}=2x_t+u_t\\). Si \\(x_0=${x0}\\), \\(u_0=${u0}\\), \\(u_1=${u1}\\), \\(u_2=${u2}\\), calcule el valor entero de \\(x_3\\).`,x3,commonFeedback(`Primero \\(x_1=2(${x0})+${u0}=${x1}\\). Luego \\(x_2=2(${x1})+${u1}=${x2}\\). Finalmente \\(x_3=2(${x2})+${u2}=${x3}\\). La respuesta correcta es \\(x_3=${x3}\\).`,'El error usual es sumar los controles sin aplicar el factor 2 a cada estado anterior.'),'No saltes directamente a \\(x_3\\): calcula \\(x_1\\), después \\(x_2\\), y por último \\(x_3\\).');
  }},
  {section:'12.1', cats:['calculo','formulacion'], calc:true, make(){
    const x0=rint(1,5), u0=rint(1,4), u1=rint(1,4), u2=rint(1,4), u3=rint(1,4);
    const x4=x0+u0+u1+u2+u3;
    return numericQ('12.1','calculo','Encontrar un control faltante',`La dinámica es \\(x_{t+1}=x_t+u_t\\). Se sabe que \\(x_0=${x0}\\), \\(u_0=${u0}\\), \\(u_1=${u1}\\), \\(u_2=${u2}\\) y \\(x_4=${x4}\\). Calcule el control entero \\(u_3\\).`,u3,commonFeedback(`Como \\(x_4=x_0+u_0+u_1+u_2+u_3\\), entonces \\(${x4}=${x0}+${u0}+${u1}+${u2}+u_3\\). Por tanto \\(u_3=${x4}-${x0}-${u0}-${u1}-${u2}=${u3}\\).`,'No confundas \\(x_4\\) con \\(u_4\\). Para llegar a \\(x_4\\) se usan los controles \\(u_0,u_1,u_2,u_3\\).'),'Escribe primero la igualdad que conecta \\(x_4\\) con todos los controles anteriores.');
  }},
  {section:'12.1', cats:['calculo','formulacion'], calc:true, make(){
    const x0=rint(0,4), u0=rint(1,4), u1=rint(1,4), u2=rint(1,4), u3=rint(1,4), u4=rint(1,4);
    const x1=x0+u0, x2=x1+u1, x3=x2+u2, x4=x3+u3, x5=x4+u4;
    const ask=pick([{label:'x_1',ans:x1},{label:'x_2',ans:x2},{label:'x_3',ans:x3},{label:'x_4',ans:x4},{label:'x_5',ans:x5}]);
    return numericQ('12.1','calculo','Estados sucesivos hasta horizonte cinco',`Use \\(x_{t+1}=x_t+u_t\\), con \\(x_0=${x0}\\), \\((u_0,u_1,u_2,u_3,u_4)=(${u0},${u1},${u2},${u3},${u4})\\). Calcule el valor entero de \\(${ask.label}\\).`,ask.ans,commonFeedback(`La trayectoria es \\(x_1=${x1}\\), \\(x_2=${x2}\\), \\(x_3=${x3}\\), \\(x_4=${x4}\\), \\(x_5=${x5}\\). Por eso \\(${ask.label}=${ask.ans}\\).`,'El índice importa: \\(u_4\\) lleva de \\(x_4\\) a \\(x_5\\), no de \\(x_0\\) a \\(x_4\\).'),'Construye una tabla pequeña con las columnas \\(t,x_t,u_t,x_{t+1}\\).');
  }},
  {section:'12.1', cats:['calculo','formulacion'], calc:true, make(){
    const a=rint(1,3), b=rint(1,4), x=rint(1,5), u=rint(0,3), terminal=rint(2,6);
    const ans=a*x-b*u*u+terminal*(x+u);
    return numericQ('12.1','calculo','Evaluar una función de Bellman de un paso',`Sea \\(J_1(y)=${terminal}y\\), \\(f_0(x,u)=${a}x-${b}u^2\\), \\(g(x,u)=x+u\\). Calcule \\[f_0(${x},${u})+J_1(g(${x},${u})).\\]`,ans,commonFeedback(`Primero \\(g(${x},${u})=${x}+${u}=${x+u}\\). Luego \\(f_0(${x},${u})=${a}(${x})-${b}(${u})^2=${a*x-b*u*u}\\). Además \\(J_1(${x+u})=${terminal}(${x+u})=${terminal*(x+u)}\\). La suma es \\(${ans}\\).`,'No evalúes \\(J_1\\) en \\(x\\); debe evaluarse en el estado futuro \\(g(x,u)\\).'),'Orden correcto: estado futuro, pago actual, valor futuro, suma.');
  }},
  {section:'12.1', cats:['formulacion','calculo'], calc:true, make(){
    const A=rint(2,5), B=rint(1,4), D=rint(1,4);
    return mcQ('12.1','formulacion','Elegir la función terminal correcta',`En un problema finito se maximiza \\[\\sum_{t=0}^{T-1} f_t(x_t,u_t)+S(x_T).\\] Si \\(S(x)=${A}x^2+${B}x+${D}\\), ¿cuál es la condición terminal correcta para la recursión de Bellman?`,[`\\(J_T(x)=${A}x^2+${B}x+${D}\\)`,`\\(J_0(x)=${A}x^2+${B}x+${D}\\)`,`\\(J_T(x)=f_T(x,u_T)\\)`,`\\(J_{T-1}(x)=${A}x^2+${B}x+${D}\\)`],0,commonFeedback(`En programación dinámica finita, la recursión empieza en el final: \\(J_T(x)=S(x)=${A}x^2+${B}x+${D}\\). Después se calcula \\(J_{T-1},J_{T-2},\\ldots,J_0\\) hacia atrás.`,'No pongas el pago terminal en \\(J_0\\); \\(J_0\\) es el valor óptimo desde el inicio, después de resolver toda la recursión.'),'Identifica si la función dada es pago terminal \\(S\\) o pago corriente \\(f_t\\).');
  }},
  {section:'12.1', cats:['formulacion','calculo'], calc:true, make(){
    return mcQ('12.1','formulacion','Elegir la ecuación de Bellman finita',`Para \\(x_{t+1}=g_t(x_t,u_t)\\), pago corriente \\(f_t(x_t,u_t)\\) y terminal \\(J_T(x)=S(x)\\), ¿cuál es la ecuación de Bellman correcta para \\(t<T\\)?`,[`\\(J_t(x)=\\max_u\\{f_t(x,u)+J_{t+1}(g_t(x,u))\\}\\)`,`\\(J_t(x)=\\max_u\\{J_t(g_t(x,u))+S(x)\\}\\)`,`\\(J_{t+1}(x)=\\max_u\\{f_t(x,u)+J_t(g_t(x,u))\\}\\)`,`\\(J_t(x)=f_t(x,u)+S(g_t(x,u))\\), sin maximizar`],0,commonFeedback('La forma correcta suma el pago actual y el valor futuro evaluado en el estado siguiente, y luego maximiza sobre el control admisible: \\(J_t(x)=\\max_u\\{f_t(x,u)+J_{t+1}(g_t(x,u))\\}\\).','El error típico es evaluar el valor futuro en el estado actual o invertir \\(J_t\\) y \\(J_{t+1}\\).'),'Busca tres elementos: máximo en \\(u\\), pago actual, y \\(J_{t+1}\\) evaluado en \\(g_t(x,u)\\).');
  }},
  {section:'12.1', cats:['calculo','formulacion'], calc:true, make(){
    const x=rint(1,5), a=rint(2,5), b=rint(1,4); const v0=a*x+b; const v1=x-1+a*(x+1)+b; const ans=Math.max(v0,v1);
    return numericQ('12.1','calculo','Calcular \\(J_0\\) con dos controles',`Suponga \\(J_1(y)=${a}y+${b}\\), \\(f_0(x,u)=x-u^2\\), \\(g(x,u)=x+u\\) y \\(u\\in\\{0,1\\}\\). Para \\(x_0=${x}\\), calcule \\(J_0(${x})\\).`,ans,commonFeedback(`Si \\(u=0\\), el valor es \\(${x}-0+J_1(${x})=${x}+${a}(${x})+${b}=${v0}\\). Si \\(u=1\\), el valor es \\(${x}-1+J_1(${x+1})=${x-1}+${a}(${x+1})+${b}=${v1}\\). Por tanto \\(J_0(${x})=\\max\\{${v0},${v1}\\}=${ans}\\).`,'No basta evaluar un control: Bellman exige comparar todos los controles admisibles.'),'Calcula el valor para \\(u=0\\) y para \\(u=1\\), luego toma el máximo.');
  }},
  {section:'12.1', cats:['calculo','formulacion'], calc:true, make(){
    const x=rint(1,6), u=rint(0,4), a=rint(2,5); const ans=(x-u)*(x-u)+a*(x-u);
    return numericQ('12.1','calculo','Estado futuro en una terminal cuadrática',`La transición es \\(x_{t+1}=x_t-u_t\\) y la función terminal es \\(J_{t+1}(y)=y^2+${a}y\\). Si \\(x_t=${x}\\) y \\(u_t=${u}\\), calcule \\(J_{t+1}(x_{t+1})\\).`,ans,commonFeedback(`Primero \\(x_{t+1}=${x}-${u}=${x-u}\\). Luego \\(J_{t+1}(${x-u})=(${x-u})^2+${a}(${x-u})=${ans}\\).`,'El valor futuro debe evaluarse en el estado futuro, no en el control.'),'Primero calcula el estado futuro y solo después sustituye en \\(J_{t+1}\\).');
  }},
  {section:'12.1', cats:['formulacion','calculo'], calc:true, make(){
    return mcQ('12.1','formulacion','Elegir \\(J_{T-1}\\)',`Si \\(J_T(x)=4x\\), \\(f_{T-1}(x,u)=2x-u^2\\), \\(x_T=x+u\\) y \\(u\\in\\{0,1,2\\}\\), ¿cuál expresión define correctamente \\(J_{T-1}(x)\\)?`,[`\\(J_{T-1}(x)=\\max_{u\\in\\{0,1,2\\}}\\{2x-u^2+4(x+u)\\}\\)`,`\\(J_{T-1}(x)=2x-u^2+4x\\)`,`\\(J_{T-1}(x)=\\max_{u\\in\\{0,1,2\\}}\\{4u+J_T(x)\\}\\)`,`\\(J_{T-1}(x)=J_T(x+u)\\), sin pago corriente`],0,commonFeedback('La expresión debe incluir pago corriente \\(2x-u^2\\), valor futuro \\(J_T(x+u)=4(x+u)\\), y maximización sobre \\(u\\in\\{0,1,2\\}\\).','La expresión incorrecta suele omitir el pago corriente o no maximizar sobre el conjunto admisible.'),'Revisa que aparezcan simultáneamente \\(f_{T-1}\\), \\(J_T\\), la transición y el máximo.');
  }},
  {section:'12.1', cats:['calculo','formulacion'], calc:true, make(){
    const b=rint(1,4), k=rint(1,5), beta=1; const p=2*b*k;
    return numericQ('12.1','calculo','Control óptimo por FOC de Bellman',`En un paso de Bellman se maximiza \\(\\Phi(u)=x-${b}u^2+${p}(x+u)\\). Calcule el control entero \\(u^*\\) que satisface la condición de primer orden.`,k,commonFeedback(`\\(\\Phi'(u)=-${2*b}u+${p}\\). La condición \\(\\Phi'(u)=0\\) da \\(u^*=${p}/${2*b}=${k}\\). Como \\(\\Phi''(u)=-${2*b}<0\\), es un máximo.`,'No olvides comprobar que la función es cóncava en \\(u\\), porque así la FOC identifica el máximo.'),'Deriva respecto a \\(u\\), iguala a cero y verifica el signo de la segunda derivada.');
  }},

  {section:'12.2', cats:['evaluacion','formulacion'], calc:true, make(){
    return mcQ('12.2','evaluacion','Plantear Euler de segundo orden',`Para el funcional \\(\\sum_t F(x_t,x_{t+1})\\), con \\(F(x,y)=xy-y^2\\), ¿cuál es la ecuación de Euler interior correcta?`,[`\\(x_{t+1}+x_{t-1}-2x_t=0\\)`,`\\(x_{t+1}-x_{t-1}=0\\)`,`\\(2x_{t+1}-x_t=0\\)`,`\\(x_t^2-x_{t+1}^2=0\\)`],0,commonFeedback(`\\(F_1(x,y)=y\\) y \\(F_2(x,y)=x-2y\\). La Euler es \\(F_1(x_t,x_{t+1})+F_2(x_{t-1},x_t)=0\\), es decir \\(x_{t+1}+x_{t-1}-2x_t=0\\).`,'El término \\(x_t\\) aparece como primera variable en \\(F(x_t,x_{t+1})\\) y como segunda variable en \\(F(x_{t-1},x_t)\\).'),'Calcula \\(F_1\\) en \\((x_t,x_{t+1})\\) y \\(F_2\\) en \\((x_{t-1},x_t)\\).');
  }},
  {section:'12.2', cats:['calculo','evaluacion'], calc:true, make(){
    const x0=rint(0,3), x1=rint(2,6); const x2=3*x1-2*x0, x3=3*x2-2*x1;
    const ask=pick([{label:'x_2',ans:x2},{label:'x_3',ans:x3}]);
    return numericQ('12.2','calculo','Resolver una Euler lineal',`La ecuación de Euler discreta es \\(x_{t+1}-3x_t+2x_{t-1}=0\\). Si \\(x_0=${x0}\\) y \\(x_1=${x1}\\), calcule \\(${ask.label}\\).`,ask.ans,commonFeedback(`Despejamos \\(x_{t+1}=3x_t-2x_{t-1}\\). Así \\(x_2=3(${x1})-2(${x0})=${x2}\\). Luego \\(x_3=3(${x2})-2(${x1})=${x3}\\). Por tanto \\(${ask.label}=${ask.ans}\\).`,'No apliques una fórmula de primer orden: aquí se necesitan dos valores iniciales.'),'Primero despeja \\(x_{t+1}\\), luego itera con \\(x_0\\) y \\(x_1\\).');
  }},
  {section:'12.2', cats:['evaluacion','formulacion'], calc:true, make(){
    return mcQ('12.2','evaluacion','Elegir solución general de la diferencia',`La ecuación de segundo orden \\(x_{t+1}-3x_t+2x_{t-1}=0\\) tiene ecuación característica \\(r^2-3r+2=0\\). ¿Cuál es su solución general?`,[`\\(x_t=A+B2^t\\)`,`\\(x_t=A3^t+B2^t\\)`,`\\(x_t=A+Bt\\)`,`\\(x_t=A(-1)^t+B2^t\\)`],0,commonFeedback(`La característica factoriza como \\((r-1)(r-2)=0\\). Las raíces son \\(1\\) y \\(2\\), entonces \\(x_t=A1^t+B2^t=A+B2^t\\).`,'No confundas el coeficiente 3 de la ecuación con una raíz característica.'),'Factoriza \\(r^2-3r+2\\) antes de escoger la forma.');
  }},
  {section:'12.2', cats:['evaluacion','formulacion'], calc:true, make(){
    const q=rint(1,4);
    return mcQ('12.2','evaluacion','Euler para costo de ajuste',`Sea \\(F(x,y)=-(y-x)^2-${q}x^2\\). Para un óptimo interior de \\(\\sum_t F(x_t,x_{t+1})\\), ¿cuál ecuación de diferencias de segundo orden se obtiene?`,[`\\(x_{t+1}-(${2+q})x_t+x_{t-1}=0\\)`,`\\(x_{t+1}-${q}x_t-x_{t-1}=0\\)`,`\\(x_{t+1}+(${2+q})x_t+x_{t-1}=0\\)`,`\\(x_{t+1}-2x_t+x_{t-1}+${q}=0\\)`],0,commonFeedback(`\\(F_1(x,y)=2(y-x)-2${q}x\\) y \\(F_2(x,y)=-2(y-x)\\). La Euler da \\(2(x_{t+1}-x_t)-2${q}x_t-2(x_t-x_{t-1})=0\\). Dividiendo por 2: \\(x_{t+1}-(${2+q})x_t+x_{t-1}=0\\).`,'El término \\(-${q}x^2\\) cambia el coeficiente de \\(x_t\\), no aparece como constante.'),'Deriva el costo de ajuste y el término cuadrático en \\(x_t\\).');
  }},
  {section:'12.2', cats:['calculo','evaluacion'], calc:true, make(){
    const q=rint(1,4), xm=rint(1,5), xt=rint(2,7); const ans=(2+q)*xt-xm;
    return numericQ('12.2','calculo','Calcular \\(x_{t+1}\\) desde Euler',`La Euler obtenida es \\(x_{t+1}-(${2+q})x_t+x_{t-1}=0\\). Si \\(x_{t-1}=${xm}\\) y \\(x_t=${xt}\\), calcule \\(x_{t+1}\\).`,ans,commonFeedback(`Despejamos \\(x_{t+1}=(${2+q})x_t-x_{t-1}\\). Entonces \\(x_{t+1}=(${2+q})(${xt})-${xm}=${ans}\\).`,'No cambies el signo de \\(x_{t-1}\\) al despejar.'),'Pasa \\(-(${2+q})x_t+x_{t-1}\\) al otro lado con cuidado de signos.');
  }},
  {section:'12.2', cats:['calculo','evaluacion'], calc:true, make(){
    const a=rint(1,4), xm=rint(1,6), xt=rint(1,6), xp=rint(1,6); const ans=xp+xm-(2+a)*xt;
    return numericQ('12.2','calculo','Residuo de una ecuación de Euler',`Calcule el residuo \\(R_t=x_{t+1}+x_{t-1}-(${2+a})x_t\\) para \\(x_{t-1}=${xm}\\), \\(x_t=${xt}\\), \\(x_{t+1}=${xp}\\).`,ans,commonFeedback(`Sustituyendo: \\(R_t=${xp}+${xm}-(${2+a})(${xt})=${ans}\\). Si el residuo fuera cero, la Euler se cumpliría exactamente en ese punto.`,'El residuo no siempre debe ser cero para datos arbitrarios; cero solo si la trayectoria satisface la Euler.'),'Sustituye los tres estados en el orden correcto.');
  }},
  {section:'12.2', cats:['evaluacion','formulacion'], calc:true, make(){
    return mcQ('12.2','evaluacion','Euler de consumo con descuento',`En un problema de consumo con \\(c_t=x_t-R^{-1}x_{t+1}\\) y utilidad \\(\\sum_{t=0}^{\\infty}\\beta^t\\ln(c_t)\\), ¿cuál forma expresa la condición de Euler usual?`,[`\\(\\frac{1}{c_t}=\\beta R\\frac{1}{c_{t+1}}\\)`,`\\(c_t=\\beta R c_{t+1}\\)`,`\\(\\frac{1}{c_{t+1}}=\\beta R\\frac{1}{c_t}\\)`,`\\(c_t+c_{t+1}=0\\)`],0,commonFeedback('Con utilidad logarítmica, la utilidad marginal es \\(u^{\\prime}(c)=1/c\\). La Euler intertemporal iguala utilidad marginal actual con utilidad marginal futura descontada y multiplicada por el retorno: \\(1/c_t=\\beta R/c_{t+1}\\).','El error típico es poner el consumo en lugar de la utilidad marginal.'),'Recuerda que la condición usa utilidad marginal, no utilidad total.');
  }},
  {section:'12.2', cats:['calculo','evaluacion'], calc:true, make(){
    const x0=rint(1,4), d=rint(1,4); const x1=x0+d, x2=x1+d, x3=x2+d;
    return numericQ('12.2','calculo','Solución lineal de segunda diferencia cero',`Si \\(x_{t+1}-2x_t+x_{t-1}=0\\), \\(x_0=${x0}\\) y \\(x_1=${x1}\\), calcule \\(x_3\\).`,x3,commonFeedback(`La ecuación implica segunda diferencia cero, por tanto la primera diferencia es constante. Como \\(x_1-x_0=${x1}-${x0}=${d}\\), se tiene \\(x_2=${x2}\\) y \\(x_3=${x3}\\).`,'No asumas que la trayectoria es constante; es lineal si la segunda diferencia es cero.'),'Calcula la diferencia común \\(x_1-x_0\\).');
  }},

  {section:'12.3', cats:['conceptual','formulacion'], calc:true, make(){
    return mcQ('12.3','conceptual','Bellman estacionaria de horizonte infinito',`Para un problema autónomo con descuento \\(0<\\beta<1\\), pago \\(f(x,u)\\) y transición \\(x^+=g(x,u)\\), ¿cuál es la ecuación de Bellman de horizonte infinito?`,[`\\(J(x)=\\max_u\\{f(x,u)+\\beta J(g(x,u))\\}\\)`,`\\(J_t(x)=\\max_u\\{f_t(x,u)+J_{t+1}(g_t(x,u))\\}\\)`,`\\(J(x)=f(x,u)+J(x)\\)`,`\\(J_T(x)=S(x)\\)`],0,commonFeedback('En horizonte infinito estacionario no hay índice temporal en \\(J\\). El descuento multiplica el valor futuro: \\(J(x)=\\max_u\\{f(x,u)+\\beta J(g(x,u))\\}\\).','La versión con \\(J_t\\) corresponde al horizonte finito, no al caso estacionario.'),'Busca que no aparezca \\(t\\) en \\(J\\) y que sí aparezca el descuento \\(\\beta\\).');
  }},
  {section:'12.3', cats:['calculo','conceptual'], calc:true, make(){
    const c=rint(2,8), den=pick([2,4,5]); const betaNum=den-1; const ans=c*den;
    return numericQ('12.3','calculo','Valor de una renta perpetua descontada',`Si cada periodo se recibe el pago constante \\(${c}\\) y \\(\\beta=${betaNum}/${den}\\), calcule \\(J=\\frac{${c}}{1-\\beta}\\).`,ans,commonFeedback(`\\(1-\\beta=1-${betaNum}/${den}=1/${den}\\). Entonces \\(J=${c}/(1/${den})=${c}\\cdot ${den}=${ans}\\).`,'No multipliques por \\(\\beta\\); una perpetuidad descontada divide por \\(1-\\beta\\).'),'Primero calcula \\(1-\\beta\\), luego divide el pago por ese número.');
  }},
  {section:'12.3', cats:['calculo','conceptual'], calc:true, make(){
    const b=rint(1,4), k=rint(1,5), betaNum=1, betaDen=2; const p=4*b*k;
    return numericQ('12.3','calculo','Control estacionario con valor lineal',`En horizonte infinito, suponga \\(J(x)=${p}x\\), \\(\\beta=1/2\\), \\(f(x,u)=x-${b}u^2\\) y \\(g(x,u)=x+u\\). Calcule el control entero \\(u^*\\) que maximiza \\(f(x,u)+\\beta J(g(x,u))\\).`,k,commonFeedback(`La parte que depende de \\(u\\) es \\(-${b}u^2+\\frac12 ${p}(x+u)\\). Derivando respecto a \\(u\\): \\(-${2*b}u+${p}/2=0\\). Entonces \\(u^*=${p}/(${4*b})=${k}\\).`,'El descuento \\(\\beta=1/2\\) multiplica el valor futuro y cambia la FOC.'),'No olvides multiplicar \\(J(g(x,u))\\) por \\(\\beta\\).');
  }},
  {section:'12.3', cats:['conceptual','formulacion'], calc:true, make(){
    return mcQ('12.3','conceptual','Método de adivinar y verificar',`Para verificar la conjetura \\(J(x)=Ax^2\\) en una Bellman estacionaria, ¿qué paso es indispensable?`,[`Sustituir \\(J(g(x,u))=A[g(x,u)]^2\\), maximizar en \\(u\\), y comparar coeficientes en \\(x\\).`,`Elegir cualquier \\(A\\) positivo sin sustituirlo.`,`Resolver hacia atrás desde \\(J_T\\).`,`Eliminar el descuento porque el horizonte es infinito.`],0,commonFeedback('Adivinar y verificar exige sustituir la forma candidata en la Bellman, resolver el problema interno de maximización y comparar la identidad resultante con \\(J(x)=Ax^2\\).','No basta proponer la forma; debe verificarse que cumple la ecuación funcional.'),'La palabra clave es “verificar”: sustituir, optimizar y comparar.');
  }},
  {section:'12.3', cats:['calculo','conceptual'], calc:true, make(){
    const beta=0.5, a=rint(1,3), x=rint(1,5), u=rint(1,3); const ans=-(x*x+u*u)+0.5*a*(x+u)*(x+u);
    return numericQ('12.3','calculo','Evaluar RHS de Bellman estacionaria',`Sea \\(J(y)=${a}y^2\\), \\(\\beta=1/2\\), \\(f(x,u)=-(x^2+u^2)\\), \\(g(x,u)=x+u\\). Calcule \\(f(${x},${u})+\\beta J(g(${x},${u}))\\).`,ans,commonFeedback(`\\(g(${x},${u})=${x+u}\\). Luego \\(f(${x},${u})=-(${x}^2+${u}^2)=${-(x*x+u*u)}\\). Además \\(\\beta J(${x+u})=\\frac12\\cdot ${a}(${x+u})^2=${0.5*a*(x+u)*(x+u)}\\). La suma es \\(${ans}\\).`,'El signo negativo afecta tanto \\(x^2\\) como \\(u^2\\).'),'Evalúa por partes: pago actual, estado futuro, valor futuro descontado.');
  }},
  {section:'12.3', cats:['conceptual','vf'], calc:false, make(){
    return multiQ('12.3','conceptual','Afirmaciones sobre horizonte infinito',`Seleccione las afirmaciones correctas sobre una Bellman estacionaria de horizonte infinito.`,[`El valor futuro se descuenta con \\(\\beta\\).`,`La función de valor no necesita subíndice temporal si el problema es autónomo.`,`Siempre existe un terminal \\(J_T\\).`,`Una política estacionaria puede escribirse como \\(u=\\mu(x)\\).`],[0,1,3],commonFeedback('I, II y IV son correctas. En horizonte infinito no hay un tiempo terminal fijo \\(T\\) ni una condición terminal \\(J_T\\).','No mezcles la lógica de horizonte finito con horizonte infinito.'),'Pregúntate si hay último periodo. Si no lo hay, no debe aparecer \\(J_T\\).',false);
  }},

  {section:'12.4', cats:['otros','formulacion'], calc:true, make(){
    return mcQ('12.4','otros','Plantear el Hamiltoniano discreto',`Para maximizar \\(\\sum_t f(x_t,u_t)\\) sujeto a \\(x_{t+1}=g(x_t,u_t)\\), ¿cuál Hamiltoniano discreto de una etapa está correctamente planteado?`,[`\\(H(x,u,p)=f(x,u)+p\\,g(x,u)\\)`,`\\(H(x,u,p)=f(x,u)-g(x,u)\\)`,`\\(H(x,u,p)=p+f(u)\\)`,`\\(H(x,u,p)=J(x)+S(x)\\)`],0,commonFeedback('El Hamiltoniano discreto de una etapa combina pago corriente y dinámica ponderada por el coestado: \\(H=f+p g\\). Si hay varias variables de estado, el producto se vuelve producto punto.','No confundas el Hamiltoniano con la función de valor de Bellman.'),'Busca el pago corriente más el coestado multiplicando la ecuación de estado.');
  }},
  {section:'12.4', cats:['calculo','otros'], calc:true, make(){
    const p=2*rint(1,5); const ans=3*p/2;
    return numericQ('12.4','calculo','Control desde \\(H_u=0\\)',`Sea \\(H=5x-u^2+p(2x+3u)\\). Si \\(p=${p}\\), calcule el control \\(u^*\\) que satisface \\(H_u=0\\).`,ans,commonFeedback(`\\(H_u=-2u+3p\\). Entonces \\(-2u+3(${p})=0\\), de donde \\(u^*=3(${p})/2=${ans}\\).`,'No derives \\(5x\\) ni \\(2px\\) respecto a \\(u\\); esos términos son constantes en el control.'),'Deriva solo respecto al control \\(u\\).');
  }},
  {section:'12.4', cats:['calculo','otros'], calc:true, make(){
    const a=rint(1,5), b=rint(1,4), p=rint(1,6); const ans=a+b*p;
    return numericQ('12.4','calculo','Ecuación adjunta numérica',`Sea \\(H=${a}x-u^2+p(${b}x+u)\\). Calcule \\(p_{t-1}=H_x\\) cuando \\(p_t=${p}\\).`,ans,commonFeedback(`\\(H_x=${a}+${b}p_t\\). Sustituyendo \\(p_t=${p}\\), se obtiene \\(p_{t-1}=${a}+${b}(${p})=${ans}\\).`,'La adjunta usa derivada respecto al estado, no respecto al control.'),'Diferencia claramente \\(H_x\\) y \\(H_u\\).');
  }},
  {section:'12.4', cats:['calculo','otros'], calc:true, make(){
    const a=rint(2,8), xT=rint(1,5); const ans=2*a*xT;
    return numericQ('12.4','calculo','Condición terminal del coestado',`Si el pago terminal es \\(S(x_T)=${a}x_T^2\\), entonces \\(p_T=S'(x_T)\\). Para \\(x_T=${xT}\\), calcule \\(p_T\\).`,ans,commonFeedback(`\\(S'(x)=2${a}x\\). Por tanto \\(p_T=2${a}(${xT})=${ans}\\).`,'No uses \\(S(x_T)\\); el coestado terminal usa la derivada del pago terminal.'),'Deriva primero \\(S\\) y luego evalúa en \\(x_T\\).');
  }},
  {section:'12.4', cats:['otros','vf'], calc:false, make(){
    return multiQ('12.4','otros','Condiciones del principio del máximo',`En un problema discreto interior con Hamiltoniano \\(H_t=f_t+p_tg_t\\), seleccione las condiciones necesarias correctas.`,[`Estado: \\(x_{t+1}=H_p\\).`,`Adjunta: \\(p_{t-1}=H_x\\).`,`Estacionariedad interior: \\(H_u=0\\).`,`Condición terminal: se usa el pago terminal cuando existe.`],[0,1,2,3],commonFeedback('Las cuatro afirmaciones son correctas en el esquema usual: el estado sale de \\(H_p\\), la adjunta de \\(H_x\\), el control interior de \\(H_u=0\\), y la terminal de la derivada del pago final si existe.','No memorices solo \\(H_u=0\\); el principio del máximo incluye estado, adjunta y condiciones de frontera.'),'Verifica las tres piezas: estado, coestado y control.',false);
  }},
  {section:'12.4', cats:['calculo','otros'], calc:true, make(){
    const a=rint(1,4), r=rint(2,4); const pT=0; const pTm1=a+r*pT; const pTm2=a+r*pTm1;
    return numericQ('12.4','calculo','Coestado hacia atrás dos pasos',`La ecuación adjunta es \\(p_{t-1}=${a}+${r}p_t\\) y \\(p_T=0\\). Calcule \\(p_{T-2}\\).`,pTm2,commonFeedback(`Primero \\(p_{T-1}=${a}+${r}(0)=${pTm1}\\). Luego \\(p_{T-2}=${a}+${r}(${pTm1})=${pTm2}\\).`,'La ecuación se itera hacia atrás: primero \\(p_{T-1}\\), luego \\(p_{T-2}\\).'),'Empieza siempre en la condición terminal \\(p_T=0\\).');
  }},
  {section:'12.4', cats:['calculo','otros'], calc:true, make(){
    const upper=rint(3,7), uncon=upper+rint(1,4);
    return numericQ('12.4','calculo','Control con restricción de caja',`La condición interior da el control no restringido \\(\\hat u=${uncon}\\), pero el conjunto admisible es \\(0\\le u\\le ${upper}\\). Si el Hamiltoniano es cóncavo en \\(u\\), calcule \\(u^*\\).`,upper,commonFeedback(`Como \\(\\hat u=${uncon}\\) está por encima del límite superior \\(${upper}\\), el máximo restringido se alcanza en \\(u^*=${upper}\\).`,'No puedes elegir un control fuera del conjunto admisible aunque satisfaga la FOC sin restricciones.'),'Proyecta el óptimo no restringido sobre el intervalo admisible.');
  }},
  {section:'12.4', cats:['otros','formulacion'], calc:true, make(){
    return mcQ('12.4','otros','Condición de frontera para control acotado',`Si \\(u\\in[0,\\bar u]\\), el Hamiltoniano es cóncavo en \\(u\\), y el máximo se alcanza en \\(u=0\\), ¿qué signo debe tener \\(H_u(0)\\) para que moverse hacia la derecha no mejore el valor?`,[`\\(H_u(0)\\le 0\\)`,`\\(H_u(0)=1\\)`,`\\(H_u(0)>0\\)`,`\\(H_u(0)=\\bar u\\)`],0,commonFeedback('En el extremo inferior \\(u=0\\), solo se puede mover hacia valores mayores. Para que eso no aumente el Hamiltoniano, la pendiente inicial debe ser no positiva: \\(H_u(0)\\le0\\).','La FOC \\(H_u=0\\) es para interior; en frontera se usan desigualdades.'),'Piensa en la pendiente cuando solo puedes moverte hacia la derecha.');
  }},

  {section:'12.5', cats:['otros','formulacion'], calc:true, make(){
    return mcQ('12.5','otros','Hamiltoniano vectorial correcto',`Si \\(x_{t+1}=g(x_t,y_t,u_t)\\) y \\(y_{t+1}=h(x_t,y_t,u_t)\\), con coestados \\(p_t,q_t\\), ¿cuál Hamiltoniano está correctamente planteado?`,[`\\(H=f(x,y,u)+p\\,g(x,y,u)+q\\,h(x,y,u)\\)`,`\\(H=f(x,y,u)+p+q\\)`,`\\(H=g(x,y,u)+h(x,y,u)\\)`,`\\(H=J(x,y)+S(x,y)\\)`],0,commonFeedback('Con dos estados hay dos ecuaciones de estado y dos coestados. El Hamiltoniano suma el pago corriente más cada dinámica multiplicada por su coestado: \\(H=f+p g+q h\\).','No basta un solo coestado si hay dos variables de estado independientes.'),'Cuenta cuántas ecuaciones de estado hay; cada una necesita su coestado.');
  }},
  {section:'12.5', cats:['calculo','otros'], calc:true, make(){
    const x=rint(1,5), y=rint(1,5), p=rint(1,4), q=rint(1,4), a=rint(1,3), b=rint(1,3); const ans=-2*x+a*p+b*q;
    return numericQ('12.5','calculo','Adjunta vectorial para \\(x\\)',`Sea \\(H=-(x^2+y^2+u^2)+p(${a}x+u)+q(${b}x+y+u)\\). Calcule \\(H_x\\) en \\(x=${x}\\), \\(p=${p}\\), \\(q=${q}\\).`,ans,commonFeedback(`\\(H_x=-2x+${a}p+${b}q\\). Sustituyendo: \\(H_x=-2(${x})+${a}(${p})+${b}(${q})=${ans}\\).`,'Ambos coestados pueden aportar a \\(H_x\\) si ambas dinámicas dependen de \\(x\\).'),'Deriva cada ecuación de estado respecto a \\(x\\).');
  }},
  {section:'12.5', cats:['calculo','otros'], calc:true, make(){
    const u=rint(1,5), p=rint(1,4), q=rint(1,4), a=rint(1,3), b=rint(1,3); const ans=-2*u+a*p+b*q;
    return numericQ('12.5','calculo','FOC vectorial con un control',`Sea \\(H=-u^2+p(x+${a}u)+q(y+${b}u)\\). Calcule \\(H_u\\) en \\(u=${u}\\), \\(p=${p}\\), \\(q=${q}\\).`,ans,commonFeedback(`\\(H_u=-2u+${a}p+${b}q\\). Sustituyendo: \\(-2(${u})+${a}(${p})+${b}(${q})=${ans}\\).`,'El control afecta las dos dinámicas; por eso aparecen los dos coestados.'),'Suma el aporte marginal de cada ecuación de estado.');
  }},
  {section:'12.5', cats:['calculo','otros'], calc:true, make(){
    const x=rint(1,4), y=rint(1,4), u=rint(1,3), v=rint(1,3); const x1=2*x+u, y1=x+y-v; const ans=x1+y1;
    return numericQ('12.5','calculo','Dos estados y dos controles',`Considere \\(x_{t+1}=2x_t+u_t\\) y \\(y_{t+1}=x_t+y_t-v_t\\). Si \\((x_t,y_t)=(${x},${y})\\) y \\((u_t,v_t)=(${u},${v})\\), calcule \\(x_{t+1}+y_{t+1}\\).`,ans,commonFeedback(`\\(x_{t+1}=2(${x})+${u}=${x1}\\). \\(y_{t+1}=${x}+${y}-${v}=${y1}\\). Por tanto \\(x_{t+1}+y_{t+1}=${x1}+${y1}=${ans}\\).`,'No uses el control \\(u_t\\) en la ecuación de \\(y\\) ni \\(v_t\\) en la ecuación de \\(x\\).'),'Calcula cada estado futuro por separado antes de sumar.');
  }},
  {section:'12.5', cats:['otros','formulacion'], calc:true, make(){
    return mcQ('12.5','otros','Bellman con estado vectorial',`Si el estado es \\(z=(x,y)\\), el control es \\(u\\), la transición es \\(z^+=G(z,u)\\) y el descuento es \\(\\beta\\), ¿cuál es la Bellman estacionaria correcta?`,[`\\(J(z)=\\max_u\\{f(z,u)+\\beta J(G(z,u))\\}\\)`,`\\(J(x)=\\max_y\\{f(x,y)+G(x,y)\\}\\)`,`\\(J_t(z)=S(z)\\) para todo \\(t\\)`,`\\(J(z)=f(z,u)+\\beta G(z,u)\\)`],0,commonFeedback('El cambio a estado vectorial no cambia la lógica de Bellman: se maximiza pago actual más valor futuro descontado evaluado en el vector de estado siguiente \\(G(z,u)\\).','No reemplaces \\(J(G(z,u))\\) por la transición misma; la transición produce el nuevo estado, no el valor.'),'Trata \\(z\\) como un solo estado compuesto.');
  }},
  {section:'12.5', cats:['vf','otros'], calc:false, make(){
    return tfQ('12.5','vf','V/F sobre dimensión de coestados',`Marque V o F para problemas con dos estados \\((x_t,y_t)\\).`,[{text:`Puede haber dos coestados, uno asociado a cada ecuación de estado.`,value:true},{text:`La condición \\(H_u=0\\) puede contener ambos coestados si el control afecta ambas dinámicas.`,value:true},{text:`El Hamiltoniano vectorial nunca usa producto punto.`,value:false}],commonFeedback('Las dos primeras son verdaderas. La tercera es falsa: en notación vectorial el Hamiltoniano usa precisamente el producto punto entre coestado y dinámica.','No confundas notación escalar expandida con notación vectorial compacta.'),'Relaciona cada estado con su coestado y cada control con su efecto marginal.',false);
  }}
);

function factoryMatchesCategory(factory, category){
  if(category==='calculo') return factory.calc;
  if(category==='vf') return factory.cats.includes('vf') || !factory.calc;
  if(category==='formulacion') return factory.cats.includes('formulacion') || ['12.1','12.3'].includes(factory.section);
  if(category==='evaluacion') return factory.cats.includes('evaluacion') || factory.section==='12.2';
  if(category==='conceptual') return factory.cats.includes('conceptual') || factory.section==='12.3';
  if(category==='otros') return factory.cats.includes('otros') || ['12.4','12.5'].includes(factory.section);
  return true;
}
function generateQuestion(category){
  let pool=FACTORIES.filter(f=>state.selectedSections.includes(f.section)&&factoryMatchesCategory(f,category));
  if(!pool.length) pool=FACTORIES.filter(f=>state.selectedSections.includes(f.section));
  if(!pool.length) pool=FACTORIES;
  const calcPool=pool.filter(f=>f.calc), theoryPool=pool.filter(f=>!f.calc);
  let chosenPool=pool;
  if(category!=='vf' && calcPool.length) chosenPool=Math.random()<0.85?calcPool:pool;
  if(category==='vf' && theoryPool.length && Math.random()<0.55) chosenPool=theoryPool;
  let q=null;
  for(let attempt=0; attempt<12; attempt++){
    const candidate=pick(chosenPool).make();
    const recent=state.lastQuestionTypes.slice(-2);
    if(!recent.includes(candidate.type) || attempt>7 || chosenPool.length<2){ q=candidate; break; }
  }
  if(!q) q=pick(chosenPool).make();
  q.displayCategory=category;
  state.lastQuestionTypes.push(q.type);
  if(state.lastQuestionTypes.length>6) state.lastQuestionTypes.shift();
  return q;
}
function generateFinalQuestion(){
  const q=generateQuestion(pick(CATEGORIES).key);
  q.title='Reto final del centro';
  q.prompt=`<b>Pregunta final.</b> Para ganar, resuelve esta tarjeta del banco de las secciones seleccionadas.<br><br>${q.prompt}`;
  return q;
}
function showQuestion(q){
  state.activeQuestion=q; state.questionStartedMs=Date.now(); state.timeLeft=state.qTime; state.paused=false;
  $('qSection').textContent=q.isCheese?`🧀 PREGUNTA QUESO · ${q.section} · ${SECTIONS[q.section]}`:`Tarjeta práctica · ${q.section} · ${SECTIONS[q.section]}`;
  $('qTitle').textContent=q.isCheese?`QUESO · ${q.title}`:q.title;
  $('qPrompt').innerHTML=(q.isCheese?`<div class="cheese-alert">🧀 Esta es una <b>pregunta QUESO</b>: si respondes bien ganas el queso de esta categoría.</div>`:``)+q.prompt;
  $('qPrompt').classList.add('book-latex');
  $('feedback').className='feedback hidden';
  $('feedback').innerHTML='';
  $('hintBox').classList.add('hidden');
  $('hintBox').innerHTML=buildDetailedHint(q);
  $('submitBtn').classList.remove('hidden'); $('continueBtn').classList.add('hidden'); $('hintBtn').disabled=state.level==='examen'; $('pauseBtn').textContent='⏸ Parar tiempo para hacer cuentas';
  renderQuestionBody(q); $('questionModal').classList.remove('hidden'); startQuestionTimer(); typeset($('questionModal'));
}
function renderQuestionBody(q){
  const box=$('qBody'); box.innerHTML=''; box.classList.add('book-latex');
  if(q.type==='calculo'){
    box.innerHTML=`<div class="numeric-box"><input id="numericAnswer" type="number" step="1" inputmode="numeric" placeholder="Ej.: 3"><span class="tiny">Solo se acepta un número entero simplificado. No escribas fórmulas.</span></div>`;
    setTimeout(()=>$('numericAnswer')?.focus(),60);
  }else if(q.type==='mc'){
    box.innerHTML=q.options.map((o,i)=>`<label class="option"><input type="radio" name="mc" value="${i}"><span class="latex">${String.fromCharCode(65+i)}. ${o}</span></label>`).join('');
  }else if(q.type==='multi'){
    box.innerHTML=q.options.map((o,i)=>`<label class="option"><input type="checkbox" name="multi" value="${i}"><span class="latex">${['I','II','III','IV','V'][i]||i+1}. ${o}</span></label>`).join('');
  }else if(q.type==='tf'){
    box.innerHTML=`<div class="tf-grid">${q.statements.map((s,i)=>`<div class="tf-row" data-i="${i}"><div class="latex">${i+1}. ${s.text}</div><button class="btn subtle small" data-v="true">V</button><button class="btn subtle small" data-v="false">F</button></div>`).join('')}</div>`;
    box.querySelectorAll('.tf-row button').forEach(btn=>btn.addEventListener('click',()=>{const row=btn.closest('.tf-row'); row.querySelectorAll('button').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); row.dataset.answer=btn.dataset.v;}));
  }
}
function startQuestionTimer(){
  clearInterval(state.timerId); updateTimerUI();
  if(!state.qTime) return;
  state.timerId=setInterval(()=>{ if(state.paused) return; state.timeLeft--; updateTimerUI(); if(state.timeLeft<=0){ clearInterval(state.timerId); gradeQuestion(false,'Tiempo agotado.'); } },1000);
}
function updateTimerUI(){
  $('timer').textContent=state.qTime?`${state.timeLeft}s`:'Sin límite';
  const pct=state.qTime?Math.max(0,Math.min(100,100*state.timeLeft/state.qTime)):100; $('timerFill').style.width=pct+'%';
}
function togglePause(){ if(!state.qTime) return; state.paused=!state.paused; $('pauseBtn').textContent=state.paused?'▶ Reanudar tiempo':'⏸ Parar tiempo para hacer cuentas'; }
function selectedAnswers(q){
  if(q.type==='calculo'){
    const raw=$('numericAnswer')?.value??''; if(raw.trim()==='') return {valid:false,message:'Debes escribir un número entero.'};
    if(!/^-?\d+$/.test(raw.trim())) return {valid:false,message:'La respuesta debe ser un número entero, no una fórmula ni decimal.'};
    return {valid:true,value:Number(raw),text:String(Number(raw))};
  }
  if(q.type==='mc'){
    const sel=document.querySelector('input[name="mc"]:checked'); if(!sel) return {valid:false,message:'Selecciona una opción.'};
    return {valid:true,value:Number(sel.value),text:q.options[Number(sel.value)]};
  }
  if(q.type==='multi'){
    const vals=Array.from(document.querySelectorAll('input[name="multi"]:checked')).map(x=>Number(x.value)); if(!vals.length) return {valid:false,message:'Selecciona al menos una afirmación.'};
    return {valid:true,value:vals,text:vals.map(i=>['I','II','III','IV','V'][i]||i+1).join(', ')};
  }
  if(q.type==='tf'){
    const rows=Array.from(document.querySelectorAll('.tf-row')); if(rows.some(r=>!('answer' in r.dataset))) return {valid:false,message:'Marca V o F en todas las afirmaciones.'};
    const vals=rows.map(r=>r.dataset.answer==='true'); return {valid:true,value:vals,text:vals.map(v=>v?'V':'F').join(', ')};
  }
  return {valid:false,message:'Tipo de pregunta no reconocido.'};
}
function isCorrect(q,ans){
  if(q.type==='calculo') return ans.value===q.answer;
  if(q.type==='mc') return ans.value===q.correct;
  if(q.type==='multi') return [...ans.value].sort((a,b)=>a-b).join(',')===[...q.correctSet].sort((a,b)=>a-b).join(',');
  if(q.type==='tf') return ans.value.every((v,i)=>v===q.statements[i].value);
  return false;
}
function correctAnswerText(q){
  if(q.type==='calculo') return String(q.answer);
  if(q.type==='mc') return q.options[q.correct];
  if(q.type==='multi') return q.correctSet.map(i=>['I','II','III','IV','V'][i]||i+1).join(', ');
  if(q.type==='tf') return q.statements.map(s=>s.value?'V':'F').join(', ');
  return '';
}
function escapeHtml(s){
  return String(s??'').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}
function answerSummary(q, ans, forcedMsg=''){
  if(ans?.text) return ans.text;
  if(forcedMsg) return `Sin respuesta registrada (${forcedMsg})`;
  return 'Sin respuesta registrada';
}
function feedbackTypeNote(q){
  const focus = q.hint ? q.hint : 'releer los datos de esta tarjeta y el procedimiento mostrado arriba';
  if(q.type==='calculo') return `Para corregir esta pregunta, vuelve a hacer el cálculo de la tarjeta: ${focus} Después compara cada sustitución con el procedimiento mostrado.`;
  if(q.type==='mc') return `Para corregir esta pregunta, resuelve primero la expresión de la tarjeta y luego compara con las opciones: ${focus} La opción correcta es la que coincide exactamente con ese resultado.`;
  if(q.type==='multi') return `Para corregir esta pregunta, revisa una por una las afirmaciones que aparecen en esta tarjeta: ${focus} Marca solo las que el análisis anterior declaró verdaderas.`;
  if(q.type==='tf') return `Para corregir esta pregunta, revisa cada enunciado V/F de esta tarjeta con el cálculo o definición anterior: ${focus}`;
  return `Para corregir esta pregunta, usa el procedimiento específico mostrado para esta tarjeta: ${focus}`;
}
function roman(i){ return ['I','II','III','IV','V','VI'][i] || String(i+1); }
function stripHtmlForHint(html){
  return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}
function questionItems(q){
  if(q.type==='mc') return `<ol class="statement-list">${q.options.map((o,i)=>`<li><b>${String.fromCharCode(65+i)}.</b> <span class="latex">${o}</span></li>`).join('')}</ol>`;
  if(q.type==='multi') return `<ol class="statement-list">${q.options.map((o,i)=>`<li><b>${roman(i)}.</b> <span class="latex">${o}</span></li>`).join('')}</ol>`;
  if(q.type==='tf') return `<ol class="statement-list">${q.statements.map((s,i)=>`<li><b>${i+1}.</b> <span class="latex">${s.text}</span></li>`).join('')}</ol>`;
  return '';
}
function buildQuestionTarget(q){
  if(q.type==='calculo') return 'un valor numérico exacto para la cantidad solicitada en esta tarjeta';
  if(q.type==='mc') return 'la única opción que coincide con el cálculo o condición de esta tarjeta';
  if(q.type==='multi') return 'el conjunto exacto de afirmaciones verdaderas de esta tarjeta';
  if(q.type==='tf') return 'el patrón V/F correcto, en el mismo orden de los enunciados de esta tarjeta';
  return 'la respuesta solicitada por esta tarjeta';
}
function buildPerQuestionHintSteps(q){
  const h=q.hint||'Identifica la relación matemática escrita en esta tarjeta.';
  if(q.type==='calculo'){
    return `<ol class="feedback-steps">
      <li><b>Meta de esta pregunta:</b> encontrar ${buildQuestionTarget(q)}.</li>
      <li><b>Primer paso:</b> ${h}</li>
      <li><b>Segundo paso:</b> sustituye únicamente los valores numéricos que aparecen en esta tarjeta y conserva signos, paréntesis, subíndices y coeficientes.</li>
      <li><b>Tercer paso:</b> simplifica la expresión hasta obtener un solo número.</li>
      <li><b>Antes de enviar:</b> verifica que el número responde exactamente a lo pedido en el enunciado <span class="latex">${q.title}</span>.</li>
    </ol>`;
  }
  if(q.type==='mc'){
    return `<ol class="feedback-steps">
      <li><b>Meta de esta pregunta:</b> escoger ${buildQuestionTarget(q)}.</li>
      <li><b>Primer paso:</b> ${h}</li>
      <li><b>Segundo paso:</b> resuelve la condición o derivada de esta tarjeta sin mirar todavía las opciones.</li>
      <li><b>Tercer paso:</b> compara tu resultado con estas opciones de la misma pregunta:${questionItems(q)}</li>
      <li><b>Antes de enviar:</b> marca la letra que coincide exactamente; si cambia un signo, un coeficiente o una variable, no es la respuesta de esta tarjeta.</li>
    </ol>`;
  }
  if(q.type==='multi'){
    return `<ol class="feedback-steps">
      <li><b>Meta de esta pregunta:</b> seleccionar ${buildQuestionTarget(q)}.</li>
      <li><b>Primer paso:</b> ${h}</li>
      <li><b>Segundo paso:</b> evalúa solamente las afirmaciones que aparecen en esta tarjeta:${questionItems(q)}</li>
      <li><b>Tercer paso:</b> decide cada afirmación por separado usando la definición, ecuación o propiedad mencionada en el enunciado.</li>
      <li><b>Antes de enviar:</b> deja sin marcar toda afirmación que no quede justificada por el análisis de esta pregunta.</li>
    </ol>`;
  }
  if(q.type==='tf'){
    return `<ol class="feedback-steps">
      <li><b>Meta de esta pregunta:</b> construir ${buildQuestionTarget(q)}.</li>
      <li><b>Primer paso:</b> ${h}</li>
      <li><b>Segundo paso:</b> analiza estos enunciados de esta misma tarjeta:${questionItems(q)}</li>
      <li><b>Tercer paso:</b> para cada enunciado, escribe mentalmente la razón matemática que lo hace verdadero o falso.</li>
      <li><b>Antes de enviar:</b> revisa que el orden de tus marcas V/F sea exactamente el orden de los enunciados.</li>
    </ol>`;
  }
  return `<ol class="feedback-steps"><li>${h}</li></ol>`;
}
function buildDetailedHint(q){
  const promptClean = stripHtmlForHint(q.prompt).slice(0,420);
  return `<div class="hint-detail">
    <div class="hint-title">🧭 Pista exclusiva de esta pregunta</div>
    <div class="hint-focus"><b>Tarjeta:</b> <span class="latex">${q.title}</span></div>
    <div class="hint-focus"><b>Qué debes responder aquí:</b> ${buildQuestionTarget(q)}.</div>
    <div class="hint-focus"><b>Dato/enunciado de esta pregunta:</b> <span class="latex">${promptClean}</span></div>
    <div class="hint-focus"><b>Pista puntual:</b> ${q.hint || 'trabaja directamente con los datos visibles en esta tarjeta.'}</div>
    ${buildPerQuestionHintSteps(q)}
    <div class="hint-check"><b>Chequeo de esta pregunta:</b> la respuesta debe salir de los datos de esta tarjeta y del procedimiento anterior; no uses reglas de otra pregunta.</div>
  </div>`;
}
function buildAnswerAssertion(q){
  const expected=correctAnswerText(q);
  if(q.type==='calculo') return `Para esta pregunta, la verdadera respuesta correcta es <span class="latex">${expected}</span>. Es el valor exacto de la cantidad pedida en la tarjeta <b>${q.title}</b>.`;
  if(q.type==='mc') return `Para esta pregunta, la verdadera respuesta correcta es <span class="latex">${expected}</span>. Esa opción coincide exactamente con el cálculo o condición del enunciado.`;
  if(q.type==='multi') return `Para esta pregunta, las afirmaciones que sí son verdaderas son <span class="latex">${expected}</span>. Esas, y solo esas, deben marcarse.`;
  if(q.type==='tf') return `Para esta pregunta, el patrón verdadero correcto es <span class="latex">${expected}</span>. Cada letra corresponde al valor de verdad de los enunciados en el orden mostrado.`;
  return `La respuesta correcta de esta pregunta es <span class="latex">${expected}</span>.`;
}
function buildAnswerComparison(q, ans=null, forcedMsg=''){
  const student=answerSummary(q, ans, forcedMsg);
  if(q.type==='calculo'){
    const diff = ans && typeof ans.value==='number' ? ans.value - q.answer : null;
    const diffText = diff===null ? 'No hay valor numérico registrado para comparar.' : (diff===0 ? 'Tu valor coincide exactamente con esta tarjeta.' : `Tu valor se separa de esta pregunta en ${diff}. Revisa el paso exacto de sustitución o simplificación.`);
    return `<div><b>Comparación en esta pregunta:</b> tu respuesta fue <span class="latex">${escapeHtml(student)}</span> y la esperada para esta tarjeta es <span class="latex">${q.answer}</span>. ${diffText}</div>`;
  }
  if(q.type==='mc'){
    const chosen = ans && Number.isInteger(ans.value) ? `${String.fromCharCode(65+ans.value)}. ${q.options[ans.value]}` : student;
    const correct = `${String.fromCharCode(65+q.correct)}. ${q.options[q.correct]}`;
    return `<div><b>Comparación en esta pregunta:</b> elegiste <span class="latex">${chosen}</span>. La opción correcta de esta tarjeta es <span class="latex">${correct}</span>.</div>`;
  }
  if(q.type==='multi'){
    const selected = ans && Array.isArray(ans.value) ? ans.value : [];
    const rows=q.options.map((o,i)=>{
      const should=q.correctSet.includes(i), marked=selected.includes(i);
      const status=should===marked?'✅':'❌';
      return `<li>${status} <b>${roman(i)}.</b> <span class="latex">${o}</span><br><span class="small-explain">En esta pregunta: ${marked?'la marcaste':'no la marcaste'} · Valor correcto: ${should?'verdadera; sí debía marcarse':'falsa; no debía marcarse'}.</span></li>`;
    }).join('');
    return `<div><b>Comparación afirmación por afirmación de esta tarjeta:</b><ol class="statement-list">${rows}</ol></div>`;
  }
  if(q.type==='tf'){
    const selected = ans && Array.isArray(ans.value) ? ans.value : [];
    const rows=q.statements.map((st,i)=>{
      const got = typeof selected[i]==='boolean' ? (selected[i]?'V':'F') : 'sin marca';
      const exp = st.value?'V':'F';
      const status=got===exp?'✅':'❌';
      return `<li>${status} <b>${i+1}.</b> <span class="latex">${st.text}</span><br><span class="small-explain">En esta pregunta: respondiste ${got} · Valor correcto: ${exp}.</span></li>`;
    }).join('');
    return `<div><b>Comparación enunciado por enunciado de esta tarjeta:</b><ol class="statement-list">${rows}</ol></div>`;
  }
  return `<div><b>Comparación:</b> tu respuesta fue ${student}.</div>`;
}
function buildTruthAffirmations(q){
  if(q.type==='multi'){
    return `<div><b>Verificación completa de esta pregunta:</b><ol class="statement-list">${q.options.map((o,i)=>`<li><b>${roman(i)}.</b> <span class="latex">${o}</span><br><span class="small-explain">En esta tarjeta es ${q.correctSet.includes(i)?'VERDADERA; por eso se debe marcar.':'FALSA; por eso no se debe marcar.'}</span></li>`).join('')}</ol></div>`;
  }
  if(q.type==='tf'){
    return `<div><b>Verificación completa de esta pregunta:</b><ol class="statement-list">${q.statements.map((s,i)=>`<li><b>${i+1}.</b> <span class="latex">${s.text}</span><br><span class="small-explain">En esta tarjeta es ${s.value?'VERDADERA (V).':'FALSA (F).'}</span></li>`).join('')}</ol></div>`;
  }
  if(q.type==='mc'){
    return `<div><b>Opciones de esta pregunta:</b><ol class="statement-list">${q.options.map((o,i)=>`<li><b>${String.fromCharCode(65+i)}.</b> <span class="latex">${o}</span><br><span class="small-explain">${i===q.correct?'Esta es la opción correcta de la tarjeta.':'Esta opción no coincide con el resultado específico de la tarjeta.'}</span></li>`).join('')}</ol></div>`;
  }
  return `<div><b>Afirmación final de esta pregunta:</b> el valor solicitado en <b>${q.title}</b> es exactamente <span class="latex">${q.answer}</span>.</div>`;
}
function buildDetailedFeedback(q, correct, ans=null, forcedMsg=''){
  const student=answerSummary(q, ans, forcedMsg);
  const expected=correctAnswerText(q);
  const diagnosis=correct
    ? `Tu respuesta coincide con la respuesta esperada para la tarjeta <b>${q.title}</b>. Revisa los pasos para confirmar por qué era correcta.`
    : `Tu respuesta no coincide con la respuesta esperada para la tarjeta <b>${q.title}</b>. El error debe buscarse dentro de esta misma pregunta: en los datos, el signo, el coeficiente, la variable evaluada, el orden temporal o la afirmación marcada.`;
  const concrete=correct
    ? `La razón concreta es que tu respuesta reproduce el resultado del procedimiento específico de esta tarjeta.`
    : `La razón concreta de la respuesta correcta está en el procedimiento específico mostrado arriba para esta tarjeta. Compara tu respuesta con cada paso hasta encontrar dónde se separa.`;
  const shownStudent = q.type==='calculo' ? escapeHtml(student) : student;
  return `<div class="feedback-detail">
    <div class="feedback-main">${correct?'✅ <b>Correcto.</b>':'❌ <b>Incorrecto.</b>'}</div>
    <div class="feedback-section"><b>Pregunta respondida:</b> <span class="latex">${q.title}</span></div>
    <div class="feedback-section"><b>Tu respuesta:</b> <span class="latex">${shownStudent}</span></div>
    <div class="feedback-section"><b>Respuesta correcta de esta pregunta:</b> <span class="latex">${expected}</span></div>
    <div class="feedback-section"><b>1. Afirmación de la verdadera respuesta correcta:</b><br>${buildAnswerAssertion(q)}</div>
    <div class="feedback-section"><b>2. Diagnóstico sobre esta pregunta:</b><br>${diagnosis}</div>
    <div class="feedback-section"><b>3. Comparación con tu respuesta:</b><br>${buildAnswerComparison(q, ans, forcedMsg)}</div>
    <div class="feedback-section"><b>4. Pasos necesarios de esta pregunta:</b><div class="feedback-process">${q.feedback||'Revisa los datos de esta tarjeta, sustituye cuidadosamente y simplifica hasta obtener la respuesta final.'}</div></div>
    <div class="feedback-section"><b>5. Razón concreta de la respuesta correcta:</b><br>${concrete}</div>
    <div class="feedback-section"><b>6. Opciones o afirmaciones de esta pregunta:</b><br>${buildTruthAffirmations(q)}</div>
    <div class="feedback-section"><b>7. Cómo resolver tu duda en esta pregunta:</b><br>${feedbackTypeNote(q)}</div>
  </div>`;
}

function elapsedCurrentQuestionSeconds(){
  return Math.max(0, Math.round((Date.now()-(state.questionStartedMs||Date.now()))/1000));
}
function shouldAnnulFastCalculation(q){
  return Boolean(q && q.type==='calculo' && elapsedCurrentQuestionSeconds()<15 && gameIsRunning());
}
function registerFastCalculationAnswer(q, ans){
  const elapsed=elapsedCurrentQuestionSeconds();
  const sec=ensureSecurityState();
  sec.fastCalc=(sec.fastCalc||0)+1;
  sec.total=(sec.total||0)+1;
  const response = ans?.text ? ` Respuesta enviada: ${ans.text}.` : '';
  annulQuiz(`respuesta numérica enviada en menos de 15 segundos (${elapsed}s).${response}`);
}
function submitQuestion(){
  const q=state.activeQuestion; if(!q)return;
  const ans=selectedAnswers(q);
  if(!ans.valid){ $('feedback').className='feedback bad'; $('feedback').innerHTML=ans.message; $('feedback').classList.remove('hidden'); return; }
  if(shouldAnnulFastCalculation(q)){
    registerFastCalculationAnswer(q, ans);
    return;
  }
  gradeQuestion(isCorrect(q,ans),'',ans);
}
function gradeQuestion(correct,forcedMsg='',ans=null){
  clearInterval(state.timerId); const q=state.activeQuestion, p=state.players[state.current]; if(!q||!p)return;
  p.total++; if(correct) p.correct++; else p.wrong++;
  if(correct && !state.finalChallenge && state.pendingIsCheese && state.pendingCategory && state.pendingCategory!=='final') p.wedges[state.pendingCategory]=true;
  const elapsed=Math.max(0,Math.round((Date.now()-(state.questionStartedMs||Date.now()))/1000));
  const catLabel=state.finalChallenge?'Pregunta central':(state.pendingIsCheese?'Queso · ':'Práctica · ')+categoryByKey(state.pendingCategory).label;
  const detailedFeedback=buildDetailedFeedback(q, correct, ans, forcedMsg);
  const row={time:new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}),duration:elapsed,player:p.name,section:q.section,category:catLabel,title:q.title,type:q.type,correct,answer:ans?.text||forcedMsg||'Sin respuesta',expected:correctAnswerText(q),node:state.pendingNode,feedback:detailedFeedback};
  p.history.push(row); state.history.push(row);
  const fb=$('feedback'); fb.className=`feedback ${correct?'ok':'bad'}`;
  let extra='';
  if(correct && state.finalChallenge) extra='<div class="feedback-extra"><b>Reto final superado.</b> La partida termina.</div>';
  else if(correct && state.pendingIsCheese && allWedges(p)) extra='<div class="feedback-extra"><b>Ya tienes los 6 quesos.</b> Ahora debes volver al centro para la pregunta final.</div>';
  else if(correct && state.pendingIsCheese) extra='<div class="feedback-extra"><b>Ganaste el queso de esta categoría.</b></div>';
  else if(correct && !state.pendingIsCheese) extra='<div class="feedback-extra"><b>Tarjeta de práctica superada.</b> Esta casilla no entrega queso.</div>';
  fb.innerHTML=`${detailedFeedback}${extra}`;
  fb.classList.remove('hidden'); $('submitBtn').classList.add('hidden'); $('continueBtn').classList.remove('hidden'); $('hintBtn').disabled=true; $('pauseBtn').disabled=true;
  renderPlayers(); renderTurn(); typeset(fb); if(correct && state.finalChallenge) finishWithWinner(p);
}
function continueAfterQuestion(){
  $('questionModal').classList.add('hidden'); $('pauseBtn').disabled=false; const p=state.players[state.current]; const last=p.history[p.history.length-1]; if(state.winner)return;
  if(last?.correct){ state.correctStreak++; if(state.correctStreak>=3){ $('gameLog').textContent=`${p.name} respondió bien 3 veces seguidas. Cambia el turno.`; nextPlayer(); } else { $('gameLog').textContent=`${p.name} respondió bien y puede volver a lanzar (${state.correctStreak}/3).`; samePlayerAgain(); } }
  else { $('gameLog').textContent=`${p.name} no acertó. Cambia el turno.`; nextPlayer(); }
}
function showHint(){
  if(state.level==='examen') return;
  $('hintBox').classList.toggle('hidden');
  typeset($('hintBox'));
}
function reportFormula(text){
  return String(text||'')
    .replace(/beta/g,'\\beta')
    .replace(/max_u/g,'\\max_{u}')
    .replace(/grad_u/g,'\\nabla_u')
    .replace(/grad_x/g,'\\nabla_x');
}
function cleanTextForReport(value){
  return String(value??'')
    .replace(/<script[\s\S]*?<\/script>/gi,'')
    .replace(/<style[\s\S]*?<\/style>/gi,'')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ')
    .replace(/&amp;/g,'&')
    .replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>')
    .replace(/\s+/g,' ')
    .trim();
}
function reportMath(value){
  const txt=String(value??'').trim();
  if(!txt) return '—';
  if(/[\\][(\[]|<\w+/i.test(txt)) return txt;
  return escapeHtml(txt);
}
function reportBar(label, ok, total){
  const pct=percent(ok,total);
  return `<div class="report-bar-row"><div class="report-bar-label"><b>${escapeHtml(label)}</b><span>${ok}/${total} · ${pct}%</span></div><div class="report-bar"><i style="width:${pct}%"></i></div></div>`;
}
function buildReportHtml(){
  const annulled=!!state.quizAnnulled;
  const total=state.history.length;
  const correct=state.history.filter(x=>x.correct).length;
  const pct=percent(correct,total);
  const generated=new Date().toLocaleString('es-CO');
  const winner=annulled?'Quiz anulado':(state.winner?escapeHtml(state.winner):'Sin ganador definido');
  const selected=(state.selectedSections||[]).join(', ') || 'Todas';
  const ranked=[...state.players].sort((a,b)=>playerGrade(b)-playerGrade(a));
  const statusBanner=annulled ? `<div class="report-annulled-banner"><b>QUIZ ANULADO</b><span>Nota final: <strong>0/50</strong></span><small>Motivo registrado: ${escapeHtml(state.annulReason||'Se alcanzó el límite de intentos no permitidos.')} · Intentos: ${totalSecurityAttempts()}/3</small></div>` : '';
  const gradeFormula=annulled ? `\[\mathrm{Nota\ final}=0\quad\text{por anulación del quiz}\]` : `\[\mathrm{Nota}=\min\left(50\cdot\frac{\mathrm{aciertos}}{\mathrm{preguntas\ respondidas}}+\mathrm{bono},50\right)\]`;
  const playerCards=ranked.map((p,i)=>{
    const pp=percent(p.correct,p.total);
    const cheese=CATEGORIES.filter(c=>p.wedges[c.key]).map(c=>`<span class="report-cheese" style="--c:${c.solid}" title="${c.label}">${c.icon}</span>`).join('') || '<span class="report-muted">Sin quesos</span>';
    return `<article class="report-player-card ${annulled?'annulled':''}">
      <div class="report-player-head"><span class="report-rank">${i+1}</span><div><b>${escapeHtml(p.name)}</b><small>Ficha de color diferente · ${p.correct} aciertos y ${p.wrong} errores</small></div><strong class="${annulled?'grade-zero':''}">${playerGrade(p).toFixed(1)}/50</strong></div>
      <div class="report-mini-grid"><span>Respondidas: <b>${p.total}</b></span><span>Acierto: <b>${pp}%</b></span><span>Quesos: <b>${CATEGORIES.filter(c=>p.wedges[c.key]).length}/6</b></span></div>
      <div class="report-bar"><i style="width:${pp}%"></i></div>
      <div class="report-cheese-row">${cheese}</div>
    </article>`;
  }).join('');
  const sectionBars=Object.keys(SECTION_GUIDE).map(sec=>{
    const arr=state.history.filter(h=>h.section===sec);
    const ok=arr.filter(h=>h.correct).length;
    return reportBar(`${sec} · ${SECTION_GUIDE[sec].name}`, ok, arr.length);
  }).join('');
  const categoryBars=CATEGORIES.map(c=>{
    const arr=state.history.filter(h=>String(h.category||'').includes(c.label) || String(h.category||'').includes(c.key));
    const ok=arr.filter(h=>h.correct).length;
    return reportBar(c.label, ok, arr.length);
  }).join('');
  const guideCards=Object.entries(SECTION_GUIDE).map(([sec,g])=>`<article class="report-guide-card">
    <h4>${sec} · ${escapeHtml(g.name)}</h4>
    <p><b>Resultado central:</b> ${escapeHtml(g.theorem)}</p>
    <div class="report-formula">\\[${reportFormula(g.formula)}\\]</div>
    <p><b>Método recomendado:</b> ${escapeHtml(g.method)}</p>
    <p><b>Error frecuente:</b> ${escapeHtml(g.error)}</p>
  </article>`).join('');
  ensureSecurityState();
  const securityRows=[
    ['Minimizaciones o pestaña oculta', state.security?.hidden||0],
    ['Intentos de pantallazo, impresión o guardado', state.security?.screenshot||0],
    ['Salidas de pantalla completa', state.security?.fullscreen||0],
    ['Cambios de ventana o pérdida de foco', state.security?.blur||0],
    ['Uso de tecla Escape', state.security?.escape||0],
    ['Intentos de compartir pantalla detectados desde el navegador', state.security?.screenShare||0],
    ['Uso o apertura de página/ventana externa detectada', state.security?.external||0],
    ['Clic derecho bloqueado durante el quiz', state.security?.rightClick||0],
    ['Intentos de ver código fuente, inspeccionar o abrir consola', state.security?.devtools||0],
    ['Respuestas numéricas enviadas en menos de 15 segundos', state.security?.fastCalc||0],
    ['Total de eventos no permitidos', totalSecurityAttempts()],
  ].map(r=>`<tr class="${annulled && (r[0].startsWith('Total') || (Number(r[1])>0 && ['Intentos de compartir pantalla detectados desde el navegador','Uso o apertura de página/ventana externa detectada','Intentos de ver código fuente, inspeccionar o abrir consola','Respuestas numéricas enviadas en menos de 15 segundos'].includes(r[0])))?'report-security-danger':''}"><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
  const details=(state.history.length?state.history:[]).map((h,i)=>{
    const expected=reportMath(h.expected);
    const answer=reportMath(h.answer);
    const feedback=h.feedback ? h.feedback : `<p>${escapeHtml(cleanTextForReport(h.feedback||'Sin retroalimentación registrada.'))}</p>`;
    return `<article class="report-question-card">
      <header><span class="report-qnum">${i+1}</span><div><b>${escapeHtml(h.title)}</b><small>${escapeHtml(h.player)} · ${escapeHtml(h.section)} · ${escapeHtml(h.category)} · ${h.duration||0}s</small></div><strong class="${h.correct?'ok':'bad'}">${h.correct?'Correcta':'Incorrecta'}</strong></header>
      <div class="report-question-grid">
        <div><b>Respuesta del estudiante</b><span class="latex">${answer}</span></div>
        <div><b>Respuesta correcta</b><span class="latex">${expected}</span></div>
      </div>
      <details open class="report-feedback-box"><summary>Retroalimentación específica de esta pregunta</summary>${feedback}</details>
    </article>`;
  }).join('') || '<p class="report-muted">No hay preguntas respondidas todavía.</p>';
  const improvement=ranked.map(p=>{
    const ph=state.history.filter(h=>h.player===p.name);
    if(!ph.length) return `<article class="report-plan-card"><h4>${escapeHtml(p.name)}</h4><p>Debe jugar una partida completa para obtener un diagnóstico.</p></article>`;
    const weakSecs=Object.keys(SECTION_GUIDE).map(sec=>{
      const arr=ph.filter(h=>h.section===sec), ok=arr.filter(h=>h.correct).length;
      return {sec,arr,ok,pct:percent(ok,arr.length)};
    }).filter(x=>x.arr.length && x.pct<70);
    const weakTypes=CATEGORIES.map(c=>{
      const arr=ph.filter(h=>String(h.category||'').includes(c.label) || String(h.category||'').includes(c.key));
      const ok=arr.filter(h=>h.correct).length;
      return {c,arr,ok,pct:percent(ok,arr.length)};
    }).filter(x=>x.arr.length && x.pct<70);
    const secHtml=weakSecs.length ? weakSecs.map(x=>`<li><b>${x.sec} ${SECTION_GUIDE[x.sec].name}:</b> ${x.ok}/${x.arr.length}. Revisar: ${escapeHtml(SECTION_GUIDE[x.sec].method)}</li>`).join('') : '<li>No hay secciones por debajo de 70%.</li>';
    const typeHtml=weakTypes.length ? weakTypes.map(x=>`<li><b>${escapeHtml(x.c.label)}:</b> ${x.ok}/${x.arr.length}. ${escapeHtml(reinforcementFor(x.c.key))}</li>`).join('') : '<li>No hay tipos de pregunta por debajo de 70%.</li>';
    return `<article class="report-plan-card ${annulled?'annulled':''}"><h4>${escapeHtml(p.name)}</h4><p><b>Nota:</b> <span class="${annulled?'grade-zero-text':''}">${playerGrade(p).toFixed(1)}/50</span>. <b>Acierto:</b> ${percent(p.correct,p.total)}%.</p><ol>${secHtml}${typeHtml}</ol></article>`;
  }).join('');
  return `<div class="latex-report ${annulled?'annulled-report':''}">
    <section class="report-cover report-section">
      ${statusBanner}
      <div class="report-topline">Informe final · Trivial Pursuit Deluxe</div>
      <h1>Programación Dinámica<br><span>Economía Matemática</span></h1>
      <p class="report-lead">Reporte pedagógico con fórmulas renderizadas en \\(\LaTeX\\), retroalimentación por pregunta y diagramas de desempeño sin solapamiento de texto.</p>
      <div class="report-kpis">
        <div><b>${correct}/${total}</b><span>Aciertos globales</span></div>
        <div><b>${pct}%</b><span>Porcentaje global</span></div>
        <div><b>${winner}</b><span>Ganador</span></div>
        <div><b>${escapeHtml(selected)}</b><span>Secciones</span></div>
      </div>
      <div class="report-formula big">\\[\mathrm{Nota}=\min\left(50\cdot\frac{\mathrm{aciertos}}{\mathrm{preguntas\ respondidas}}+\mathrm{bono},50\right)\\]</div>
      <p><b>Inicio:</b> ${escapeHtml(state.startedAt||'No registrado')} · <b>Fin:</b> ${escapeHtml(state.endedAt||generated)} · <b>Generado:</b> ${escapeHtml(generated)}${annulled?` · <b>Anulado:</b> ${escapeHtml(state.annulledAt||generated)}`:''}</p>
    </section>
    <section class="report-section">
      <h2>1. Resumen por jugador</h2>
      <div class="report-player-grid">${playerCards}</div>
    </section>
    <section class="report-section">
      <h2>2. Gráficas de desempeño</h2>
      <h3>Por sección</h3>${sectionBars}
      <h3>Por tipo de pregunta</h3>${categoryBars}
    </section>
    <section class="report-section">
      <h2>3. Fórmulas y teoremas que debe revisar el estudiante</h2>
      <div class="report-guide-grid">${guideCards}</div>
    </section>
    <section class="report-section">
      <h2>4. Plan de mejora individual</h2>
      <div class="report-plan-grid">${improvement}</div>
    </section>
    <section class="report-section">
      <h2>5. Registro de seguridad</h2>
      <table class="report-clean-table"><thead><tr><th>Evento</th><th>Cantidad</th></tr></thead><tbody>${securityRows}</tbody></table>
    </section>
    <section class="report-section">
      <h2>6. Detalle de preguntas respondidas</h2>
      <p class="report-muted">Cada tarjeta conserva la respuesta esperada y la retroalimentación específica que vio el estudiante.</p>
      <div class="report-question-list">${details}</div>
    </section>
  </div>`;
}
async function showReport(auto=false){
  $('reportContent').innerHTML=buildReportHtml();
  $('reportModal').classList.remove('hidden');
  await typeset($('reportModal'));
  if(auto) setTimeout(downloadPdf,900);
}
function percent(ok,total){ return total?Math.round(100*ok/total):0; }
const SECTION_GUIDE={
  '12.1':{name:'Programación dinámica', theorem:'Teorema 12.1.1: ecuaciones fundamentales de programación dinámica y principio de optimalidad.', formula:'J_s(x)=max_u { f(s,x,u)+J_{s+1}(g(s,x,u)) }', method:'Identificar estado, control, transición, recompensa y resolver hacia atrás.', error:'Confundir la función de valor con la recompensa de un periodo.'},
  '12.2':{name:'Ecuación de Euler', theorem:'Condición necesaria de Euler discreta con condiciones terminales cuando corresponda.', formula:'F_2(t-1,x_{t-1},x_t)+F_1(t,x_t,x_{t+1})=0', method:'Localizar los dos términos donde aparece la variable intermedia y derivar.', error:'Olvidar que x_t aparece en dos periodos consecutivos.'},
  '12.3':{name:'Horizonte infinito', theorem:'Ecuación de Bellman estacionaria de horizonte infinito con descuento.', formula:'V(x)=max_u { f(x,u)+ beta V(g(x,u)) }', method:'Proponer forma funcional, sustituir, resolver FOC y verificar factibilidad.', error:'Tratar el problema estacionario como horizonte finito dependiente de t.'},
  '12.4':{name:'Principio del máximo', theorem:'Teorema 12.4.1: principio del máximo discreto para una variable.', formula:'H=f+p g,  H_u=0,  p_{t-1}=H_x,  x_{t+1}=g(t,x_t,u_t)', method:'Construir H, derivar respecto al control y al estado, aplicar terminalidad.', error:'Anular H completo en lugar de H_u, o perder signos en g_u.'},
  '12.5':{name:'Más variables', theorem:'Teorema 12.5.1: principio del máximo discreto con estados y controles vectoriales.', formula:'H=f+p·g,  ∇_u H=0,  p_{t-1}=∇_x H', method:'Organizar dimensiones, formar producto punto p·g y calcular gradientes/Jacobianos.', error:'Usar un solo coestado para varios estados u omitir componentes.'}
};
async function downloadPdf(){
  const {jsPDF}=window.jspdf||{};
  if(!jsPDF || !window.html2canvas){
    alert('No se pudieron cargar las librerías de PDF. Abre el informe y usa Imprimir > Guardar como PDF.');
    return;
  }
  const source=$('reportContent');
  if(!source || !source.innerHTML.trim()) source.innerHTML=buildReportHtml();
  await typeset(source);
  await sleep(250);

  const wrapper=document.createElement('div');
  wrapper.className='pdf-capture-wrapper';
  const clone=source.cloneNode(true);
  clone.id='reportContentPdfClone';
  clone.style.width='900px';
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);
  await typeset(clone);
  await sleep(250);

  try{
    const canvas=await html2canvas(clone,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false,windowWidth:960});
    const doc=new jsPDF({orientation:'p',unit:'pt',format:'letter'});
    const pageW=doc.internal.pageSize.getWidth();
    const pageH=doc.internal.pageSize.getHeight();
    const sliceH=Math.floor(canvas.width*pageH/pageW);
    let y=0, page=0;
    while(y<canvas.height){
      const h=Math.min(sliceH, canvas.height-y);
      const pageCanvas=document.createElement('canvas');
      pageCanvas.width=canvas.width;
      pageCanvas.height=h;
      const ctx=pageCanvas.getContext('2d');
      ctx.fillStyle='#ffffff';
      ctx.fillRect(0,0,pageCanvas.width,pageCanvas.height);
      ctx.drawImage(canvas,0,y,canvas.width,h,0,0,canvas.width,h);
      if(page>0) doc.addPage();
      const img=pageCanvas.toDataURL('image/png');
      const imgH=h*pageW/canvas.width;
      doc.addImage(img,'PNG',0,0,pageW,imgH,undefined,'FAST');
      doc.setFont('helvetica','normal');
      doc.setFontSize(8);
      doc.setTextColor(90,90,90);
      doc.text(`Página ${page+1}`,pageW-72,pageH-18);
      y+=h;
      page++;
    }
    doc.save(`informe_latex_programacion_dinamica_${new Date().toISOString().slice(0,19).replace(/[:]/g,'-')}.pdf`);
  }catch(err){
    console.error(err);
    alert('No se pudo generar el PDF automáticamente. El informe queda visible en pantalla para imprimirlo o guardarlo como PDF.');
  }finally{
    wrapper.remove();
  }
}
function reinforcementFor(key){
  return ({evaluacion:'Revisar el criterio usado y justificar cada paso antes de responder.',vf:'Leer cada afirmación por separado y buscar cuantificadores absolutos.',formulacion:'Escribir objetivo, transición, dominio del control, condición inicial y Bellman/Euler.',calculo:'Hacer las cuentas en orden y verificar que la respuesta sea un entero.',conceptual:'Volver a las definiciones y distinguir horizonte finito, infinito y estacionariedad.',otros:'Revisar Hamiltoniano, coestados, gradientes y dimensiones.'})[key]||'Revisar el procedimiento base.';
}

function gameIsRunning(){
  const gameVisible=$('gameScreen') && !$('gameScreen').classList.contains('hidden');
  return Boolean(gameVisible && state.players?.length && !state.winner && !state.quizAnnulled);
}
function totalSecurityAttempts(){
  const sec=ensureSecurityState();
  if(Number.isFinite(sec.total)) return sec.total;
  return (sec.hidden||0)+(sec.screenshot||0)+(sec.fullscreen||0)+(sec.blur||0)+(sec.escape||0)+(sec.screenShare||0)+(sec.external||0)+(sec.fastCalc||0)+(sec.rightClick||0)+(sec.devtools||0);
}
function allowSafeNavigation(ms=2500){ state.ignoreSecurityUntil=Date.now()+ms; }
function registerSecurityAttempt(kind,label){
  const now=Date.now();
  if(now < (state.ignoreSecurityUntil||0)) return;
  if(!gameIsRunning() || !state.fullscreenRequired) return;
  // Evita que una misma acción cuente doble: por ejemplo, Escape puede activar
  // simultáneamente keydown + salida de pantalla completa + pérdida de foco.
  if(now-(state.lastSecurityAttemptAt||0)<1200) return;
  state.lastSecurityAttemptAt=now;
  if(!state.security) state.security=securityDefaults();
  state.security[kind]=(state.security[kind]||0)+1;
  state.security.total=(state.security.total||0)+1;
  const total=totalSecurityAttempts();
  const left=Math.max(0,3-total);
  if(total>=3){
    annulQuiz(label || 'Intento de salida o captura no permitido');
  }else{
    const msg=`⚠️ Intento no permitido registrado: ${label}. Intentos: ${total}/3. ${left} intento(s) restante(s) antes de anular el quiz.`;
    if($('gameLog')) $('gameLog').textContent=msg;
    const block=$('fullscreenBlock');
    if(block){
      const p=block.querySelector('p');
      if(p) p.textContent=msg+' Solicita al docente continuar en pantalla completa.';
    }
  }
}

function registerCriticalSecurity(kind,label){
  const now=Date.now();
  if(now < (state.ignoreSecurityUntil||0)) return;
  if(!gameIsRunning() || !state.fullscreenRequired) return;
  const sec=ensureSecurityState();
  sec[kind]=(sec[kind]||0)+1;
  sec.total=(sec.total||0)+1;
  annulQuiz(label || 'conducta no permitida detectada');
}
function questionModalVisible(){
  const modal=$('questionModal');
  return Boolean(modal && !modal.classList.contains('hidden') && state.activeQuestion);
}
function installScreenShareAndExternalGuards(){
  // Limitación del navegador: una página web no puede saber con certeza si otra app
  // o una extensión externa está compartiendo pantalla. Este bloque sí detecta y
  // bloquea intentos hechos desde la propia página/API del navegador, navegación
  // externa, atajos de cambio de página y pérdida de visibilidad durante una pregunta.
  try{
    if(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia==='function' && !navigator.mediaDevices.__triviaGuarded){
      const originalGetDisplayMedia=navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getDisplayMedia=async function(...args){
        registerCriticalSecurity('screenShare','intento de compartir pantalla desde el navegador durante el quiz');
        throw new DOMException('La captura de pantalla está bloqueada durante el quiz.','NotAllowedError');
      };
      navigator.mediaDevices.__triviaGuarded=true;
      navigator.mediaDevices.__triviaOriginalGetDisplayMedia=originalGetDisplayMedia;
    }
  }catch(e){}
  try{
    if(!window.__triviaWindowOpenGuarded){
      const originalOpen=window.open.bind(window);
      window.open=function(...args){
        registerCriticalSecurity('external','intento de abrir una página o ventana externa durante el quiz');
        return null;
      };
      window.__triviaWindowOpenGuarded=true;
      window.__triviaOriginalOpen=originalOpen;
    }
  }catch(e){}
  document.addEventListener('click',e=>{
    const a=e.target?.closest?.('a[href]');
    if(a && gameIsRunning()){
      const href=a.getAttribute('href')||'';
      const url=new URL(href, location.href);
      if(url.origin!==location.origin || a.target==='_blank'){
        e.preventDefault();
        registerCriticalSecurity('external','intento de abrir enlace o página externa durante el quiz');
      }
    }
  },true);
}

function announceSecurityMessage(label){
  const msg = `⛔ Acción bloqueada durante el quiz: ${label}.`;
  if($('gameLog')) $('gameLog').textContent = msg;
  const block=$('fullscreenBlock');
  if(block){
    const p=block.querySelector('p');
    if(p) p.textContent = msg + ' El docente debe mantener la actividad en modo seguro.';
  }
}

function registerDevtoolsAttempt(label, critical=true){
  if(critical) registerCriticalSecurity('devtools', label || 'intento de inspeccionar, abrir consola o ver código fuente');
  else registerSecurityAttempt('devtools', label || 'intento de inspeccionar, abrir consola o ver código fuente');
  announceSecurityMessage(label || 'intento de inspeccionar, abrir consola o ver código fuente');
}

function installAntiInspectionGuards(){
  // Bloquea acciones comunes de clic derecho, ver código fuente e inspección.
  // Importante: una página publicada en GitHub Pages no puede impedir al 100 % que
  // un usuario avanzado vea archivos descargados por el navegador, pero sí puede
  // bloquear y registrar los intentos hechos durante la sesión del quiz.
  if(window.__triviaAntiInspectionInstalled) return;
  window.__triviaAntiInspectionInstalled = true;

  document.addEventListener('contextmenu', e=>{
    if(gameIsRunning() && state.fullscreenRequired){
      e.preventDefault();
      registerSecurityAttempt('rightClick','clic derecho durante el quiz');
      announceSecurityMessage('clic derecho durante el quiz');
      return false;
    }
  }, true);

  document.addEventListener('selectstart', e=>{
    if(gameIsRunning() && state.fullscreenRequired && !['INPUT','TEXTAREA'].includes(String(e.target?.tagName||''))){
      e.preventDefault();
    }
  }, true);

  document.addEventListener('dragstart', e=>{
    if(gameIsRunning() && state.fullscreenRequired){
      e.preventDefault();
    }
  }, true);

  document.addEventListener('copy', e=>{
    if(gameIsRunning() && state.fullscreenRequired && !['INPUT','TEXTAREA'].includes(String(e.target?.tagName||''))){
      e.preventDefault();
      registerSecurityAttempt('devtools','intento de copiar contenido del quiz');
    }
  }, true);

  document.addEventListener('keydown', e=>{
    if(!gameIsRunning() || !state.fullscreenRequired) return;
    const key = String(e.key||'');
    const lower = key.toLowerCase();
    const ctrlOrMeta = e.ctrlKey || e.metaKey;
    const devCombo = key === 'F12'
      || (ctrlOrMeta && lower === 'u')
      || (ctrlOrMeta && e.shiftKey && ['i','j','c','k'].includes(lower))
      || (e.metaKey && e.altKey && ['i','j','c','u'].includes(lower));
    if(devCombo){
      e.preventDefault();
      e.stopPropagation();
      registerDevtoolsAttempt('intento de ver código fuente, inspeccionar elemento o abrir consola', true);
      return false;
    }
  }, true);

  let devtoolsScore = 0;
  setInterval(()=>{
    if(!gameIsRunning() || !state.fullscreenRequired || state.quizAnnulled) { devtoolsScore=0; return; }
    if(window.innerWidth < 760) { devtoolsScore=0; return; }
    const widthGap = Math.abs((window.outerWidth||0) - (window.innerWidth||0));
    const heightGap = Math.abs((window.outerHeight||0) - (window.innerHeight||0));
    const suspicious = widthGap > 220 || heightGap > 260;
    devtoolsScore = suspicious ? devtoolsScore + 1 : Math.max(0, devtoolsScore-1);
    if(devtoolsScore >= 3 && !window.__triviaDevtoolsAnnulled){
      window.__triviaDevtoolsAnnulled = true;
      registerDevtoolsAttempt('apertura del panel de inspección o consola detectada por cambio de tamaño de ventana', true);
    }
  }, 1200);
}

function annulQuiz(reason){
  if(state.quizAnnulled) return;
  state.quizAnnulled=true;
  state.annulReason=reason || 'Se alcanzó el límite de intentos no permitidos.';
  state.annulledAt=new Date().toLocaleString('es-CO');
  state.endedAt=state.annulledAt;
  state.winner=null;
  state.fullscreenRequired=false;
  document.body.classList.remove('quiz-secure-active');
  clearInterval(state.totalTimer);
  clearInterval(state.timerId);
  state.timeLeft=0;
  state.activeQuestion=null;
  state.rolled=true;
  state.moving=false;
  ['questionModal','fullscreenBlock'].forEach(id=>$(id)?.classList.add('hidden'));
  if($('rollBtn')) $('rollBtn').disabled=true;
  if($('pauseBtn')) $('pauseBtn').disabled=true;
  if($('gameLog')) $('gameLog').textContent=`⛔ QUIZ ANULADO: ${state.annulReason}. La nota final es 0/50.`;
  renderPlayers();
  showReport(true);
}
function finishGame(){ allowSafeNavigation(); document.body.classList.remove('quiz-secure-active'); if(state.quizAnnulled){ showReport(true); return; } state.endedAt=new Date().toLocaleString('es-CO'); clearInterval(state.totalTimer); if(!state.winner){ const ranked=[...state.players].sort((a,b)=>(b.correct-b.wrong/2)-(a.correct-a.wrong/2)); state.winner=ranked[0]?.name||null; } showReport(true); }
function stopGameSession(){
  document.body.classList.remove('quiz-secure-active');
  clearInterval(state.totalTimer);
  clearInterval(state.timerId);
  state.rolled=false;
  state.diceValue=0;
  state.moving=false;
  state.activeQuestion=null;
  ['questionModal','reportModal','fullscreenBlock'].forEach(id=>$(id)?.classList.add('hidden'));
  if($('rollBtn')) $('rollBtn').disabled=false;
  if($('dice')) $('dice').textContent='?';
}
function returnToMainMenu(){
  allowSafeNavigation();
  const ok=!state.players.length || confirm('¿Deseas regresar al menú principal? La partida actual quedará detenida.');
  if(!ok) return;
  stopGameSession();
  showScreen('setupScreen');
  fitBoardToViewport();
  setTimeout(()=>{ requestFullScreen(); typeset($('setupScreen')); },120);
}
function returnToTeacherWindow(){
  allowSafeNavigation();
  const ok=!state.players.length || confirm('¿Deseas regresar a la ventana docente? La partida actual quedará detenida.');
  if(!ok) return;
  stopGameSession();
  $('teacherPassword').value='';
  $('lockError').textContent='';
  showScreen('lockScreen');
  fitBoardToViewport();
  setTimeout(()=>{ requestFullScreen(); typeset($('lockScreen')); },120);
}
function initEvents(){
  $('unlockBtn').addEventListener('click',async()=>{ if(validTeacherPassword($('teacherPassword').value)){ state.fullscreenRequired=true; await requestFullScreen(); showScreen('setupScreen'); setTimeout(()=>{typeset(); checkFullscreenState();},80); } else $('lockError').textContent='Clave incorrecta. Solicita al docente que ingrese la contraseña.'; });
  $('teacherPassword').addEventListener('keydown',e=>{ if(e.key==='Enter') $('unlockBtn').click(); });
  $('backLockBtn').addEventListener('click',()=>{ showScreen('lockScreen'); $('fullscreenBlock').classList.add('hidden'); });
  $('playerCount').addEventListener('change',renderPlayerConfig); $('startGameBtn').addEventListener('click',startGame);
  $('frontViewBtn').addEventListener('click',()=>setBoardView('view-front')); $('threeDViewBtn').addEventListener('click',()=>setBoardView('view-3d')); $('orbitViewBtn').addEventListener('click',()=>setBoardView('view-orbit'));
  $('musicBtn').addEventListener('click',toggleMusic); $('fxBtn').addEventListener('click',toggleFx); $('rollBtn').addEventListener('click',rollDice);
  ['finishBtn','topFinishBtn'].forEach(id=>$(id)?.addEventListener('click',finishGame));
  ['mainMenuBtn','topMainMenuBtn'].forEach(id=>$(id)?.addEventListener('click',returnToMainMenu));
  ['teacherWindowBtn','topTeacherWindowBtn'].forEach(id=>$(id)?.addEventListener('click',returnToTeacherWindow));
  $('submitBtn').addEventListener('click',submitQuestion); $('continueBtn').addEventListener('click',continueAfterQuestion); $('hintBtn').addEventListener('click',showHint); $('pauseBtn').addEventListener('click',togglePause);
  $('closeReportBtn').addEventListener('click',()=>$('reportModal').classList.add('hidden')); $('downloadPdfBtn').addEventListener('click',downloadPdf); $('resumeFullscreenBtn').addEventListener('click',requestFullScreen);
  window.addEventListener('resize',()=>{ fitBoardToViewport(); if(!$('gameScreen').classList.contains('hidden')) renderBoard(); }); window.addEventListener('orientationchange',()=>setTimeout(()=>{ fitBoardToViewport(); if(!$('gameScreen').classList.contains('hidden')) renderBoard(); },260));
  document.addEventListener('fullscreenchange',()=>{ if(state.fullscreenRequired && !isFullScreen()) registerSecurityAttempt('fullscreen','salida de pantalla completa'); checkFullscreenState(); fitBoardToViewport(); });
  document.addEventListener('webkitfullscreenchange',()=>{ if(state.fullscreenRequired && !isFullScreen()) registerSecurityAttempt('fullscreen','salida de pantalla completa'); checkFullscreenState(); fitBoardToViewport(); });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden && state.fullscreenRequired){
      if(questionModalVisible()) registerCriticalSecurity('external','uso de otra pestaña, aplicación o página externa durante una pregunta');
      else registerSecurityAttempt('hidden','pestaña oculta o minimización');
    }
    setTimeout(()=>{ checkFullscreenState(); fitBoardToViewport(); },250);
  });
  window.addEventListener('focus',()=>setTimeout(()=>{ insistFullscreen(); fitBoardToViewport(); },180));
  window.addEventListener('blur',()=>{ if(state.fullscreenRequired) registerSecurityAttempt('blur','cambio de ventana o pérdida de foco'); setTimeout(checkFullscreenState,80); });
  document.addEventListener('keydown',e=>{
    const key=String(e.key||''); const lower=key.toLowerCase();
    const externalCombo=(e.ctrlKey||e.metaKey) && ['l','t','n','o','r','tab'].includes(lower);
    const saveOrPrint=(e.ctrlKey||e.metaKey) && ['p','s'].includes(lower);
    const screenshotCombo=(e.shiftKey && e.metaKey && ['s','4','5'].includes(lower));
    if(key==='PrintScreen' || saveOrPrint || screenshotCombo){
      registerSecurityAttempt('screenshot','intento de pantallazo, impresión o guardado');
      e.preventDefault?.();
    }
    if(externalCombo){
      registerCriticalSecurity('external','atajo para abrir, buscar, recargar o cambiar a página externa durante el quiz');
      e.preventDefault?.();
    }
    if(key==='Escape'){
      registerSecurityAttempt('escape','uso de tecla Escape');
      e.preventDefault?.();
      setTimeout(checkFullscreenState,80);
    }
  },true);
  window.addEventListener('beforeprint',()=>registerSecurityAttempt('screenshot','intento de impresión o captura'));
  window.addEventListener('pagehide',()=>registerCriticalSecurity('external','intento de salir, cerrar, recargar o cambiar de página durante el quiz'));
  window.addEventListener('beforeunload',e=>{ if(gameIsRunning()){ registerCriticalSecurity('external','intento de cerrar, recargar o navegar fuera del quiz'); e.preventDefault(); e.returnValue=''; return ''; } });
  installScreenShareAndExternalGuards();
  installAntiInspectionGuards();
  setInterval(()=>{ if(state.fullscreenRequired && !state.quizAnnulled){ checkFullscreenState(); if(!document.hidden && !isFullScreen()) requestFullScreen(); } },900);
}
window.addEventListener('DOMContentLoaded',()=>{ state.fullscreenRequired=true; installScreenShareAndExternalGuards(); installAntiInspectionGuards(); initSetup(); initEvents(); armFullscreenFromGesture(); updateClock(); setInterval(updateClock,1000); setTimeout(()=>{ requestFullScreen(); checkFullscreenState(); fitBoardToViewport(); typeset(); },250); setInterval(fitBoardToViewport,1000); });
