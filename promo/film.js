/* Deterministic, beat-synced motion design. One beat = 0.4s (150 BPM). */
const canvas=document.querySelector('canvas'),output=canvas.getContext('2d');
const stage=document.createElement('canvas');stage.width=720;stage.height=1280;const g=stage.getContext('2d');
const W=720,H=1280,ink='#10271d',green='#204c35',lime='#dcf66c',cream='#f6f4e8',orange='#ff7949';
const mainEdit=[
[2,'slam','READY?','zoom'],[2,'slam','PLAY.','hard'],[4,'action','BRING YOUR GAME.','split'],
[4,'brand','','whip'],[4,'stat','6|COURTS','zoom'],[4,'stat','5|CATEGORIES','hard'],
[4,'slam','FANS.\nYOU’RE IN.','diagonal'],[6,'predict','','whip'],[4,'react','','split'],[4,'challenge','','zoom'],
[4,'premium','','diagonal'],[6,'assess','','split'],[4,'slam','BRANDS.\nSTEP IN.','whip'],
[4,'partner','FAN|ENGAGEMENT','diagonal'],[4,'partner','PREMIUM|ASSESSMENTS','split'],[4,'back','','zoom'],
[4,'date','','whip'],[4,'event','','split'],[8,'end','','diagonal']];
const sponsorEdit=[
[4,'brand','','zoom'],[4,'slam','YOUR BRAND.\nIN THE GAME.','whip'],[6,'predict','','split'],[4,'challenge','','zoom'],
[4,'premium','','diagonal'],[6,'assess','','split'],[6,'partners','','whip'],[4,'back','','zoom'],
[4,'date','','diagonal'],[6,'event','','split'],[12,'end','','whip']];
function timeline(edit){let cursor=0;return edit.map(([beats,type,copy,transition])=>{const s={start:cursor,end:cursor+beats*.4,type,copy,transition};cursor=s.end;return s})}
const timelines={main:timeline(mainEdit),sponsor:timeline(sponsorEdit)};
const photo=new Image();photo.src='../assets/images/manvir-1.jpg';window.ready=photo.decode();
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>1-Math.pow(1-clamp(x),4);
function box(x,y,w,h,c){g.fillStyle=c;g.fillRect(x,y,w,h)}
function type(text,x,y,size=70,color=cream,max=620,align='left',weight=900){g.fillStyle=color;g.textAlign=align;g.font=`${weight} ${size}px Arial`;const width=g.measureText(text).width;if(width>max)g.font=`${weight} ${size*max/width}px Arial`;g.fillText(text,x,y)}
function headline(rows,y=390,size=110,color=cream){rows.forEach((s,i)=>type(s,48,y+i*size*1.02,size,color))}
function small(s,y=210,c=lime){type(s,48,y,20,c,620,'left',600)}
function photoFill(x,y,w,h,z=1,dx=0){g.save();g.beginPath();g.rect(x,y,w,h);g.clip();const k=Math.max(w/photo.width,h/photo.height)*z;g.drawImage(photo,x+(w-photo.width*k)/2+dx,y+(h-photo.height*k)/2,photo.width*k,photo.height*k);g.restore()}
function ball(x,y,r){g.save();g.translate(x,y);g.rotate(x/130);g.fillStyle=lime;g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.fill();g.strokeStyle=ink;g.lineWidth=Math.max(2,r*.026);for(const a of [-1,1]){g.beginPath();g.ellipse(a*r*.95,0,r*.6,r*.95,0,0,Math.PI*2);g.stroke()}g.restore()}
function court(t,col='#d5e79422'){g.save();g.translate(360,740);g.rotate(-.3+t*.015);g.scale(1.25,1.25);g.strokeStyle=col;g.lineWidth=2;g.strokeRect(-255,-450,510,900);g.strokeRect(-195,-450,390,900);g.strokeRect(-195,-230,390,460);g.beginPath();g.moveTo(-255,0);g.lineTo(255,0);g.moveTo(0,-230);g.lineTo(0,230);g.stroke();g.restore()}
function footer(s='RUBSTA OPEN  /  24–25 OCTOBER'){type(s,48,1167,17,cream,624,'left',600)}
function badge(s,y=1000){box(48,y,624,58,lime);type(s,68,y+38,23,ink,585)}
function preview(){type('EXPERIENCE PREVIEW',48,1119,13,'#b7c5b0',620,'left',500)}
function renderScene(sc,t,index){let p=Math.max(0,t-sc.start),q=p/(sc.end-sc.start),beat=t/.4,hit=Math.exp(-(beat%1)*9);box(0,0,W,H,ink);court(t);g.save();const z=1+.018*q;g.translate(360,640);g.scale(z,z);g.translate(-360,-640);
switch(sc.type){
case 'slam':{const isFirst=index<2;box(0,0,W,H,isFirst?lime:ink);court(t,isFirst?'#10271d33':'#dcf66c33');let rows=sc.copy.split('\n');g.save();g.translate(360,640);g.rotate(-.06);let zoom=1+.18*(1-ease(p/.19));g.scale(zoom,zoom);g.translate(-360,-640);rows.forEach((s,i)=>type(s,360,590+i*145,rows.length>1?100:160,isFirst?ink:cream,640,'center'));g.restore();box(48,820,180+420*ease(p/.35),12,isFirst?ink:orange);small('RUBSTA OPEN / EVERYONE’S IN',220,isFirst?ink:lime);type('COMPETE. CONNECT. GET INVOLVED.',48,1010,21,isFirst?ink:cream,620);break}
case 'action':photoFill(0,0,W,H,1.15+q*.18,-q*35);box(0,0,W,H,'#08201755');box(0,880,W,400,'#10271ddd');headline(['BRING','YOUR GAME.'],946,95);small('THE RUBSTA OPEN EXPERIENCE',220);type('MANVIR / TENNIS ARCHIVE',48,1115,13,cream);break;
case 'brand':box(0,0,W,H,lime);court(t,'#10271d44');ball(590-150*q,825,170);type('Rubsta',42,520,146,ink,640,'left',700);type('OPEN',42,667,160,ink);box(48,736,420,10,ink);type('EVERYONE’S IN THE GAME.',48,990,32,ink);type('POWERED BY FORGELABS',48,1050,18,ink);break;
case 'stat':{let [n,word]=sc.copy.split('|');type(n,40,775,560,lime);type(word,48,940,82,cream);small('TWO DAYS. ALL IN.',230);for(let i=0;i<6;i++)box(460+i*28,380,12,Math.max(30,380-i*38+hit*20),orange);break}
case 'predict':small('FAN ENGAGEMENT',210);headline(['CALL THE','NEXT POINT.'],340,92);box(48,585,624,348,cream);type('YOUR PICK?',76,642,24,ink);['PLAYER A','PLAYER B'].forEach((v,i)=>{box(76+i*298,685,272,123,i===0&&p>.4?lime:'#dfe4d4');type(v,91+i*298,758,30,ink,245)});type(p>.4?'PREDICTION LOCKED  ✓':'MAKE YOUR PREDICTION',76,880,24,ink);for(let i=0;i<4;i++)box(48+i*158,980,140,6,i<=Math.floor(p/.4)%4?lime:green);preview();break;
case 'react':small('FAN ENGAGEMENT',210);headline(['FEEL IT.','SHOW IT.'],370,113);['GREAT SHOT!','LET’S GO!','WHAT A RALLY!'].forEach((s,i)=>{g.save();g.translate((1-ease((p-i*.13)/.22))*(i%2?720:-720),0);g.translate(360,660+i*136);g.rotate(i%2?.045:-.04);box(-310,-58,620,105,i===1?orange:lime);type(s,0,12,54,ink,580,'center');g.restore()});preview();break;
case 'challenge':small('FAN CHALLENGES',210);headline(['TAKE THE','CHALLENGE.'],350,101);for(let i=0;i<3;i++){let y=625+i*135;box(48,y,624,104,i===0?lime:green);type(['JOIN IN','GET INVOLVED','MAKE YOUR MARK'][i],76,y+65,37,i===0?ink:cream);type('↗',630,y+65,47,i===0?ink:lime,100,'right')}preview();break;
case 'premium':g.save();g.beginPath();g.moveTo(0,0);g.lineTo(720,0);g.lineTo(720,830);g.lineTo(0,1050);g.closePath();g.clip();photoFill(0,0,720,1000,1.2+q*.12);box(0,0,720,1000,'#10271d66');g.restore();box(0,760,720,400,ink);small('FOR THE PLAYERS',225);headline(['PREMIUM','ASSESSMENTS.'],875,84);box(48,1062,320,8,orange);break;
case 'assess':small('PREMIUM ASSESSMENTS',210);headline(['KNOW','YOUR GAME.'],348,107);['EXPLORE YOUR STRENGTHS','FIND YOUR NEXT FOCUS'].forEach((s,i)=>{const y=651+i*183;box(48,y,624,145,i===0?lime:cream);type('0'+(i+1),73,y+42,22,ink);type(s,73,y+101,34,ink,567);box(48,y+149,624*ease((p-i*.3)/.5),5,orange)});preview();break;
case 'partner':{let rows=sc.copy.split('|');small('PARTNERSHIP OPPORTUNITIES',210);headline(rows,360,85);g.save();g.translate(360,805);g.rotate(-.055+.02*q);box(-312,-190,624,345,lime);type('YOUR',-278,-70,93,ink);type('BRAND HERE.',-278,31,79,ink,570);type('BE PART OF THE EXPERIENCE  ↗',-278,106,22,ink);g.restore();type('ILLUSTRATIVE PARTNER PLACEMENT',48,1100,14,'#b7c5b0');break}
case 'partners':small('PARTNERSHIP OPPORTUNITIES',210);headline(['GET YOUR','BRAND IN.'],360,105);['FAN ENGAGEMENT','PREMIUM ASSESSMENTS','PLAYER SUPPORT'].forEach((s,i)=>{let y=640+i*139;box(48,y,624,108,i===1?orange:lime);type(s,70,y+67,35,ink,577)});type('ILLUSTRATIVE PARTNERSHIP OPPORTUNITIES',48,1110,13,'#b7c5b0');break;
case 'back':photoFill(0,0,720,1280,1.08+q*.1);box(0,0,720,1280,'#10271d99');small('BE PART OF THEIR JOURNEY',215);headline(['BACK','A PLAYER.'],680,120);badge('SPONSOR A PLAYER  ↗',965);break;
case 'date':box(0,0,W,H,orange);court(t,'#10271d33');small('SAVE THE WEEKEND',230,ink);headline(['24—25','OCTOBER'],540,137,ink);type('2026',48,838,100,ink);type('TWO DAYS. EVERYONE IN.',48,1050,27,ink);break;
case 'event':small('RUBSTA OPEN',210);headline(['6 COURTS.','5 CATEGORIES.','ONE COMMUNITY.'],430,79);badge('24–25 OCTOBER 2026',890);type('VAZIRANI NATIONAL',48,1010,28,cream);type('SPORTS ACADEMY',48,1050,28,cream);break;
case 'end':small('EVERYONE’S IN THE GAME.',210);type('Rubsta',43,432,137,cream,628,'left',700);type('OPEN',43,584,160,lime);box(48,635,624,6,orange);type('24–25 OCTOBER 2026',48,724,34,cream);type('VAZIRANI NATIONAL',48,790,24,cream);type('SPORTS ACADEMY',48,825,24,cream);badge('BECOME A SPONSOR  ↗',910);type('rubstaopen.com',48,1050,49,cream);type('POWERED BY FORGELABS',48,1109,17,'#b7c5b0');break;
}g.restore();if(!['slam','brand','date'].includes(sc.type))footer();}
window.renderFrame=function(t){t=Math.max(0,Math.min(t,window.duration-.001));const scenes=window.scenes,index=scenes.findIndex(s=>t>=s.start&&t<s.end),sc=scenes[Math.max(0,index)],p=t-sc.start;output.fillStyle=ink;output.fillRect(0,0,W,H);const len=.18;
if(index>0&&p<len&&sc.transition!=='hard'&&sc.transition!=='zoom'){
renderScene(scenes[index-1],sc.start-.001,index-1);output.drawImage(stage,0,0);renderScene(sc,t,index);const a=ease(p/len);output.save();if(sc.transition==='whip'){output.translate(W*(1-a),0);output.drawImage(stage,0,0)}else if(sc.transition==='split'){for(let j=0;j<4;j++){output.save();output.beginPath();output.rect(0,j*320,720,320);output.clip();output.drawImage(stage,(j%2?1:-1)*W*(1-a),0);output.restore()}}else{output.beginPath();output.moveTo(-H,0);output.lineTo((W+H)*a-H,0);output.lineTo((W+H)*a,H);output.lineTo(-H,H);output.clip();output.drawImage(stage,0,0)}output.restore();
}else{renderScene(sc,t,index);output.save();if(sc.transition==='zoom'&&p<.18){const z=1+.23*(1-ease(p/.18));output.translate(360,640);output.scale(z,z);output.translate(-360,-640)}output.drawImage(stage,0,0);output.restore()}
// A small fixed brand bug remains readable through the fast edits.
output.fillStyle=ink;output.fillRect(36,92,264,39);output.fillStyle=cream;output.font='bold 16px Arial';output.fillText('RUBSTA OPEN / FORGELABS',48,118);
};
const params=new URLSearchParams(location.search);if(params.has('render'))document.body.classList.add('render');
window.setCut=function(v){window.cut=v;window.scenes=timelines[v];window.duration=window.scenes.at(-1).end;document.querySelector('#scrub').max=window.duration;document.querySelector('#download').href=`exports/rubsta-open-${v}.mp4`;};
window.setCut(params.get('cut')==='sponsor'?'sponsor':'main');let playing=false,at=0;const sound=new Audio(`exports/${window.cut}-audio.wav`);
function seek(t){at=Math.min(t,window.duration);sound.currentTime=at;window.renderFrame(at)}
document.querySelector('#play').onclick=async()=>{if(playing){sound.pause();playing=false}else{if(at>=window.duration-.05)seek(0);try{await sound.play();playing=true}catch(e){document.querySelector('#time').textContent='Music unavailable — serve the project over HTTP.'}}};
document.querySelector('#restart').onclick=()=>seek(0);document.querySelector('#scrub').oninput=e=>seek(+e.target.value);for(const v of ['main','sponsor'])document.querySelector('#'+v+'Cut').onclick=()=>{playing=false;sound.pause();window.setCut(v);sound.src=`exports/${v}-audio.wav`;seek(0)};
sound.onended=()=>{playing=false;at=window.duration};const clock=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
function loop(){if(playing)at=sound.currentTime;if(!params.has('render')){window.renderFrame(at);document.querySelector('#scrub').value=at;document.querySelector('#time').textContent=`${clock(at)} / ${clock(window.duration)}`}requestAnimationFrame(loop)}window.ready.then(()=>{window.renderFrame(0);requestAnimationFrame(loop)});
