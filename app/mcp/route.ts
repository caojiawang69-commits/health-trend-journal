import {env} from 'cloudflare:workers';
import {periodEvidence,savePeriodReview,periods} from '../../lib/period-reviews';
const periodFields={period:{type:'string',enum:periods},end:{type:'string',description:'Inclusive, completed Beijing calendar date YYYY-MM-DD. Month/year use the final day of the calendar period.'}};
import {snapshot,db,syncGarmin} from '../../lib/health';
export async function POST(req:Request){
 if(!req.headers.get('oai-authenticated-user-id'))return Response.json({error:'Authentication required'},{status:401});
 const q:any=await req.json();let result:any;
 if(q.method==='server/discover')result={supportedVersions:['2026-07-28'],capabilities:{tools:{}}};
 else if(q.method==='initialize')result={protocolVersion:'2026-07-28',capabilities:{tools:{}},serverInfo:{name:'daily-health',version:'1.0.0'}};
 else if(q.method==='notifications/initialized')return new Response(null,{status:202});
 else if(q.method==='tools/list')result={tools:[
 {name:'read_period_evidence',description:'Read a private retrospective: week reviews 30 days, month and year cover the calendar period. Returns per-metric coverage and means, daily deviations with prior baselines, and an existing report. Follow nextPage for more flags.',inputSchema:{type:'object',properties:{...periodFields,page:{type:'integer',minimum:0}},required:['period','end'],additionalProperties:false}},
 {name:'save_period_review',description:'Save or update the dated weekly, monthly, or annual report for display on the private website. Use actual readings and cite verified literature links when interpreting deviations.',inputSchema:{type:'object',properties:{...periodFields,body:{type:'string',maxLength:10000}},required:['period','end','body'],additionalProperties:false}},
 {name:'sync_garmin',description:'Sync the owner’s Garmin sleep and health records into this private Site.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'read_health_journal',description:'Read recent real Garmin metrics, meal notes and existing reports. Missing data must not be treated as zero.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'read_meal_photos',description:'View before and after meal photos to estimate foods and portions. Never infer exact calories from images.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}},
 {name:'save_daily_feedback',description:'Save a dated Chinese daily health feedback report visible on the user’s phone. Ground it in retrieved records and separate estimates from facts.',inputSchema:{type:'object',properties:{date:{type:'string'},body:{type:'string'}},required:['date','body'],additionalProperties:false}}
 ]};
 else if(q.method==='tools/call'){try{const a=q.params?.arguments??{};let value:any;
 if(q.params.name==='read_period_evidence')value=await periodEvidence(a.period,a.end,a.page);
 else if(q.params.name==='save_period_review')value=await savePeriodReview(a.period,a.end,a.body);
 else if(q.params.name==='sync_garmin')value=await syncGarmin();
 else if(q.params.name==='read_health_journal'){const s=await snapshot();value={...s,health:s.health.filter((r:any)=>r.kind!=='heart_rate').map((r:any)=>({date:r.date,kind:r.kind,...(r.kind==='sleep'?{seconds:r.payload.sleepTimeSeconds,startLocal:r.payload.sleepStartTimestampLocal,endLocal:r.payload.sleepEndTimestampLocal,score:r.payload.sleepScores?.overall?.value}:{steps:r.payload.movement?.steps?.value,restingHR:r.payload.heartRate?.restingValue,stress:r.payload.stress?.avgLevel,intensity:r.payload.intensityMinutes})}))};}
 else if(q.params.name==='read_meal_photos'){const m=await db().prepare('SELECT * FROM meals WHERE id=?').bind(String(a.id)).first<any>();if(!m)throw new Error('Meal not found');const content:any[]=[{type:'text',text:JSON.stringify({type:m.type,time:m.occurred,note:m.note})}];for(const phase of ['before','after']){const key=m[phase+'_key'];if(key){const f=await env.BUCKET?.get(key);if(f){const bytes=new Uint8Array(await f.arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));content.push({type:'text',text:phase},{type:'image',data:btoa(str),mimeType:f.httpMetadata?.contentType||'image/jpeg'});}}}return Response.json({jsonrpc:'2.0',id:q.id,result:{content}});}
 else if(q.params.name==='save_daily_feedback'){if(!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||typeof a.body!=='string'||a.body.length>12000)throw new Error('Invalid report');await db().prepare('INSERT INTO reports(date,body,created) VALUES(?,?,?) ON CONFLICT(date) DO UPDATE SET body=excluded.body,created=excluded.created').bind(a.date,a.body,new Date().toISOString()).run();value={saved:true,date:a.date};}
 else throw new Error('Unknown tool');result={content:[{type:'text',text:JSON.stringify(value)}]};
 }catch(e){result={isError:true,content:[{type:'text',text:e instanceof Error?e.message:'Failed'}]};}}
 else return Response.json({jsonrpc:'2.0',id:q.id,error:{code:-32601,message:'Method not found'}});
 return Response.json({jsonrpc:'2.0',id:q.id,result});
}
