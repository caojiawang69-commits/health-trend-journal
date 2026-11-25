import {env} from 'cloudflare:workers';
import {db,healthWrite,getSetting,setSetting} from '../../lib/health-store';
import {localDay,shiftDay,syncWindow,retryTarget} from './schedule';
import {sealGarminKey,unsealGarminKey} from './credential';
import {exchangePersonalKey,garminClient} from './client';
import type {GarminClient} from './client';
const garminConnectionSetting='private:garmin-connection-v1';
export async function isGarminConfigured(){
 return !!env.GARMIN_PERSONAL_API_KEY||!!(env.GARMIN_CONNECTION_ENCRYPTION_KEY&&await getSetting(garminConnectionSetting));
}
export async function connectGarmin(key:string){
 const secret=env.GARMIN_CONNECTION_ENCRYPTION_KEY;
 if(!secret)return 'not_configured';
 let encrypted:string;
 try{encrypted=await sealGarminKey(key,secret);}catch{console.warn('Garmin connection: encryption failed');return 'encryption_failed';}
 try{if(!await exchangePersonalKey(key))return 'rejected';}catch{console.warn('Garmin connection: provider unavailable');return 'provider_unavailable';}
 try{await setSetting(garminConnectionSetting,encrypted);}catch{console.warn('Garmin connection: storage unavailable');return 'storage_unavailable';}
 return 'connected';
}
async function garminKey(){
 const secret=env.GARMIN_CONNECTION_ENCRYPTION_KEY;
 if(secret){
  const value=await getSetting(garminConnectionSetting);
  if(value)try{return await unsealGarminKey(value,secret);}catch{throw new Error('保存的佳明连接无法读取，请重新连接');}
 }
 return env.GARMIN_PERSONAL_API_KEY;
}
const inRange=(date:unknown,start:string,end:string):date is string=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=start&&date<=end;
type Entry={date:string;kind:string;payload:unknown};
async function persistEntries(entries:Entry[],now:string){
 // D1 permits at most 100 bound values per statement; use 16 records (80 values).
 for(let i=0;i<entries.length;i+=16){
  const batch=entries.slice(i,i+16);
  const places=batch.map(()=>'(?,?,?,?,?)').join(',');
  await db().prepare('INSERT INTO health(id,date,kind,payload,updated) VALUES '+places+' ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated')
   .bind(...batch.flatMap(e=>[`${e.kind}:${e.date}`,e.date,e.kind,JSON.stringify(e.payload),now])).run();
 }
 return entries.length;
}
async function storeGarminRange(client:GarminClient,start:string,end:string,now:string){
 const [sums,sleeps]=await Promise.all([client.summaries(start,end),client.sleep(start,end)]);
 if(!Array.isArray(sums?.data)||!Array.isArray(sleeps))throw new Error('佳明返回的数据格式无法读取');
 const summaryDates=new Set<string>();
 const entries:Entry[]=[];
 for(const s of sums.data){if(inRange(s?.calendarDate,start,end)&&s.includesWellnessData!==false){summaryDates.add(s.calendarDate);entries.push({date:s.calendarDate,kind:'summary',payload:s});}}
 for(const s of sleeps){if(inRange(s?.calendarDate,start,end)&&typeof s.sleepTimeSeconds==='number'&&s.sleepTimeSeconds>0)entries.push({date:s.calendarDate,kind:'sleep',payload:s});}
 return {count:await persistEntries(entries,now),summaryDates};
}
async function storeHrvRange(client:GarminClient,start:string,end:string,now:string){
 let hrv:any;
 try{hrv=await client.hrv(start,end);}catch{console.warn('Garmin sync: HRV range unavailable');return null;}
 if(!Array.isArray(hrv?.hrvSummaries)){console.warn('Garmin sync: unexpected HRV range format');return null;}
 const entries:Entry[]=[];
 for(const row of hrv.hrvSummaries){
  if(inRange(row?.calendarDate,start,end)&&typeof row.lastNightAvg==='number'&&Number.isFinite(row.lastNightAvg)&&row.lastNightAvg>0)
   entries.push({date:row.calendarDate,kind:'hrv',payload:{lastNightAvg:row.lastNightAvg}});
 }
 return persistEntries(entries,now);
}
async function backfillGarmin(client:GarminClient,today:string,now:string){
 if(await getSetting('garmin90DayHistory')==='complete')return 0;
 const oldest=shiftDay(today,-90);
 let end=await getSetting('garminHistoryBefore')??shiftDay(today,-21);
 let count=0;
 while(end>=oldest){
  const start=[oldest,shiftDay(end,-20)].sort()[1];
  count+=(await storeGarminRange(client,start,end,now)).count;
  end=shiftDay(start,-1);
  await setSetting('garminHistoryBefore',end);
 }
 await setSetting('garmin90DayHistory','complete');
 return count;
}
async function backfillHrv(client:GarminClient,today:string,now:string){
 if(await getSetting('garmin90DayHrv')==='complete')return 0;
 const oldest=shiftDay(today,-90);
 let end=await getSetting('garminHrvBefore')??shiftDay(today,-21);
 let count=0;
 while(end>=oldest){
  const start=[oldest,shiftDay(end,-20)].sort()[1];
  const saved=await storeHrvRange(client,start,end,now);
  if(saved===null)return count;
  count+=saved;
  end=shiftDay(start,-1);
  await setSetting('garminHrvBefore',end);
 }
 await setSetting('garmin90DayHrv','complete');
 return count;
}
export async function syncGarmin(scheduledFor?:string){
 const today=localDay(new Date());
 const checkpoint=scheduledFor?await getSetting('lastScheduledThrough')??undefined:undefined;
 const {start,end}=syncWindow(scheduledFor??today,checkpoint);
 let count=0;
 try{
  const key=await garminKey();
  if(!key)throw new Error('请先连接佳明密钥');
  const token=await exchangePersonalKey(key);
  if(!token)throw new Error('佳明认证失败，请更换有效的密钥');
  const client=garminClient(token);
  const now=new Date().toISOString();
  const daily=await storeGarminRange(client,start,end,now);
  const {summaryDates}=daily;
  count+=daily.count;
  const hrv=await storeHrvRange(client,start,end,now);
  count+=hrv??0;
  const heartStart=scheduledFor?(checkpoint&&shiftDay(checkpoint,-6)<shiftDay(end,-6)?[start,shiftDay(checkpoint,-6)].sort()[1]:shiftDay(end,-6)):shiftDay(end,-1);
  const heartDays:string[]=[];
  for(let day=heartStart;day<=end;day=shiftDay(day,1))heartDays.push(day);
  const heartErrors:string[]=[];
  for(let i=0;i<heartDays.length;i+=4){
   const batch=await Promise.all(heartDays.slice(i,i+4).map(async date=>{
    try{const h=await client.heart(date);return h?.restingHeartRate!=null||h?.heartRateValues?.length?healthWrite(date,'heart_rate',h,now):null;}
    catch(e){heartErrors.push(e instanceof Error?e.message:'佳明心率读取失败');return null;}
   }));
   const valid=batch.filter((b):b is D1PreparedStatement=>b!==null);
   if(valid.length){await db().batch(valid);count+=valid.length;}
  }
  if(!scheduledFor){
   count+=await backfillGarmin(client,today,now);
   if(hrv!==null)count+=await backfillHrv(client,today,now);
  }
  if(!count)throw new Error('连接成功，但未找到健康记录。请先同步手表。');
  await setSetting('lastSync',now);
  if(heartErrors.length)throw new Error(heartErrors[0]);
  if(scheduledFor){
   const finishedThrough=end>=today?shiftDay(today,-1):end;
   // A successful range read can legitimately omit rest days. Leave a recent overlap on every sync.
   if((!checkpoint||checkpoint<finishedThrough)&&(end<scheduledFor||summaryDates.has(end)))await setSetting('lastScheduledThrough',finishedThrough);
   if(end!==scheduledFor||!summaryDates.has(scheduledFor))throw new Error(end!==scheduledFor?'正在补抓之前的健康记录':'佳明尚未提供目标日期的每日摘要，将自动重试');
   await setSetting('lastScheduledSync',now);
   await setSetting('lastScheduledFor',scheduledFor);
  }
  await setSetting('syncError','');
  return {saved:count,date:end};
 }catch(e){
  await setSetting('syncError',e instanceof Error?e.message:'同步失败');
  throw e;
 }
}
export async function runScheduledGarmin(time:number,cron:string){
 const target=retryTarget(time,cron);
 if(await getSetting('lastScheduledFor')===target)return;
 await syncGarmin(target);
}
