// Rebuild the music-only, beat-synced MP4s with local Chromium and FFmpeg.
const {chromium}=require('../web/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {spawn,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'exports');
const mime={'.html':'text/html','.js':'text/javascript','.jpg':'image/jpeg','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(p,(err,data)=>{if(err)res.writeHead(404).end();else{res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');res.end(data)}})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:720,height:1280},deviceScaleFactor:1});page.on('pageerror',e=>{throw e});await page.goto(`http://127.0.0.1:${server.address().port}/promo/index.html?render=1`);await page.evaluate(()=>window.ready);
for(const cut of (process.argv.includes('--main-only')?['main']:['main','sponsor'])){
 await page.evaluate(v=>window.setCut(v),cut);const scenes=await page.evaluate(()=>window.scenes);const duration=Math.round(scenes.at(-1).end*1000)/1000;
 const aud=path.join(out,`${cut}-audio.wav`),rawMusic=path.join(out,`${cut}-music-source.wav`);
 require('./music.cjs')(rawMusic,duration,scenes);
 execFileSync('ffmpeg',['-v','error','-y','-i',rawMusic,'-af','loudnorm=I=-14:TP=-1:LRA=8','-ar','48000',aud]);fs.unlinkSync(rawMusic);
 fs.writeFileSync(path.join(out,`${cut}-script.txt`),scenes.map(s=>`${s.start.toFixed(1)}–${s.end.toFixed(1)}s | ${s.type} | ${s.copy.replace(/\n/g,' / ')} | ${s.transition}`).join('\n'));
 const dest=path.join(out,`rubsta-open-${cut}.mp4`);const ff=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate','30','-vcodec','mjpeg','-i','pipe:0','-i',aud,'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-shortest',dest]);let errors='';ff.stderr.on('data',x=>errors+=x);const done=new Promise((resolve,reject)=>{ff.on('error',reject);ff.on('close',code=>code?reject(Error(errors)):resolve())});
 for(let frame=0;frame<duration*30;frame++){const b64=await page.evaluate(t=>{window.renderFrame(t);return document.querySelector('canvas').toDataURL('image/jpeg',.94).split(',')[1]},frame/30);if(!ff.stdin.write(Buffer.from(b64,'base64')))await new Promise(r=>ff.stdin.once('drain',r));if(frame%300===0)process.stdout.write(`${cut}: ${frame/30}/${duration}s\n`)}ff.stdin.end();await done;
 for(const t of (cut==='main'?[0.3,2.2,6,10,13.5,16.5,18,23,25,30]:[3,10,14,21])){await page.evaluate(t=>window.renderFrame(t),t);await page.screenshot({path:path.join(out,`${cut}-energetic-${t}s.jpg`),type:'jpeg',quality:85})}console.log('Exported '+dest);
}
await browser.close();server.close();})().catch(e=>{console.error(e);server.close();process.exit(1)});
