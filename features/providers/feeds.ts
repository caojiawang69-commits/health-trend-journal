// A deployment uses one data source and one private database.
export type FeedProvider='intervals'|'daily-json';
export type DailyReading={date:string;steps?:number;restingBpm?:number;sleepSeconds?:number;nightlyHrvMs?:number};
export async function readFeed(provider:FeedProvider,key:string,from:string,to:string,endpoint?:string,request:typeof fetch=fetch):Promise<DailyReading[]>{
 const url=provider==='intervals'?new URL('https://intervals.icu/api/v1/athlete/0/wellness'):new URL(endpoint??'');
 if(url.protocol!=='https:'||url.username||url.password||url.hash)throw Error('数据源需要 HTTPS 地址');
 url.searchParams.set(provider==='intervals'?'oldest':'from',from);
 url.searchParams.set(provider==='intervals'?'newest':'to',to);
 const auth=provider==='intervals'?'Basic '+btoa('API_KEY:'+key):'Bearer '+key;
 const response=await request(url,{headers:{Authorization:auth,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(response.status===401||response.status===403)throw Error('数据源拒绝了密钥');
 if(!response.ok)throw Error('数据源读取失败（'+response.status+'）');
 const data=await response.json();
 if(!Array.isArray(data)||data.length>500)throw Error('无效的每日数据列表');
 const seen=new Set<string>();
 return data.map(raw=>{
  if(!raw||typeof raw!=='object')throw Error('无效的每日记录');
  const row=provider==='intervals'?{date:raw.id,steps:raw.steps,restingBpm:raw.restingHR,sleepSeconds:raw.sleepSecs}:raw;
  if(typeof row.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||row.date<from||row.date>to||seen.has(row.date)||!Number.isFinite(Date.parse(row.date))||new Date(row.date).toISOString().slice(0,10)!==row.date)throw Error('日期无效或重复');
  seen.add(row.date);
  const out:DailyReading={date:row.date};
  for(const [field,low,high] of [['steps',0,200000],['restingBpm',1,300],['sleepSeconds',1,86400],['nightlyHrvMs',1,500]] as const){
   const value=row[field];if(value==null)continue;
   if(typeof value!=='number'||!Number.isFinite(value)||value<low||value>high)throw Error('数据源数值或单位无效');
   out[field]=value;
  }
  return out;
 });
}
