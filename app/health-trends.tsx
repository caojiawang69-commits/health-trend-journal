'use client';
import TrendPanel from '../features/trends/panel';
import type {TrendRange,TrendPayload} from '../features/trends/model';
import type {PeriodReview} from '../features/analysis/period';

async function read<T>(path:string,init?:RequestInit):Promise<T>{
 const r=await fetch(path,{cache:'no-store',...init});
 const result=await r.json() as T&{error?:string};
 if(!r.ok)throw new Error(result.error||'暂时无法读取数据');
 return result;
}
const load=(range:TrendRange,signal:AbortSignal)=>read<TrendPayload>('/api/trends?range='+range,{signal});
const loadReview=(range:TrendRange,signal:AbortSignal)=>read<{reports:PeriodReview[];previous:string|null}>('/api/period-reviews?range='+range,{signal});
export default function HealthTrends({lastSync,onSettings}:{lastSync?:string;onSettings:()=>void}){
 return <TrendPanel load={load} loadReview={loadReview} revision={lastSync} onSettings={onSettings}/>;
}
