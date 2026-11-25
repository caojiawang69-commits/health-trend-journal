import {env} from 'cloudflare:workers';
import * as garmin from '../garmin/sync';
import {validPersonalKey,sealGarminKey,unsealGarminKey} from '../garmin/credential';
import {db,getSetting,setSetting,localDate,healthWrite} from '../../lib/health-store';
import {shiftDay,retryTarget} from '../garmin/schedule';
import {exchangePersonalKey} from '../garmin/client';
import {readFeed} from './feeds';
type Provider='garmin'|'intervals'|'daily-json';
const slot=(id:Provider)=>id==='garmin'?'private:garmin-connection-v1':'private:feed:'+id;
const identity=(id:Provider)=>id==='daily-json'?id+':'+env.HEALTH_FEED_URL:id;
export async function sourceOptions():Promise<Provider[]>{
 const saved=await getSetting('source-identity');
 const pinned=env.HEALTH_PROVIDER??(env.GARMIN_PERSONAL_API_KEY?'garmin':null);
 const all:Provider[]=env.HEALTH_FEED_URL?['garmin','intervals','daily-json']:['garmin','intervals'];
 return all.filter(id=>(!pinned||id===pinned)&&(!saved||identity(id)===saved));
}
export async function provider(){
 const [active]=await sourceOptions();if(!active)throw Error('配置与现有数据库的数据源不匹配');
 return active;
}
export async function isGarminConfigured(){
 const id=await provider();
 return id==='garmin'?garmin.isGarminConfigured():!!(await getSetting(slot(id)));
}
export async function connectGarmin(key:string,requested?:Provider){
 const options=await sourceOptions();
 const id=requested??options[0];
 if(!options.includes(id))return 'source_conflict';
 if(key.startsWith('GCDC_')&&id!=='garmin')return 'rejected';
 const secret=env.GARMIN_CONNECTION_ENCRYPTION_KEY;
 if(!secret)return 'not_configured';
 try{
  if(id==='garmin'){
   if(!validPersonalKey(key)||!await exchangePersonalKey(key))return 'rejected';
  }else await readFeed(id,key,localDate(),localDate(),env.HEALTH_FEED_URL);
 }catch(e){return (e as Error).message==='数据源拒绝了密钥'?'rejected':'provider_unavailable';}
 let cipher:string;
 try{cipher=await sealGarminKey(key,secret);}catch{return 'encryption_failed';}
 const name=identity(id);
 try{
 const [,write]=await db().batch([
  db().prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('source-identity',?)").bind(name),
  db().prepare("INSERT INTO settings(key,value) SELECT ?,? WHERE (SELECT value FROM settings WHERE key='source-identity')=? ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(slot(id),cipher,name)
 ]);
 return write.meta.changes?'connected':'source_conflict';
 }catch{return 'storage_unavailable';}
}

export async function syncGarmin(target?:string){

 const id=await provider();
 if(id==='garmin')return garmin.syncGarmin(target);
 const cipher=await getSetting(slot(id)),secret=env.GARMIN_CONNECTION_ENCRYPTION_KEY;
 if(!cipher||!secret)throw Error('请先连接数据源');
 const key=await unsealGarminKey(cipher,secret),today=target??localDate();
 const last=await getSetting('feed-cursor');
 const recent=shiftDay(today,-7);
 const start=last&&last<recent?shiftDay(last,-1):last?recent:shiftDay(today,-89);
 let saved=0;
 for(let from=start;from<=today;from=shiftDay(from,21)){
  const end=[today,shiftDay(from,20)].sort()[0];
  const rows=await readFeed(id,key,from,end,env.HEALTH_FEED_URL);
  const now=new Date().toISOString();
  for(const r of rows){
   const writes=[];
   if(r.steps!==undefined||r.restingBpm!==undefined)writes.push(healthWrite(r.date,'summary',{movement:{steps:{value:r.steps}},heartRate:{restingValue:r.restingBpm}},now));
   if(r.sleepSeconds!==undefined)writes.push(healthWrite(r.date,'sleep',{sleepTimeSeconds:r.sleepSeconds},now));
   if(r.nightlyHrvMs!==undefined)writes.push(healthWrite(r.date,'hrv',{lastNightAvg:r.nightlyHrvMs},now));
   if(writes.length){await db().batch(writes);saved+=writes.length;}
  }
  await setSetting('feed-cursor',end);
 }
 await setSetting('lastSync',new Date().toISOString());
 if(target&&saved){await setSetting('lastScheduledSync',new Date().toISOString());await setSetting('lastScheduledFor',target);}
 return {saved,date:today};
}
export async function runScheduledGarmin(time:number,cron:string){
 if(await provider()==='garmin'){return garmin.runScheduledGarmin(time,cron);}
 const date=retryTarget(time,cron);
 if(await getSetting('lastScheduledFor')!==date)await syncGarmin(date);
}
