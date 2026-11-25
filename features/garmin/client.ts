const origin='https://personal.connectapi.garmin.com';
const tokenPath='/personalapitoken-service/personal-api/personal-api-key/token';
export class GarminHttpError extends Error{
 constructor(readonly status:number){super(`佳明读取失败（${status}）`);}
}
export async function exchangePersonalKey(key:string,request:typeof fetch=fetch){
 const response=await request(origin+tokenPath,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{Authorization:'ApiKey '+key,Accept:'*/*'}});
 if([400,401,403,404].includes(response.status))return null;
 if(!response.ok)throw new GarminHttpError(response.status);
 const token=(await response.text()).trim();
 if(!token||/[\r\n]/.test(token))throw new Error('佳明没有返回有效的访问令牌');
 return token;
}
export function garminClient(token:string,request:typeof fetch=fetch){
 const get=async(path:string):Promise<any>=>{
  const response=await request(origin+path,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
  if(!response.ok)throw new GarminHttpError(response.status);
  return response.json();
 };
 return {
  summaries:(from:string,to:string)=>get(`/usersummary-service/v2/dailysummaries?startDate=${from}&endDate=${to}`),
  sleep:(from:string,to:string)=>get(`/sleep-service/sleep/dailySleepSummariesByDate?startDate=${from}&endDate=${to}`),
  hrv:(from:string,to:string)=>get(`/hrv-service/hrv/daily/${from}/${to}`),
  heart:(date:string)=>get('/wellness-service/wellness/dailyHeartRate?date='+date),
 };
}
export type GarminClient=ReturnType<typeof garminClient>;
