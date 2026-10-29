import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { END_ZONES, createEndZone } from '../js/market/end-zone.js';
import { createNavigator } from '../js/market/navigation.js';
import { JSDOM } from './test-tools/node_modules/jsdom/lib/api.js';

test('morning fortune stall triggers from both walking approaches, not at spawn', () => {
  const nav = createNavigator(JSON.parse(fs.readFileSync(new URL('../assets/markets/morning.json', import.meta.url))));
  for (const [x,z] of [[-2,12], [2,16], [4,10]]) {
    const y = nav.sample(x,z);
    assert.notEqual(y,null,'approach must be walkable');
    const trigger = createEndZone(END_ZONES.morning);
    assert.equal(trigger.update({x:-8.4,y:1.29313,z:16.1}),false);
    assert.equal(trigger.update({x,y,z}),true,`missed fortune stall approach ${x},${z}`);
  }
});

test('end zones suppress repeat prompts, rearm outside, and respect height and overlays', () => {
  const zone = END_ZONES.night, trigger = createEndZone(zone);
  const p = { x:6, y:8.24, z:-17 };
  assert.equal(trigger.update({...p,y:5}),false);
  assert.equal(trigger.update(p,false),false);
  assert.equal(trigger.update(p),true);
  assert.equal(trigger.update(p),false);
  assert.equal(trigger.update({...p,x:9}),false);
  assert.equal(trigger.update(p),false);
  trigger.update({...p,x:12});
  assert.equal(trigger.update(p),true);
});

for (const [id,zone] of Object.entries(END_ZONES)) test(`${id}: endpoint has a walkable route from spawn`, () => {
  const data = JSON.parse(fs.readFileSync(new URL(`../assets/markets/${id}.json`,import.meta.url)));
  const nav = createNavigator(data), [x,y,z] = data.spawn;
  assert.notEqual(nav.sample(zone.center[0],zone.center[2]),null);
  const trigger = createEndZone(zone);
  assert.equal(trigger.update({x,y,z}),false,'must not trigger at arrival');
  const queue = [{x,y,z}], visited = new Set();
  let reached = false;
  for (let i=0;i<queue.length && i<80000;i++) {
    const p=queue[i];
    if (Math.hypot(p.x-zone.center[0],p.z-zone.center[2])<zone.radius && Math.abs(p.y-zone.center[1])<1) { reached=true;break; }
    for(const [dx,dz] of [[.4,0],[-.4,0],[0,.4],[0,-.4]]) {
      const next=nav.move(p,p.x+dx,p.z+dz);
      if(Math.hypot(next.x-p.x,next.z-p.z)<.39) continue;
      const key=[Math.round((next.x-x)/.4),Math.round((next.z-z)/.4),Math.round(next.y*5)].join(',');
      if(visited.has(key)) continue;
      visited.add(key);queue.push(next);
    }
  }
  assert.ok(reached,`no route to ${zone.label}; searched ${queue.length} positions`);
});

test('dialog keeps location on continue; short hold cancels; full keyboard hold returns once', async () => {
  const dom=new JSDOM('<button id="start">start</button>',{pretendToBeVisual:true});
  globalThis.window=dom.window;globalThis.document=dom.window.document;
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const { createEndPrompt }=await import('../js/market/end-prompt.js');
  let returns=0, opens=0, closes=0;
  const prompt=createEndPrompt({phase:{id:'morning',name:'早市'},onReturn:()=>returns++,onOpen:()=>opens++,onClose:()=>closes++});
  const p={x:-2,y:1.29313,z:12};
  prompt.update(p,true);assert.equal(prompt.isOpen,true);
  document.querySelector('.market-end__continue').click();
  prompt.update(p,true);assert.equal(prompt.isOpen,false);assert.equal(closes,1);assert.equal(returns,0);
  prompt.update({...p,x:20},true);prompt.update(p,true);assert.equal(opens,2);
  const back=document.querySelector('.market-end__return');
  const key=(type)=>back.dispatchEvent(new dom.window.KeyboardEvent(type,{key:'Enter',bubbles:true,cancelable:true}));
  key('keydown');key('keyup');prompt.update(p,false,performance.now()+1200);assert.equal(returns,0);
  key('keydown');window.dispatchEvent(new dom.window.Event('blur'));prompt.update(p,false,performance.now()+1200);assert.equal(returns,0);
  key('keydown');prompt.update(p,false,performance.now()+1200);prompt.update(p,false,performance.now()+2400);assert.equal(returns,1);
  dom.window.close();
});
