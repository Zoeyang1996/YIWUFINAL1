import { chromium } from 'playwright';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
page.on('pageerror',e=>console.log(e.message));
await page.goto('http://127.0.0.1:8765');
await page.waitForSelector('.curtain.is-done',{timeout:120000});
await page.waitForTimeout(2500);
await page.screenshot({path:'.ppt-build/assets/home.png'});
await page.addStyleTag({content:'body{background:transparent!important} body > :not(#stage){visibility:hidden!important} #stage{background:transparent!important}'});
for (const phase of ['morning','noon','night']) {
 await page.evaluate(p=>document.querySelector(`button[data-phase="${p}"]`).click(),phase);
 await page.waitForTimeout(6500);
 await page.screenshot({path:`.ppt-build/assets/${phase}.png`,omitBackground:true});
 console.log(phase);
}
await browser.close();
