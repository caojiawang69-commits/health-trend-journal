import {env} from 'cloudflare:workers';
import {db} from './health-store';
import {readWithRetry} from './read-retry';
import {provider,sourceOptions,isGarminConfigured} from '../features/providers/service';
export {db,localDate,saveHealth,setSetting,writeAllowed} from './health-store';
export {connectGarmin,syncGarmin,runScheduledGarmin} from '../features/providers/service';
export async function snapshot(){
 const [meals,health,reports,settings,savedGarmin]=await readWithRetry(()=>Promise.all([db().prepare('SELECT * FROM meals ORDER BY occurred DESC LIMIT 120').all(),db().prepare('SELECT * FROM health ORDER BY date DESC LIMIT 150').all(),db().prepare('SELECT * FROM reports ORDER BY date DESC LIMIT 30').all(),db().prepare("SELECT key,value FROM settings WHERE key IN ('lastSync','syncError','lastScheduledSync','lastScheduledThrough','schedule')").all(),isGarminConfigured()]));
 return {meals:meals.results,health:health.results.map((r:any)=>({...r,payload:JSON.parse(r.payload)})),reports:reports.results,settings:Object.fromEntries(settings.results.map((r:any)=>[r.key,r.value])),healthProvider:await provider(),sourceOptions:await sourceOptions(),garminConfigured:savedGarmin,aiConfigured:!!env.OPENAI_API_KEY,timezone:'Asia/Shanghai'};
}
