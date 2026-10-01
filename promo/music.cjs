// Original instrumental: 150 BPM, drums, syncopated bass, arpeggio, pads and edit whooshes.
const fs=require('node:fs');
module.exports=function writeMusic(dest,duration,scenes){
 const rate=48000,n=Math.round(duration*rate),left=new Float32Array(n),right=new Float32Array(n),beat=.4;
 let seed=14585;const noise=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/2147483648-1};
 const hz=m=>440*Math.pow(2,(m-69)/12);const roots=[38,34,41,36];
 for(let i=0;i<n;i++){
 const t=i/rate,b=Math.floor(t/beat),pos=t%beat,step=Math.floor(t/.1),sp=t%.1,bar=Math.floor(b/4),root=roots[Math.floor(bar/2)%4];
 const tail=Math.min(1,(duration-t)/.45),drop=t>=1.6?1:.6;
 // Punchy kick with a descending pitch envelope, on each quarter note.
 const kick=Math.sin(2*Math.PI*(49*pos+95*.019*(1-Math.exp(-pos/.019))))*Math.exp(-pos*18)*.63;
 const no=noise(),snare=(b%2===1)?(no*.19*Math.exp(-pos*27)+Math.sin(2*Math.PI*185*pos)*.14*Math.exp(-pos*24)):0;
 const hatAge=t%.2,hat=no*(.035*Math.exp(-hatAge*105)+((step%4===2)? .024*Math.exp(-sp*34):0));
 const bp=t%.2,gate=Math.min(1,bp/.004)*Math.exp(-bp*11),freq=hz(root+([0,0,12,0,0,7,0,12][Math.floor(t/.2)%8]));
 const phase=2*Math.PI*freq*t,bass=(Math.sin(phase)+.28*Math.sin(2*phase)+.13*Math.sin(3*phase))*.16*gate*drop;
 const note=hz(root+24+[0,7,12,15,12,7,10,7][Math.floor(t/.2)%8]);
 const lead=(Math.sin(2*Math.PI*note*t)+.25*Math.sin(2*Math.PI*note*2*t))*.055*Math.exp(-bp*15)*drop;
 const side=.35+.65*(1-Math.exp(-pos*16));let pad=0;for(const off of [0,3,7])pad+=Math.sin(2*Math.PI*hz(root+12+off)*t)*.012*side;
 const pan=Math.sin(t*2.4)*.45,drums=kick+snare+hat;
 left[i]=(drums+bass+pad+lead*(1-pan))*tail;right[i]=(drums+bass+pad+lead*(1+pan))*tail;
 }
 // Band-limited sounding sweep bursts at edit points, with gentle impact transients.
 for(const sc of scenes){const start=sc.start;for(let j=0;j<rate*.2;j++){const idx=Math.round((start-.12)*rate)+j;if(idx<0||idx>=n)continue;const x=j/(rate*.2),env=Math.sin(Math.PI*x)**2;const v=noise()*.085*env;left[idx]+=v*(1-x);right[idx]+=v*x}}
 // Stereo eighth-note delay on the tonal material, kept below the drums.
 const delay=Math.round(.3*rate);for(let i=n-1;i>=delay;i--){left[i]+=right[i-delay]*.075;right[i]+=left[i-delay]*.075}
 const pcm=Buffer.alloc(n*4);for(let i=0;i<n;i++){pcm.writeInt16LE(Math.round(Math.tanh(left[i]*1.35)*29000),i*4);pcm.writeInt16LE(Math.round(Math.tanh(right[i]*1.35)*29000),i*4+2)}
 const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+pcm.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(2,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*4,28);h.writeUInt16LE(4,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);fs.writeFileSync(dest,Buffer.concat([h,pcm]));
};
