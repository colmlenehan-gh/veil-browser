import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
import {secureFetch,validURL,VeilError} from './network.js';
export async function remoteSnapshot(url){
 validURL(url);const initial=await secureFetch(url);if(initial.status>=400)throw new VeilError(`Destination returned HTTP ${initial.status}.`,502);
 const browser=await playwright.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||(process.env.VERCEL?await chromium.executablePath():'/usr/bin/chromium'),headless:true,args:[...chromium.args,'--disable-background-networking','--disable-quic','--disable-webrtc','--proxy-bypass-list=<-loopback>'],proxy:{server:'http://127.0.0.1:9'}});
 try{
  const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false,viewport:{width:1280,height:900},javaScriptEnabled:true});
  await context.routeWebSocket('**/*',ws=>ws.close());let count=0,total=0;const started=Date.now();let seeded=false;
  await context.route('**/*',async route=>{const req=route.request();try{if(req.method()!=='GET'||++count>60||Date.now()-started>18000||total>10000000)throw 0;validURL(req.url());let r;if(!seeded&&req.isNavigationRequest()){seeded=true;r=initial;}else r=await secureFetch(req.url(),{limit:1500000,timeout:5000});total+=r.body.length;const type=String(r.headers['content-type']||'application/octet-stream');if(!/^(text\/|application\/(javascript|x-javascript|json)|image\/(png|jpeg|gif|webp|avif|svg\+xml)|font\/)/i.test(type))throw 0;
   await route.fulfill({status:r.status,headers:{'content-type':type,'access-control-allow-origin':'*','x-content-type-options':'nosniff'},body:r.body});
  }catch{await route.abort().catch(()=>{});}});
  const page=await context.newPage();await page.goto(initial.url,{waitUntil:'domcontentloaded',timeout:20000});await page.waitForTimeout(1000);const html=await page.content();return {html,url:page.url()};
 }finally{await browser.close();}
}
