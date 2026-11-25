import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';

const root='dist/server';
const files=readdirSync(root,{recursive:true}).filter(path=>/\.m?js$/.test(path)&&path!=='index.js');
const origin='https://journal.example';
const day=new Date(Date.now()-2*86400000).toISOString().slice(0,10);
const mf=new Miniflare({
  modulesRoot:root,modules:['index.js',...files].map(name=>({path:root+'/'+name,type:'ESModule'})),
  compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  durableObjects:{PERSONAL_ACCOUNTS:{className:'PersonalAccount',useSQLite:true}},
  outboundService:async request=>{
    assert.equal(new URL(request.url).hostname,'personal.connectapi.garmin.com');
    if(request.url.endsWith('/token'))return new Response('test-token');
    if(request.url.includes('dailysummaries'))return Response.json({data:[{calendarDate:day,movement:{steps:{value:3210}}}]});
    return Response.json([{calendarDate:day,sleepTimeSeconds:25200}]);
  }
});
function request(path,cookie='',fields,source=origin) {
  return mf.dispatchFetch(origin+'/account/'+path,{method:fields?'POST':'GET',redirect:'manual',headers:{
    cookie,Origin:source,'Content-Type':'application/x-www-form-urlencoded'
  },body:fields?new URLSearchParams(fields).toString():undefined});
}
const password=randomBytes(24).toString('hex');
async function register(username) {
  const r=await request('register','',{username,password});
  assert.equal(r.status,303,await r.clone().text());
  const setCookie=r.headers.get('set-cookie');
  assert.match(setCookie,/HttpOnly; Secure/);
  return setCookie.split(';')[0];
}
try {
  const alice=await register('alice'), bob=await register('bob');
  assert.equal((await request('register','',{username:'alice',password})).status,409);
  assert.equal((await request('login','',{username:'alice',password:'wrong'})).status,401);
  assert.equal((await request('note',alice,{note:'blocked'},'https://other.example')).status,403);
  assert.equal((await request('note',alice,{note:'only-alice'})).status,303);
  const imported=await request('import',alice,{key:'synthetic'});
  assert.equal(imported.headers.get('location'),'/account/space?s=imported');
  const mine=await(await request('space',alice)).text();
  assert.ok(mine.includes('only-alice')&&mine.includes('3210')&&mine.includes('7.0 小时'));
  const other=await(await request('space',bob)).text();
  assert.ok(!other.includes('only-alice')&&!other.includes('3210'));
  assert.equal((await request('space',alice.replace('alice.','bob.'))).status,303);
  await request('logout',alice,{});
  assert.equal((await request('space',alice)).status,303);
  const login=await request('login','',{username:'alice',password});
  assert.equal(login.status,303);
  assert.ok((await(await request('space',login.headers.get('set-cookie').split(';')[0])).text()).includes('only-alice'));
  console.log('Registration, credential checks, isolation, simulated Garmin import, logout and repeat login passed.');
}finally{await mf.dispose();}
