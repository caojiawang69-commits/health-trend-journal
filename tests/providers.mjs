import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';

const host='https://journal.example';
const root='dist/server',files=readdirSync(root,{recursive:true}).filter(p=>/\.m?js$/.test(p)&&p!=='index.js');
const pass=randomBytes(24).toString('hex'),apiKey=randomBytes(24).toString('hex');
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()-86400000));
for(const source of ['intervals','daily-json','garmin']){
 const key=source==='garmin'?'GCDC_'+apiKey:apiKey;
 const mock=new Miniflare({modulesRoot:root,modules:['index.js',...files].map(p=>({type:'ESModule',path:root+'/'+p})),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],
  bindings:{OWNER_PASSWORD:pass,HEALTH_FEED_URL:'https://adapter.example/wellness',GARMIN_CONNECTION_ENCRYPTION_KEY:randomBytes(32).toString('base64url')},outboundService:async req=>{
   const url=new URL(req.url),authorization=req.headers.get('authorization');
   if(source==='garmin'){
    assert.equal(url.hostname,'personal.connectapi.garmin.com');
    if(url.pathname.endsWith('/token'))return authorization==='ApiKey '+key?new Response('fixture-access'):new Response(null,{status:401});
    assert.equal(authorization,'Bearer fixture-access');
    if(url.pathname.includes('dailysummaries'))return Response.json({data:[{calendarDate:day,movement:{steps:{value:3210}}}]});
    if(url.pathname.includes('dailySleep'))return Response.json([]);
    if(url.pathname.includes('/hrv/'))return Response.json({hrvSummaries:[]});
    return Response.json({});
   }
   assert.equal(url.hostname,source==='intervals'?'intervals.icu':'adapter.example');
   assert.equal(authorization,source==='intervals'?'Basic '+Buffer.from('API_KEY:'+key).toString('base64'):'Bearer '+key);
   const start=url.searchParams.get(source==='intervals'?'oldest':'from'),end=url.searchParams.get(source==='intervals'?'newest':'to');
   return Response.json(day>=start&&day<=end?[source==='intervals'?{id:day,steps:3210,restingHR:60,hrv:75}:{date:day,steps:3210,restingBpm:60,nightlyHrvMs:48}]:[]);
  }});
 try{
  const db=await mock.getD1Database('DB');
  for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())for(const query of readFileSync('drizzle/'+name,'utf8').split('--> statement-breakpoint'))if(query.trim())await db.prepare(query).run();
  const auth='Basic '+Buffer.from('owner:'+pass).toString('base64');
  const post=(path,data)=>mock.dispatchFetch(host+path,{method:'POST',headers:{Authorization:auth,Origin:host,'Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await mock.dispatchFetch(host+'/api/data')).status,401);
  assert.equal((await post('/api/service',{action:'sync'})).status,503);
  assert.equal((await post('/api/garmin-connection',{provider:source,key})).status,200);
  const encrypted=await db.prepare("SELECT value FROM settings WHERE key LIKE 'private:%'").first('value');
  assert.ok(encrypted&&!encrypted.includes(key));
  assert.equal((await post('/api/sync',{})).status,200);
  const trends=await (await mock.dispatchFetch(host+'/api/trends',{headers:{Authorization:auth}})).json();
  const actual=trends.points.find(p=>p.date===day);assert.equal(actual.steps,3210);assert.equal(actual.hrv,source==='daily-json'?48:null);
  assert.equal((await post('/api/garmin-connection',{provider:source==='garmin'?'intervals':'garmin',key})).status,409);
  console.log(source+' passed');
 }finally{await mock.dispose();}
}
