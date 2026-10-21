import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9231', '--user-data-dir=' + resolve('.preview-browser'), '--no-first-run', '--no-default-browser-check', '--window-size=1440,960', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let socket;
try {
  let pages;
  for (let i = 0; i < 40; i++) { try { pages = await (await fetch('http://127.0.0.1:9231/json')).json(); break; } catch { await sleep(250); } }
  const page = pages.find(p => p.type === 'page');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => socket.addEventListener('open', r, { once: true }));
  let serial = 0; const pending = new Map(), errors = [];
  socket.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, {resolve,reject}); socket.send(JSON.stringify({id,method,params})); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {width:1440,height:960,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate', {url:'http://127.0.0.1:5173/market.html?phase=morning'});
  let ready = false;
  for (let i = 0; i < 100; i++) {
    const r = await send('Runtime.evaluate', {expression:"document.getElementById('marketLoading')?.classList.contains('is-done')",returnByValue:true});
    if (r.result.value) {ready=true;break;} if(errors.length)break; await sleep(300);
  }
  await sleep(1000);
  let shot = await send('Page.captureScreenshot', {format:'png'});
  await writeFile('previews/markets/morning-third-person.png', Buffer.from(shot.data,'base64'));
  if (ready) {
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:900,y:500,button:'left',clickCount:1});
    for(let i=1;i<=15;i++){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:900+i*12,y:500,button:'left',buttons:1});await sleep(16);}
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:1080,y:500,button:'left',clickCount:1});
    await sleep(1000);
    shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('previews/markets/morning-orbit.png',Buffer.from(shot.data,'base64'));
    const focused=await send('Runtime.evaluate',{expression:"document.body.classList.contains('is-focused')",returnByValue:true});
    if(focused.result.value)errors.push('Orbit drag opened a shop');
    // Reload to test the default entry pose, even when an old overview URL is used.
    await send('Page.navigate',{url:'http://127.0.0.1:5173/market.html?phase=morning&view=overview'});
    for(let i=0;i<100;i++){
      const r=await send('Runtime.evaluate',{expression:"document.getElementById('marketLoading')?.classList.contains('is-done')",returnByValue:true});
      if(r.result.value)break;await sleep(300);
    }
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW'});
    let visitAvailable=false;
    for(let i=0;i<50;i++){
      await sleep(300);
      const r=await send('Runtime.evaluate',{expression:"!document.getElementById('visitStall').hidden",returnByValue:true});
      if(r.result.value){visitAvailable=true;break;}
    }
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW'});
    if(visitAvailable){
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'e',code:'KeyE'});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'e',code:'KeyE'});
      await sleep(1800);
      const r=await send('Runtime.evaluate',{expression:"document.getElementById('stallPanel').classList.contains('is-open')",returnByValue:true});
      if(!r.result.value)errors.push('E did not open the nearby shop');
      shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('previews/markets/morning-shop.png',Buffer.from(shot.data,'base64'));
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
      await sleep(1500);
    }else errors.push('No reachable shop found by walking into the market');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await send('Emulation.setTouchEmulationEnabled',{enabled:true});await sleep(1000);
    shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('previews/markets/morning-mobile.png',Buffer.from(shot.data,'base64'));
  }
  const report={ready,errors};await writeFile('previews/markets/morning-browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  await send('Browser.close');
  if (!ready || errors.length) process.exitCode=1;
} finally {socket?.close();browser.kill();}
