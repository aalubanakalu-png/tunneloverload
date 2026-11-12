(function(){
'use strict';
const $=id=>document.getElementById(id);
const canvas=$('gl');
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(82,1,0.1,200);
camera.rotation.order='ZYX';

/* ---------- palettes: [checkerA, checkerB, deepStep, slab, fog] ---------- */
const H=h=>new THREE.Color(h);
const PAL=[
 [H('#2f8fe0'),H('#d9eefc'),H('#0a1330'),H('#a8d400'),H('#02030a')],
 [H('#ff3b14'),H('#ffb21a'),H('#4a0a06'),H('#a8d400'),H('#0b0202')],
 [H('#ff2fbf'),H('#17d321'),H('#190a22'),H('#8d3fd0'),H('#050209')],
 [H('#7a22e8'),H('#e9e4f0'),H('#1a0a40'),H('#e21ce6'),H('#04020c')],
 [H('#1ec9e8'),H('#ff4fb0'),H('#ffd23a'),H('#8b2fd3'),H('#020a0c')],
 [H('#6a4a38'),H('#b9a45a'),H('#2a1614'),H('#3c9aa0'),H('#080403')],
 [H('#f2f200'),H('#101010'),H('#c40000'),H('#1c6bff'),H('#000000')],
 [H('#00ffa6'),H('#6a00ff'),H('#001a2a'),H('#ff6a00'),H('#000308')]
];
const ZONE_RINGS=70, RINGS=46, SEG=26, SP=2.4, R=7.4;

/* ---------- theme: UI accents follow the tunnel palette ---------- */
function lum(c){return 0.2126*c.r+0.7152*c.g+0.0722*c.b}
let themeZone=-1;
function setTheme(zone){
  if(zone===themeZone)return;themeZone=zone;
  const P=PAL[zone%PAL.length],r=document.documentElement.style;
  const put=(n,c)=>{r.setProperty(n,'#'+c.getHexString());r.setProperty(n+'-t',lum(c)>0.4?'#0a0810':'#ffffff')};
  put('--acc',P[3]);put('--acc2',P[0]);put('--acc3',P[1]);
  if(typeof HM!=='undefined')HM.acc.color.copy(P[3]);
}

/* ---------- serpentine centerline: the whole tunnel wanders left-right and up-down ---------- */
function C(d){
  if(st.mode==='tut'||d<60)return [0,0];
  const k=Math.min(1,(d-60)/900),e=k*k*(3-2*k);
  return [e*(7.0*Math.sin(d*0.024)+2.0*Math.sin(d*0.058+1.1)),e*(4.8*Math.sin(d*0.019+0.7)+1.4*Math.sin(d*0.049+2.3))];
}

/* ---------- tunnel ---------- */
const box=new THREE.BoxBufferGeometry(1,1,1);
const mat=new THREE.MeshLambertMaterial({color:0xffffff});
const tunnel=new THREE.InstancedMesh(box,mat,RINGS*SEG);
tunnel.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
tunnel.frustumCulled=false;
tunnel.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(RINGS*SEG*3),3);
tunnel.instanceColor.setUsage(THREE.DynamicDrawUsage);
scene.add(tunnel);
scene.add(new THREE.AmbientLight(0xffffff,.42));
const dl=new THREE.DirectionalLight(0xffffff,.45);dl.position.set(.3,1,.5);scene.add(dl);
const headlamp=new THREE.PointLight(0xffffff,.55,60,1.2);scene.add(headlamp);
scene.fog=new THREE.Fog(0x000000,26,118);

function hash(a,b){let h=(a*374761393+b*668265263)|0;h=(h^(h>>>13))*1274126177|0;h^=h>>>16;return (h>>>0)/4294967296}
const dummy=new THREE.Object3D();
const mix=new THREE.Color();
function updateTunnel(dist,pulse,zone){
  const g0=Math.floor(dist/SP)-3;
  for(let k=0;k<RINGS;k++){
    const g=g0+k;
    const zi=Math.max(0,Math.floor(g/ZONE_RINGS));
    const P=PAL[zi%PAL.length];
    const twist=g*(0.05+0.03*Math.sin(g*0.013))+Math.sin(g*0.021)*0.9;
    const z=-g*SP,cc=C(g*SP);
    for(let s=0;s<SEG;s++){
      const a=s/SEG*Math.PI*2+twist;
      const n=hash(g,s);
      let v=0.5+0.5*Math.sin(a*3+g*0.33)*Math.cos(g*0.11+s*0.5);
      v=v*0.75+n*0.35;
      let d=Math.round(v*5.6)*0.5+0.4;
      if(((g+s)&3)===0) d+=pulse*0.9;
      const rIn=R-d, rc=(rIn+R+2)/2, rl=R+2-rIn;
      dummy.position.set(Math.cos(a)*rc+cc[0],Math.sin(a)*rc+cc[1],z);
      dummy.rotation.set(0,0,a-Math.PI/2);
      dummy.scale.set(2*Math.PI*rIn/SEG*1.03,rl,SP*1.01);
      dummy.updateMatrix();
      const i=k*SEG+s;
      tunnel.setMatrixAt(i,dummy.matrix);
      const c=d>2.4?P[2]:(((g+s)&1)?P[1]:P[0]);
      const sh=0.55+0.45*(d/3.6);
      mix.copy(c).multiplyScalar(d>2.4?1:sh*0.85);
      tunnel.setColorAt(i,mix);
    }
  }
  tunnel.instanceMatrix.needsUpdate=true;
  tunnel.instanceColor.needsUpdate=true;
  const fog=PAL[zone%PAL.length][4];
  scene.fog.color.copy(fog);renderer.setClearColor(fog,1);
}

/* ---------- slabs ---------- */
const RS=R-0.05;
function discSeg(c){const a0=Math.asin(Math.max(-1,Math.min(1,c/RS)));const s=new THREE.Shape();s.absarc(0,0,RS,a0,Math.PI-a0,false);s.closePath();return s}
function barShape(w){const h=RS*0.99;const s=new THREE.Shape();s.moveTo(-w,-h);s.lineTo(w,-h);s.lineTo(w,h);s.lineTo(-w,h);s.closePath();return s}
function sectorShape(a0,sw){const s=new THREE.Shape();s.moveTo(0,0);s.absarc(0,0,RS,a0,a0+sw,false);s.closePath();return s}
function holeShape(hx,hy,hr){const s=new THREE.Shape();s.absarc(0,0,RS,0,Math.PI*2,false);const h=new THREE.Path();h.absarc(hx,hy,hr,0,Math.PI*2,true);s.holes.push(h);return s}
const edgeMat=new THREE.LineBasicMaterial({color:0xffffff});

function GAP(n){return Math.max(20,34-n*0.15)}
const zCache=[];function zOf(n){while(zCache.length<=n)zCache.push(zCache.length?zCache[zCache.length-1]+GAP(zCache.length-1):46);return zCache[n]}
function spec(n){
  const r=k=>hash(n*7+k,n+101);
  // new obstacle kinds unlock gradually: half-discs first, then bars and holes, then crosses, then wedges
  const pool=n<2?[0]:n<6?[0,1,4]:n<12?[0,1,4,2]:[0,1,2,3,4];
  const t=pool[Math.floor(r(1)*pool.length)];
  const hard=Math.min(1,zOf(n)/3000);
  const o={n,t,spin:(r(2)<.5?-1:1)*(r(3)*0.5+0.15+hard*0.7)*(n<3?0:1)*(0.3+0.7*hard),ang:r(4)*Math.PI*2};
  if(t===0){o.c=(r(5)-.5)*2.6;o.shape=discSeg(o.c)}
  else if(t===1){o.w=1.1+r(5)*0.9;o.shape=barShape(o.w)}
  else if(t===2){o.w=0.85+r(5)*0.35;o.shape=barShape(o.w)}
  else if(t===3){o.a0=r(5)*6.28;o.sw=Math.PI*(1.05+r(6)*0.25);o.shape=sectorShape(0,o.sw)}
  else{o.hr=2.1-hard*0.5+r(5)*0.3;const rr=r(6)*2.8;const aa=r(7)*6.28;o.hx=Math.cos(aa)*rr;o.hy=Math.sin(aa)*rr;o.shape=holeShape(o.hx,o.hy,o.hr)}
  return o;
}
const specCache=new Map();
function specOf(n){let s=specCache.get(n);if(!s){s=spec(n);specCache.set(n,s)}return s}

const live=new Map();
function makeSlabFrom(o,z,zoneIdx,key){
  const col=PAL[zoneIdx%PAL.length][3];
  const grp=new THREE.Group();
  const geo=new THREE.ShapeBufferGeometry(o.shape,24);
  const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:col.clone().multiplyScalar(.92),side:THREE.DoubleSide}));
  grp.add(m);
  const eg=new THREE.LineSegments(new THREE.EdgesGeometry(geo),edgeMat);grp.add(eg);
  if(o.t===2){const m2=m.clone();m2.rotation.z=Math.PI/2;grp.add(m2);const e2=eg.clone();e2.rotation.z=Math.PI/2;grp.add(e2)}
  const cc=C(z);grp.position.set(cc[0],cc[1],-z);
  grp.userData={n:key,geo,o,z};
  scene.add(grp);
  return grp;
}
function makeSlab(n){return makeSlabFrom(specOf(n),zOf(n),Math.floor(zOf(n)/(ZONE_RINGS*SP)),n)}
function buildSpec(o){
  if(o.t===0)o.shape=discSeg(o.c);
  else if(o.t===1||o.t===2)o.shape=barShape(o.w);
  else if(o.t===3)o.shape=sectorShape(0,o.sw);
  else o.shape=holeShape(o.hx,o.hy,o.hr);
  return o;
}
function clearSlabs(){live.forEach(g=>{scene.remove(g);g.userData.geo.dispose()});live.clear()}
function slabInside(o,lx,ly,pr){
  const d=Math.hypot(lx,ly);
  if(o.t===0){return ly>o.c-pr&&d<RS+1}
  if(o.t===1){return Math.abs(lx)<o.w+pr}
  if(o.t===2){return Math.abs(lx)<o.w+pr||Math.abs(ly)<o.w+pr}
  if(o.t===3){
    let a=Math.atan2(ly,lx);a=((a%6.2832)+6.2832)%6.2832;
    if(d<pr*1.4)return true;
    const pad=pr/Math.max(d,.5);
    return a<o.sw+pad||a>6.2832-pad;
  }
  const hd=Math.hypot(lx-o.hx,ly-o.hy);return hd>o.hr-pr;
}

/* ---------- persistence ---------- */
const GOAL=3600;
// Speed eases up from 12 to about 50, then past 85% it keeps climbing with no ceiling until reaction time runs out.
const RAMP_AT=GOAL*0.85;
function runSpeed(d){
  let v=12+40*(1-Math.exp(-d/1500));
  if(d>RAMP_AT){const x=(d-RAMP_AT)/(GOAL-RAMP_AT);v+=150*x*x}
  return v;
}
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,String(v))}catch(e){}}
};
let attempt=parseInt(store.get('to_att','1'),10)||1;
let bestDist=parseInt(store.get('to_bestd','0'),10)||0;
let lastRunAt=0;
// farther run ranks higher; on equal distance the more recent run ranks higher
function byRank(a,b){return (b.d-a.d)||(b.at-a.at)}
let localRuns=[];try{localRuns=JSON.parse(store.get('to_runs','[]'))||[]}catch(e){localRuns=[]}
localRuns.sort(byRank);
const pctOf=d=>Math.min(100,Math.floor(d/GOAL*100));

/* ---------- game state ---------- */
const st={last:null,wx:0,wy:0,mode:'menu',dist:0,prevDist:0,speed:0,roll:0,tx:0,ty:0,px:0,py:0,alive:false,dead:0,t:0,shake:0,won:false,demo:0};

function reset(){
  st.dist=0;st.prevDist=0;st.roll=0;st.px=st.py=st.tx=st.ty=0;st.alive=true;st.dead=0;st.t=0;st.won=false;
  clearSlabs();audio.restart();hideOver();heliCrash(false);heli.spd=Math.max(heli.spd,.3);
  $('attn').textContent=attempt.toLocaleString();
  $('best').textContent=pctOf(bestDist);
}
function die(){
  st.alive=false;st.dead=0;st.shake=1;heliCrash(true);
  const d=Math.floor(st.dist),pct=pctOf(d);
  const isBest=d>bestDist;
  if(isBest){bestDist=d;store.set('to_bestd',bestDist)}
  attempt++;store.set('to_att',attempt);
  if(d>30){
    localRuns.push({d:d,at:Date.now()});
    localRuns.sort(byRank);localRuns=localRuns.slice(0,10);
    store.set('to_runs',JSON.stringify(localRuns));
  }
  $('flash').style.opacity=1;
  audio.hit();
  st.last={pct:pct,d:d,isBest:isBest&&d>60,att:attempt-1};
  lastRunAt=localRuns.length&&d>30?localRuns.find(r=>r.d===d)?.at:0;
}

/* ---------- audio ---------- */
const audio=(function(){
  let ctx=null,master=null,nextT=0,step=0,on=true,timer=null;
  const BPM=150,SPS=60/BPM/4;
  const scales=[[0,3,7,10],[0,3,5,7],[0,4,7,11],[0,2,7,9],[0,3,6,10],[0,5,7,12],[0,4,7,9],[0,3,7,8]];
  function init(){
    if(ctx)return;
    try{ctx=new (window.AudioContext||window.webkitAudioContext)()}catch(e){return}
    master=ctx.createGain();master.gain.value=.5;
    const comp=ctx.createDynamicsCompressor();master.connect(comp);comp.connect(ctx.destination);
  }
  function osc(type,f,t,dur,vol,fEnd){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);
    if(fEnd)o.frequency.exponentialRampToValueAtTime(fEnd,t+dur);
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.02);
  }
  let nbuf=null;
  function noise(t,dur,vol){
    if(!nbuf){nbuf=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const d=nbuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
    const s=ctx.createBufferSource(),g=ctx.createGain(),f=ctx.createBiquadFilter();s.buffer=nbuf;f.type='highpass';f.frequency.value=6000;
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+dur+.02);
  }
  function schedule(){
    const m=st.mode;
    if(!ctx||!on)return;
    if(m==='play'&&!st.alive)return;
    while(nextT<ctx.currentTime+.12){
      const zone=Math.floor(st.dist/(ZONE_RINGS*SP));
      const root=[41,43,38,45,40,36,47,42][zone%8];
      const sc=scales[zone%8];
      const s=step%16;
      const hz=n=>440*Math.pow(2,(n-69)/12);
      if(m==='play'){
        if(s%4===0){osc('sine',150,nextT,.22,.9,42)}
        if(s%2===1)noise(nextT,.04,.12);
        if(s===4||s===12)noise(nextT,.12,.25);
        if(s%4===2||s===0||s===7||s===11){const nn=root+(s<8?0:sc[1]-3);osc('sawtooth',hz(nn)/2,nextT,.2,.16)}
        osc('square',hz(root+24+sc[(step*3+((step>>4)%3))%4]),nextT,SPS*1.6,.045);
      }else if(m==='tut'){
        if(s%4===0)osc('sine',140,nextT,.2,.55,45);
        if(s%4===2)noise(nextT,.03,.07);
        if(s===0||s===8)osc('triangle',hz(root+12),nextT,SPS*6,.2);
        if(s%2===0)osc('triangle',hz(root+24+sc[(step>>1)%4]),nextT,SPS*1.8,.06);
      }else{
        if(s===0||s===8)osc('sine',120,nextT,.25,.4,45);
        if(s%4===2)noise(nextT,.025,.05);
        if(s===0)osc('sine',hz(root+12),nextT,SPS*15,.22);
        if(s===0)osc('triangle',hz(root+19+sc[1]-3),nextT,SPS*15,.07);
        if(s%2===0)osc('triangle',hz(root+24+sc[((step>>1)*5+(step>>5))%4]),nextT,SPS*2.4,.07);
      }
      nextT+=SPS;step++;
    }
  }
  return{
    unlock(){const first=!ctx;init();if(ctx&&ctx.state==='suspended')ctx.resume();if(!timer)timer=setInterval(schedule,25);if(first&&ctx){step=0;nextT=ctx.currentTime+.05}},
    restart(){if(!ctx)return;step=0;nextT=ctx.currentTime+.05},
    hit(){if(!ctx||!on)return;const t=ctx.currentTime;noise(t,.4,.6);osc('sawtooth',220,t,.45,.5,30);osc('sine',90,t,.3,.9,25)},
    toggle(){on=!on;if(on&&ctx)nextT=ctx.currentTime+.05;return on}
  };
})();

/* ---------- screens ---------- */
function paintMeter(el,pct){
  if(!el.children.length)for(let k=0;k<20;k++)el.appendChild(document.createElement('i'));
  const n=pct>0?Math.max(1,Math.round(pct/5)):0;
  for(let k=0;k<20;k++)el.children[k].className=k<n?'on':'';
}
function refreshMenu(){
  $('m-att').textContent=(attempt-1).toLocaleString();
  $('m-best').textContent=pctOf(bestDist);
  paintMeter($('m-meter'),pctOf(bestDist));
}
function show(which){
  $('menu').hidden=which!=='menu';
  $('board').hidden=which!=='board';
  const play=which==='none';
  $('hud').hidden=!play;heliG.visible=play||which==='menu';
  if(which==='menu'){heliRoot.scale.setScalar(0.36);heliRoot.rotation.set(0,0,0);heliRoot.position.set(0,0,0)}
}
function toMenu(){
  st.mode='menu';st.alive=false;clearSlabs();
  $('hud').classList.remove('tutmode');$('tut').hidden=true;$('tutend').hidden=true;
  $('cap').style.opacity=0;$('flash').style.opacity=0;aimEl.hidden=true;hideOver();
  audio.restart();refreshMenu();show('menu');
}
let overAt=0;
function hideOver(){$('over').hidden=true;$('hud').classList.remove('over')}
function showOver(){
  const L=st.last||{pct:0,d:0,isBest:false,att:attempt-1};
  $('over-pct').textContent=L.pct+'%';
  $('over-new').hidden=!L.isBest;
  paintMeter($('over-meter'),L.pct);
  $('over-sub').innerHTML='attempt <b>'+L.att.toLocaleString()+'</b> &middot; best <b>'+pctOf(bestDist)+'%</b>';
  overAt=performance.now();$('hud').classList.add('over');$('over').hidden=false;
}
function retry(){
  if(performance.now()-overAt<350)return;
  hideOver();capHide();reset();
}
function homeFromOver(){if(performance.now()-overAt<350)return;toMenu()}
function begin(){
  audio.unlock();
  heli.spd=0;st.mode='play';$('hud').classList.remove('tutmode');$('tut').hidden=true;$('tutend').hidden=true;show('none');reset();
}

/* leaderboard: this device only, one list */
function fmtWhen(t){
  const d=new Date(t);
  try{return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' · '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}catch(e){return ''}
}
function showBoard(){
  show('board');
  const ol=$('lb'),msg=$('lbmsg');ol.textContent='';
  if(!localRuns.length){msg.textContent='No runs yet. Crash a few times and your best ten show up here.';return}
  msg.textContent='';
  const top=localRuns[0].d||1;
  localRuns.forEach((r,i)=>{
    const li=document.createElement('li');if(r.at===lastRunAt)li.className='me';
    const rk=document.createElement('span');rk.className='rk';rk.textContent=String(i+1);
    const nm=document.createElement('span');nm.className='nm2';nm.textContent=fmtWhen(r.at)+(r.at===lastRunAt?' · latest':'');
    const bar=document.createElement('i');bar.style.width=Math.max(4,Math.min(100,(r.d/top)*100))+'%';nm.appendChild(bar);
    const sc=document.createElement('span');sc.className='sc';sc.textContent=pctOf(r.d)+'%';
    const sm=document.createElement('small');sm.textContent=Math.floor(r.d).toLocaleString()+' m';sc.appendChild(sm);
    li.append(rk,nm,sc);ol.appendChild(li);
  });
}

/* ---------- input ---------- */
const MAXR=3.8;
function setTarget(x,y){const l=Math.hypot(x,y);if(l>MAXR){x*=MAXR/l;y*=MAXR/l}st.tx=x;st.ty=y}
let lastX=0,lastY=0,down=false;
canvas.addEventListener('pointerdown',e=>{down=true;lastX=e.clientX;lastY=e.clientY;try{canvas.setPointerCapture(e.pointerId)}catch(_){}});
canvas.addEventListener('pointerup',()=>{down=false});
canvas.addEventListener('pointercancel',()=>{down=false});
canvas.addEventListener('pointermove',e=>{
  if(!down||(st.mode!=='play'&&st.mode!=='tut'))return;
  const k=0.026;setTarget(st.tx+(e.clientX-lastX)*k,st.ty-(e.clientY-lastY)*k);lastX=e.clientX;lastY=e.clientY;
});
// keep iOS from pinch-zooming / rubber-banding the page
document.addEventListener('gesturestart',e=>e.preventDefault());

function resize(){
  const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
addEventListener('resize',resize);resize();

/* ---------- tutorial ---------- */
const TUT=[
 {t:'Steer',x:'Drag your finger anywhere on the screen to steer the little helicopter. Move it around.',kind:'steer'},
 {t:'Slabs are solid',x:'Fly through the open gap before the slab reaches you. This one has its gap low.',spec:{t:0,c:-1.0,ang:0.9,spin:0}},
 {t:'Bars',x:'You start inside the bar. Slide out to either side before it arrives.',spec:{t:1,w:1.5,ang:0.4,spin:0}},
 {t:'Holes',x:'Sometimes the only way through is a hole. Fly through it.',spec:{t:4,hx:2.7,hy:0,hr:2.1,ang:2.2,spin:0}},
 {t:'Spin',x:'Now the tunnel rolls and slabs spin. Ignore the walls. Watch the gap, not the tunnel.',spec:{t:0,c:-0.8,ang:0,spin:0.7},roll:true,speed:18},
 {t:'Crosses',x:'Slip into one of the four spaces between the arms. Aim for the middle of a space and hold.',spec:{t:2,w:0.9,ang:0,spin:0.55},roll:true,speed:18},
 {t:'Wedges',x:'A wedge covers most of the circle. Find the open slice and stay in it as it turns.',spec:{t:3,sw:Math.PI*1.1,ang:0,spin:0.5},roll:true,speed:20}
];
const tut={i:0,state:'',timer:0,moved:0,lx:0,ly:0,base:0,slabZ:0,speed:15,roll:false};
function capShow(h){const c=$('cap');c.innerHTML=h;c.style.opacity=1}
function capHide(){$('cap').style.opacity=0}
function tutSpawn(){
  clearSlabs();
  const s=TUT[tut.i];
  const o=buildSpec(Object.assign({},s.spec));
  live.set('tut',makeSlabFrom(o,tut.slabZ,Math.floor(tut.slabZ/(ZONE_RINGS*SP)),'tut'));
}
function tutEnter(){
  const s=TUT[tut.i];
  $('tut-n').textContent=(tut.i+1)+' / '+TUT.length;
  $('tut-t').textContent=s.t;$('tut-x').textContent=s.x;
  $('tut-barw').hidden=s.kind!=='steer';$('tut-bar').style.width='0';
  tut.roll=!!s.roll;tut.speed=s.speed||15;
  if(s.kind==='steer'){tut.state='steer';tut.moved=0;tut.lx=st.px;tut.ly=st.py}
  else{tut.state='slab';tut.base=st.dist;tut.slabZ=st.dist+58;tutSpawn()}
}
function tutStart(){
  audio.unlock();
  st.mode='tut';show('none');
  $('hud').classList.add('tutmode');$('tut').hidden=false;
  st.dist=0;st.prevDist=0;st.roll=0;st.px=st.py=st.tx=st.ty=0;st.alive=true;st.t=0;
  clearSlabs();capHide();audio.restart();hideOver();heliCrash(false);heli.spd=0;tut.i=0;tutEnter();
}
function tutNext(){
  tut.i++;
  if(tut.i>=TUT.length){
    tut.state='done';clearSlabs();capHide();$('tut').hidden=true;
    store.set('to_tut','1');$('open-tut').classList.remove('fresh');
    $('tutend').hidden=false;
  }else tutEnter();
}
function tutHit(){
  tut.state='hit';tut.timer=0.9;st.shake=1;heliCrash(true);
  $('flash').style.opacity=1;audio.hit();capShow('Hit <em>·</em> try again');
}
function tutUpdate(dt){
  if(tut.state==='steer'){
    tut.moved+=Math.hypot(st.px-tut.lx,st.py-tut.ly);tut.lx=st.px;tut.ly=st.py;
    $('tut-bar').style.width=Math.min(100,tut.moved/7*100)+'%';
    if(tut.moved>=7){tut.state='ok';tut.timer=0.9;capShow('Nice')}
  }else if(tut.state==='slab'){
    if(st.dist+HZ>tut.slabZ+0.5){tut.state='ok';tut.timer=1.0;capShow('Clean')}
  }else if(tut.state==='ok'){
    tut.timer-=dt;if(tut.timer<=0){capHide();tutNext()}
  }else if(tut.state==='hit'){
    tut.timer-=dt;
    if(tut.timer<=0){heliCrash(false);capHide();st.dist=tut.base;st.prevDist=tut.base;tut.state='slab';tutSpawn()}
  }
}

const aimEl=$('aim'),ringEl=$('ring'),arrowEl=$('arrow'),chevEl=$('chev');
function safeLocal(o){
  if(o.t===0)return[0,Math.max(-3.4,o.c-2.0)];
  if(o.t===1)return[o.w+2.0,0];
  if(o.t===2)return[o.w+1.9,o.w+1.9];
  if(o.t===3){const a=(o.sw+Math.PI*2)/2;return[Math.cos(a)*3,Math.sin(a)*3]}
  return[o.hx,o.hy];
}
const tv=new THREE.Vector3(),hv=new THREE.Vector3();
function tutAim(){
  const steer=st.mode==='tut'&&tut.state==='steer';
  camera.updateMatrixWorld();
  hv.set(st.wx,st.wy,-(st.dist+HZ)).project(camera);
  const hx=(hv.x*.5+.5)*innerWidth,hy=(-hv.y*.5+.5)*innerHeight;
  chevEl.style.left=hx+'px';chevEl.style.top=hy+'px';
  const g=live.get('tut');
  const slab=st.mode==='tut'&&tut.state==='slab'&&g;
  aimEl.hidden=!(steer||slab);
  chevEl.hidden=!steer;
  if(!slab){ringEl.hidden=true;arrowEl.toggleAttribute('hidden',true);return}
  const o=g.userData.o,z=g.userData.z,r=g.rotation.z;
  const sp=safeLocal(o);
  const tx=sp[0]*Math.cos(r)-sp[1]*Math.sin(r),ty=sp[0]*Math.sin(r)+sp[1]*Math.cos(r);
  const a=-r,ca=Math.cos(a),sa=Math.sin(a);
  const lx=st.wx*ca-st.wy*sa,ly=st.wx*sa+st.wy*ca;
  const safe=!slabInside(o,lx,ly,0.9);
  const ex=tx-st.wx,ey=ty-st.wy,cr=Math.cos(st.roll),sr=Math.sin(st.roll);
  const sx=ex*cr+ey*sr,sy=-(-ex*sr+ey*cr);
  const len=Math.hypot(sx,sy)||1;
  const W=innerWidth,Hh=innerHeight,cx=hx,cy=hy;
  if(safe||z-(st.dist+HZ)<1.5){arrowEl.toggleAttribute('hidden',true)}
  else{
    const rad=64+Math.min(len,4)*9,ux=sx/len,uy=sy/len;
    arrowEl.toggleAttribute('hidden',false);
    arrowEl.style.transform='translate('+(cx+ux*rad)+'px,'+(cy+uy*rad)+'px) rotate('+Math.atan2(uy,ux)+'rad)';
  }
  camera.updateMatrixWorld();
  tv.set(tx,ty,-z).project(camera);
  if(tv.z>1||z-(st.dist+HZ)<2){ringEl.hidden=true}
  else{
    ringEl.hidden=false;
    const px=Math.max(30,Math.min(W-30,(tv.x*.5+.5)*W)),py=Math.max(90,Math.min(Hh-30,(-tv.y*.5+.5)*Hh));
    ringEl.style.transform='translate('+px+'px,'+py+'px)';
    ringEl.classList.toggle('ok',safe);
  }
}

/* ---------- 3D helicopter: chase view from behind, nose into the tunnel, tail toward the player ---------- */
const HZ=3.6, CAMY=0.95;
let heliTail,heliRotor;
const heliG=new THREE.Group();heliG.rotation.order='YXZ';heliG.visible=false;
const heliRoot=new THREE.Group();heliRoot.scale.setScalar(0.27);heliG.add(heliRoot);
const HM={
  body:new THREE.MeshLambertMaterial({color:0xe9e7f4,emissive:0x6d6a80}),
  dark:new THREE.MeshLambertMaterial({color:0x2b2840,emissive:0x1a1830}),
  white:new THREE.MeshBasicMaterial({color:0xffffff}),
  acc:new THREE.MeshBasicMaterial({color:0xa8d400})
};
function hmesh(geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x||0,y||0,z||0);heliRoot.add(m);return m}
(function buildHeli(){
  const body=hmesh(new THREE.SphereGeometry(1,16,12),HM.body);body.scale.set(0.62,0.55,1.0);
  const glass=hmesh(new THREE.SphereGeometry(0.62,14,10),HM.acc,0,0.1,-0.62);glass.scale.set(0.95,0.8,0.9);
  const boom=hmesh(new THREE.CylinderGeometry(0.13,0.2,2.6,8),HM.body,0,0.05,2.1);boom.rotation.x=Math.PI/2;
  hmesh(new THREE.BoxGeometry(0.08,0.9,0.7),HM.body,0,0.4,3.1);
  hmesh(new THREE.BoxGeometry(1.0,0.07,0.4),HM.body,0,0.1,2.7);
  hmesh(new THREE.CylinderGeometry(0.08,0.08,0.45,8),HM.dark,0,0.72,0);
  hmesh(new THREE.BoxGeometry(0.5,0.12,0.3),HM.acc,0,0.2,1.0);
  for(const sx of[-1,1]){
    const sk=hmesh(new THREE.CylinderGeometry(0.06,0.06,2.3,6),HM.white,sx*0.72,-0.98,0);sk.rotation.x=Math.PI/2;
    for(const sz of[-0.55,0.55]){const st_=hmesh(new THREE.BoxGeometry(0.07,0.55,0.07),HM.white,sx*0.66,-0.7,sz);st_.rotation.z=-sx*0.18}
  }
  // tail rotor (spins about X)
  heliTail=new THREE.Group();heliTail.position.set(0.2,0.35,3.2);heliRoot.add(heliTail);
  for(const [w,h] of [[0.05,0.95],[0.05,0.14]]){const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,w===0.05&&h===0.14?0.95:0.14),HM.white);heliTail.add(b)}
  // main rotor (spins about Y), with fading ghost blades for motion blur
  heliRotor=new THREE.Group();heliRotor.position.y=0.95;heliRoot.add(heliRotor);
  const mk=(op)=>new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:op,depthWrite:false});
  [[-0.9,0.1],[-0.55,0.2],[-0.25,0.38]].forEach(([a,op])=>{
    const g=new THREE.Group();g.rotation.y=a;
    const m=mk(op);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(4.4,0.04,0.2),m),new THREE.Mesh(new THREE.BoxGeometry(0.2,0.04,4.4),m));
    heliRotor.add(g);
  });
  const disc=new THREE.Mesh(new THREE.CircleGeometry(2.25,32),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.09,depthWrite:false,side:THREE.DoubleSide}));
  disc.rotation.x=-Math.PI/2;heliRotor.add(disc);
  heliRotor.add(new THREE.Mesh(new THREE.BoxGeometry(4.4,0.06,0.2),HM.white),new THREE.Mesh(new THREE.BoxGeometry(0.2,0.06,4.4),HM.white));
  for(const sx of[-1,1]){
    const t1=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.07,0.21),HM.acc);t1.position.x=sx*1.7;heliRotor.add(t1);
    const t2=new THREE.Mesh(new THREE.BoxGeometry(0.21,0.07,0.8),HM.acc);t2.position.z=sx*1.7;heliRotor.add(t2);
  }
  hmesh(new THREE.CylinderGeometry(0.14,0.14,0.14,8),HM.dark,0,0.95,0);
})();
const heliBase=new THREE.Group();scene.add(heliBase);heliBase.add(heliG);scene.add(camera);
const heli={rot:0,trot:0,spd:0,yaw:0,pitch:0,roll:0,bob:0,crash:false,crashT:0,lpx:0};
function heliCrash(on){heli.crash=on;if(!on){heli.crashT=0;heliRoot.rotation.set(0,0,0);heliRoot.scale.setScalar(0.27);heliRoot.position.set(0,0,0)}}
function heliTargetSlab(){
  let best=null;
  live.forEach(g=>{const z=g.userData.z;if(z>st.dist+HZ-0.1&&(!best||z<best.userData.z))best=g});
  return best;
}
function heliUpdate(dt,wx,wy,cr,sr){
  const flying=!heli.crash&&(st.mode==='menu'||(st.mode==='tut'?tut.state!=='hit':st.alive));
  heli.spd+=((flying?1:0)-heli.spd)*(1-Math.exp(-(flying?3:1.6)*dt));
  heli.rot+=heli.spd*26*dt;heli.trot+=heli.spd*40*dt;
  heliRotor.rotation.y=heli.rot;heliTail.rotation.x=heli.trot;
  // where should the nose point? at the safe spot of the next slab
  let ty=0,tp=0;
  const g=flying?heliTargetSlab():null;
  if(g&&!(st.mode==='tut'&&tut.state!=='slab')){
    const o=g.userData.o,z=g.userData.z,r=g.rotation.z,sp=safeLocal(o);
    const tx=sp[0]*Math.cos(r)-sp[1]*Math.sin(r),tyy=sp[0]*Math.sin(r)+sp[1]*Math.cos(r);
    const ex=tx-wx,ey=tyy-wy;
    const elx=ex*cr+ey*sr,ely=-ex*sr+ey*cr;
    const dz=Math.max(6,z-(st.dist+HZ));
    ty=-Math.atan(elx/dz)*2.4;tp=Math.atan(ely/dz)*2.0;
  }
  const clamp=(v,a)=>Math.max(-a,Math.min(a,v));
  ty=clamp(ty,0.7);tp=clamp(tp,0.5);
  const vx=dt>0?(st.px-heli.lpx)/dt:0;heli.lpx=st.px;
  const wantRoll=clamp(ty*0.9-vx*0.02,0.75);
  const k=1-Math.exp(-7*dt);
  heli.yaw+=(ty-heli.yaw)*k;heli.pitch+=(tp-heli.pitch)*k;heli.roll+=(wantRoll-heli.roll)*k;
  heli.bob+=dt;
  if(heli.crash){
    heli.crashT+=dt;const c=Math.min(1,heli.crashT/0.7);
    heliRoot.rotation.y+=16*dt;heliRoot.rotation.z+=7*dt;
    heliRoot.position.y=-c*c*1.6;heliRoot.position.z=0.7+c*1.4;
    heliRoot.scale.setScalar(0.27*(1-0.8*c));
  }
  heliG.rotation.set(heli.pitch,heli.yaw,heli.roll);
  heliG.position.y=Math.sin(heli.bob*7)*0.03*heli.spd;
}

/* chase camera: sits behind and above the helicopter and looks along the tunnel's heading */
function placeCamera(wx,wy,roll,shx,shy,shr,camY){
  if(camY===undefined)camY=CAMY;
  const hz=st.dist+HZ,c0=C(hz),c1=C(hz+10),c2=C(hz-10);
  const slx=(c1[0]-c2[0])/20,sly=(c1[1]-c2[1])/20;
  const cr=Math.cos(roll),sr=Math.sin(roll);
  const hx=c0[0]+wx,hy=c0[1]+wy;
  camera.position.set(hx-sr*camY+shx,hy+cr*camY+shy,-st.dist);
  camera.up.set(-Math.sin(roll+shr),Math.cos(roll+shr),0);
  camera.lookAt(camera.position.x+slx*25,camera.position.y+sly*25,camera.position.z-25);
  heliBase.position.set(hx,hy,-hz);heliBase.quaternion.copy(camera.quaternion);
}

/* ---------- loop ---------- */
const BPMHZ=150/60/2;
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.max(0,Math.min(0.05,(now-last)/1000));last=now;
  if(st.mode==='menu'){
    // attract mode: cruise through the tunnel, no slabs
    st.demo+=dt;const dd=34*dt;st.dist+=dd;
    const zone=Math.floor(st.dist/(ZONE_RINGS*SP));
    st.roll+=(Math.sin(st.dist*0.011)*0.7+Math.sin(st.dist*0.0307)*0.35)*dt;
    const pulse=Math.pow(Math.max(0,1-((st.demo*BPMHZ)%1)),3);
    updateTunnel(st.dist,pulse,zone);setTheme(zone);
    placeCamera(0,0,st.roll,0,0,0,0.5);
    if(!$('menu').hidden){
      heliUpdate(dt,0,0,Math.cos(st.roll),Math.sin(st.roll));
      heliG.rotation.set(0.12+Math.sin(st.demo*1.3)*0.05,Math.sin(st.demo*0.8)*0.32,Math.sin(st.demo*1.1)*0.22);
    }
    camera.fov=82+pulse*4;camera.updateProjectionMatrix();
    headlamp.position.copy(camera.position);headlamp.position.z-=2;
    renderer.render(scene,camera);return;
  }
  st.t+=dt;
  const tutm=st.mode==='tut';
  const zone=Math.floor(st.dist/(ZONE_RINGS*SP));
  if(st.alive){
    st.speed=tutm?(tut.state==='hit'?0:tut.speed):runSpeed(st.dist);
    st.prevDist=st.dist;st.dist+=st.speed*dt;
    const rv=tutm?(tut.roll?Math.sin(st.dist*0.011)*0.5+Math.sin(st.dist*0.0307)*0.35:0):Math.min(1,0.2+st.dist/2200)*(Math.sin(st.dist*0.011)*0.75+Math.sin(st.dist*0.0307)*0.35);
    st.roll+=rv*dt;
    const k=1-Math.exp(-20*dt);st.px+=(st.tx-st.px)*k;st.py+=(st.ty-st.py)*k;
  }else{
    st.dead+=dt;
    if(st.dead>0.55&&$('over').hidden)showOver();
  }
  const c=Math.cos(st.roll),s=Math.sin(st.roll);
  const wx=st.px*c-st.py*s, wy=st.px*s+st.py*c;
  st.wx=wx;st.wy=wy;
  const pulse=Math.pow(Math.max(0,1-((st.t*BPMHZ)%1)),3);
  if(tutm)tutUpdate(dt);

  if(!tutm){
    const ahead=st.dist+118;
    let n0=0;while(zOf(n0)<st.dist-6)n0++;
    for(let n=n0;zOf(n)<ahead;n++){if(!live.has(n))live.set(n,makeSlab(n))}
  }
  live.forEach((g,key)=>{
    const zz=g.userData.z,o=g.userData.o;
    if(zz<st.dist-8){scene.remove(g);g.userData.geo.dispose();live.delete(key);return}
    g.rotation.z=o.ang+o.spin*st.t;
    // hit test only on the frame the camera crosses the slab plane
    if(st.alive&&st.prevDist+HZ<zz&&st.dist+HZ>=zz){
      const a=-g.rotation.z,ca=Math.cos(a),sa=Math.sin(a);
      const lx=wx*ca-wy*sa,ly=wx*sa+wy*ca;
      if(slabInside(o,lx,ly,0.2)){if(tutm)tutHit();else die()}
    }
  });

  if(!st.won&&st.dist>=GOAL&&st.alive){
    st.won=true;const cap=$('cap');cap.innerHTML='100% <em>·</em> you did it';cap.style.opacity=1;
    setTimeout(()=>{if(st.alive)cap.style.opacity=0},2500);
    if(GOAL>bestDist){bestDist=GOAL;store.set('to_bestd',bestDist)}
  }

  updateTunnel(st.dist,pulse,zone);
  const shake=st.shake;st.shake=Math.max(0,st.shake-dt*2.2);
  placeCamera(wx,wy,st.roll,(Math.random()-.5)*shake*.8,(Math.random()-.5)*shake*.8,(Math.random()-.5)*shake*.1);
  camera.fov=82+pulse*5+Math.min(16,(st.speed-12)*.2);camera.updateProjectionMatrix();
  headlamp.position.copy(camera.position);headlamp.position.z-=2;
  $('barf').style.width=Math.min(100,st.dist/GOAL*100)+'%';$('zone').textContent=zone+1;
  $('best').textContent=pctOf(Math.max(bestDist,st.dist));
  const f=$('flash');const fo=parseFloat(f.style.opacity)||0;if(fo>0)f.style.opacity=Math.max(0,fo-dt*3.2);
  if(tutm)tutAim();else if(!aimEl.hidden)aimEl.hidden=true;
  setTheme(zone);
  heliUpdate(dt,wx,wy,c,s);
  renderer.render(scene,camera);
}

/* ---------- wire up ---------- */
$('play').addEventListener('click',begin);
$('open-board').addEventListener('click',showBoard);
$('board-back').addEventListener('click',()=>show('menu'));
$('open-tut').addEventListener('click',tutStart);
$('te-play').addEventListener('click',begin);
$('te-again').addEventListener('click',()=>{$('tutend').hidden=true;tutStart()});
$('te-menu').addEventListener('click',toMenu);
if(store.get('to_tut','')!=='1')$('open-tut').classList.add('fresh');
$('over-retry').addEventListener('click',e=>{e.currentTarget.blur();retry()});
$('over-home').addEventListener('click',homeFromOver);
$('mute').addEventListener('click',e=>{audio.unlock();const on=audio.toggle();const b=e.currentTarget;b.textContent=on?'🔊':'🔇';b.setAttribute('aria-label',on?'Sound on':'Sound off')});

document.addEventListener('pointerdown',()=>audio.unlock(),{once:true});
setTheme(0);refreshMenu();show('menu');
requestAnimationFrame(frame);
})();
