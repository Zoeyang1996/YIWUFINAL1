import {chromium} from 'playwright';
const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1600,height:1000}});
for(const phase of ['morning','noon','night']){
 await p.goto('http://127.0.0.1:8765/market.html?phase='+phase);
 await p.waitForTimeout(14000);
 await p.screenshot({path:'.ppt-build/assets/walk-'+phase+'.png'});
 console.log(phase);
}
await b.close();
