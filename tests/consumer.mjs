import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdtemp, mkdir, copyFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';

const repo=fileURLToPath(new URL('../',import.meta.url));
const workspace=await mkdtemp(join(tmpdir(),'health-consumer-'));
const key=randomBytes(24).toString('hex');
const modeledDays=Array.from({length:18},(_,i)=>({
  night:'2024-03-'+String(i+1).padStart(2,'0'),
  rmssd_us:i===3?45000:i===17?36000:i===5?null:60000
})).filter(row=>row.night!=='2024-03-10');
const example='examples/consumer/';
const model='features/trends/model.ts',calendar='lib/calendar.ts';

async function consumer(name,files){
  const dir=join(workspace,name);
  for(const f of files){
    await mkdir(dirname(join(dir,f)),{recursive:true});
    await copyFile(join(repo,f),join(dir,f));
  }
  return async (entry,browser=false)=>{
    const out=join(dir,entry.split('/').pop()+(browser?'.js':'.mjs'));
    await build({absWorkingDir:dir,entryPoints:[entry],outfile:out,bundle:true,platform:browser?'browser':'node',
      format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},
      nodePaths:[join(repo,'node_modules')],logLevel:'silent'});
    return browser?readFile(out,'utf8'):import(pathToFileURL(out).href);
  };
}

function browserDom(binary,url,profile){
  return new Promise((accept,reject)=>{
    const child=spawn(binary,['--headless','--disable-gpu','--disable-extensions','--disable-background-networking','--no-first-run',
      '--user-data-dir='+profile,'--virtual-time-budget=10000','--dump-dom',url],{windowsHide:true,stdio:['ignore','pipe','ignore']});
    let html='';
    child.stdout.setEncoding('utf8');child.stdout.on('data',part=>{html+=part;});
    const timer=setTimeout(()=>child.kill(),45000);
    child.once('error',e=>{clearTimeout(timer);reject(e);});
    child.once('close',code=>{clearTimeout(timer);if(code===0)accept(html);else reject(Error('Browser exit '+code));});
  });
}

let server;
try{
  const custom=await consumer('custom-api-and-rule',[example+'external-api.ts',example+'own-rule.ts',example+'react-chart.tsx',
    model,calendar,'features/trends/metric-card.tsx','features/trends/metrics.ts']);
  const independent=await consumer('custom-api-and-chart',[example+'external-api.ts',example+'native-chart.ts',model,calendar,'features/analysis/deviations.ts']);
  const apiOnly=await consumer('client-only',[example+'standalone-client.ts','features/providers/feeds.ts']);
  const encryptionOnly=await consumer('encryption-only',[example+'only-encryption.ts',example+'external-api.ts','features/garmin/credential.ts']);
  const {saveStudyKey,studySparkline}=await encryptionOnly(example+'only-encryption.ts');
  const {readNights}=await custom(example+'external-api.ts');
  const {ownSeries}=await custom(example+'own-rule.ts');
  const clientBundle=await custom(example+'react-chart.tsx',true);
  const nativeReader=await independent(example+'external-api.ts');
  const {nativeChart}=await independent(example+'native-chart.ts');
  const {exportSleepHours}=await apiOnly(example+'standalone-client.ts');
  let series,native;
  const requests=[];
  server=createServer(async(req,res)=>{
    try{
      if(req.url==='/research/query'){
        if(req.headers['x-study-key']!==key){res.writeHead(401).end();return;}
        assert.equal(req.method,'POST');
        let body='';for await(const part of req)body+=part;
        const query=JSON.parse(body);assert.equal(query.series,'overnight-hrv');
        const start=query.cursor===null?0:Number(query.cursor);
        assert.ok([0,7,14].includes(start));requests.push(start);
        res.setHeader('Content-Type','application/json');
        res.end(JSON.stringify({items:modeledDays.slice(start,start+7),next:start+7<modeledDays.length?String(start+7):null}));return;
      }
      if(req.url==='/study/series'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(series));return;}
      if(req.url==='/consumer.js'){res.setHeader('Content-Type','text/javascript');res.end(clientBundle);return;}
      if(req.url==='/'){
        res.setHeader('Content-Type','text/html; charset=utf-8');
        res.end('<!doctype html><meta charset="utf-8"><title>External consumer</title><div id="custom-api-chart"></div>'+native.svg+
          '<script type="module">import {mount} from "/consumer.js"; await mount(document.querySelector("#custom-api-chart"));'+
          'for(let i=0;i<100;i++){if(document.querySelectorAll(".recharts-reference-dot-dot").length===2){document.querySelector("details summary").click();break;}await new Promise(r=>setTimeout(r,50));}</script>');return;
      }
      res.writeHead(404).end();
    }catch{res.writeHead(500).end();}
  });
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
  const url='http://127.0.0.1:'+server.address().port;
  const endpoint=url+'/research/query',from='2024-03-01';
  await assert.rejects(()=>readNights(endpoint,'wrong'),/401/);
  series=ownSeries(await readNights(endpoint,key),from,'2024-03-19');
  assert.equal(series.days,18);
  assert.equal(series.points[5].hrv,null);assert.equal(series.points[9].observed,0);
  assert.equal(series.points[17].hrv,36);
  assert.deepEqual(series.deviations.flags.map(f=>[f.date,f.median,f.samples]),[['2024-03-04',60,3],['2024-03-18',60,3]]);
  native=nativeChart(await nativeReader.readNights(endpoint,key),from);
  assert.deepEqual(requests,[0,7,14,0,7,14]);
  assert.deepEqual(native.flags.map(f=>[f.date,f.metric,f.value,f.median,f.samples]),[['2024-03-18','hrv',36,60,15]]);
  assert.equal(native.svg.match(/<circle /g).length,16);
  assert.equal(native.svg.match(/data-flag="true"/g).length,1);
  console.log('Custom POST API + custom analysis: two early/late flags. Native SVG + original analysis: one late flag.');

  const store=new Map(),wrappingKey=randomBytes(32).toString('base64url');
  await saveStudyKey(store,key,wrappingKey);
  assert.ok(store.get('study')&&!store.get('study').includes(key));
  await assert.rejects(()=>studySparkline(endpoint,store,randomBytes(32).toString('base64url')));
  const hostView=await studySparkline(endpoint,store,wrappingKey);
  assert.equal(hostView.change,-24);
  assert.equal(hostView.svg.match(/<rect /g).length,16);
  assert.deepEqual(requests.slice(6),[0,7,14]);
  console.log('Both API and analysis/chart replaced: only the secret envelope is reused; 16 observed nights, last change -24 ms.');

  const exported=await exportSleepHours(key,from,'2024-03-02',async(input,options)=>{
    const u=new URL(input);
    assert.equal(u.origin,'https://intervals.icu');assert.equal(u.pathname,'/api/v1/athlete/0/wellness');
    assert.equal(u.searchParams.get('oldest'),from);assert.equal(u.searchParams.get('newest'),'2024-03-02');
    assert.equal(options.headers.Authorization,'Basic '+Buffer.from('API_KEY:'+key).toString('base64'));
    return Response.json([{id:from,sleepSecs:25200},{id:'2024-03-02',sleepSecs:null}]);
  });
  assert.deepEqual(exported,[{date:from,hours:7},{date:'2024-03-02',hours:null}]);
  console.log('Standalone API client + external transport/export: 7 hours and missing value preserved.');
  if(process.env.CONSUMER_BROWSER){
    const html=await browserDom(process.env.CONSUMER_BROWSER,url,join(workspace,'browser'));
    assert.ok(html.includes('此前三个有效夜晚的中位数')&&!html.includes('此前 28 天的中位数'));
    assert.match(html,/<details[^>]*\bopen\b/);
    assert.equal((html.match(/class="[^"]*recharts-reference-dot-dot[^"]*"/g)??[]).length,2);
    assert.ok(html.includes('36 毫秒')&&html.includes('45 毫秒')&&html.includes('（3 天）'));
    console.log('Browser: two marked chart points, custom baseline text and expanded details verified.');
  }else console.log('Browser check skipped. Set CONSUMER_BROWSER to a Chrome or Edge executable to include it.');
}finally{
  if(server?.listening){server.closeAllConnections();await new Promise(ok=>server.close(ok));}
  if(dirname(workspace)===resolve(tmpdir()))await rm(workspace,{recursive:true,force:true,maxRetries:3,retryDelay:200});
}
