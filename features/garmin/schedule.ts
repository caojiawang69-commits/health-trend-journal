import {shiftDay} from '../../lib/calendar';
export {shiftDay} from '../../lib/calendar';
export const garminTimezone='Asia/Shanghai';
export function localDay(at:Date){
 return new Intl.DateTimeFormat('en-CA',{timeZone:garminTimezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(at);
}
export function syncWindow(today:string,checkpoint?:string){
 const recent=shiftDay(today,-20);
 if(!checkpoint||!/^\d{4}-\d{2}-\d{2}$/.test(checkpoint)||!Number.isFinite(Date.parse(checkpoint))||checkpoint>=recent)return {start:recent,end:today};
 return {start:shiftDay(checkpoint,-1),end:shiftDay(checkpoint,19)};
}
export function retryTarget(time:number,cron:string){
 const day=localDay(new Date(time));
 return cron==='0 17 * * *'?shiftDay(day,-1):day;
}
