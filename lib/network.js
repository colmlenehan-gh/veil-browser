import https from 'node:https';
import http from 'node:http';
import dns from 'node:dns/promises';
import net from 'node:net';
import ipaddr from 'ipaddr.js';
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib';
export class VeilError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export function publicIP(ip){try {let a=ipaddr.parse(ip); if(a.kind()==='ipv6'&&a.isIPv4MappedAddress())a=a.toIPv4Address();return a.range()==='unicast';}catch{return false;}}
export function validURL(input){let u;try{u=new URL(input);}catch{throw new VeilError('Enter a complete HTTP or HTTPS URL.');}if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.href.length>4096|| (u.port && !['80','443'].includes(u.port)))throw new VeilError('Only public HTTP(S) pages on standard ports are supported.');const h=u.hostname.replace(/^\[|\]$/g,'');if(h==='localhost'||h.endsWith('.localhost')||!h.includes('.')&&!net.isIP(h)||net.isIP(h)&&!publicIP(h))throw new VeilError('Private or reserved destinations are blocked.',403);return u;}
export async function resolvePublic(host,lookup=dns.lookup){host=host.replace(/^\[|\]$/g,''); const records=net.isIP(host)?[{address:host,family:net.isIP(host)}]:await lookup(host,{all:true,verbatim:true});if(!records.length||records.some(x=>!publicIP(x.address)))throw new VeilError('Private or reserved DNS addresses are blocked.',403);return records[0];}
export async function secureFetch(input,{limit=2_000_000,timeout=12000,maxRedirects=4,accept='text/html,*/*;q=0.5'}={}){
 const deadline=Date.now()+timeout;let u=validURL(input);
 for(let i=0;i<=maxRedirects;i++){
  const remaining=deadline-Date.now();if(remaining<=0)throw new VeilError('The remote request timed out.',504);
  const address=await Promise.race([resolvePublic(u.hostname),new Promise((_,r)=>{const t=setTimeout(()=>r(new VeilError('DNS timed out.',504)),remaining);t.unref();})]);
  const response=await new Promise((resolve,reject)=>{let size=0;const chunks=[];const request=(u.protocol==='https:'?https:http).request(u,{method:'GET',agent:false,lookup:(_h,_o,cb)=>cb(null,address.address,address.family),headers:{'User-Agent':'VeilBrowser/0.1 (remote-fetch; no cookies)','Accept':accept,'Accept-Encoding':'identity'}},res=>{
    res.on('data',chunk=>{size+=chunk.length;if(size>limit){request.destroy(new VeilError('Remote response exceeds the size limit.',413));return;}chunks.push(chunk);});res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));res.on('error',reject);
  });const timer=setTimeout(()=>request.destroy(new VeilError('The remote request timed out.',504)),Math.max(1,deadline-Date.now()));request.on('close',()=>clearTimeout(timer));request.on('error',reject);request.end();});
  if([301,302,303,307,308].includes(response.status)&&response.headers.location){if(i===maxRedirects)throw new VeilError('Too many redirects.',502);u=validURL(new URL(response.headers.location,u).href);continue;}
  let body=response.body;try{const encoding=response.headers['content-encoding'];if(encoding==='gzip')body=gunzipSync(body,{maxOutputLength:limit});else if(encoding==='deflate')body=inflateSync(body,{maxOutputLength:limit});else if(encoding==='br')body=brotliDecompressSync(body,{maxOutputLength:limit});else if(encoding&&encoding!=='identity')throw new Error();}catch{throw new VeilError('Unsupported or oversized encoded response.',502);}
  if(body.length>limit)throw new VeilError('Remote response exceeds the size limit.',413);
  return {...response,body,url:u.href};
 }
}
