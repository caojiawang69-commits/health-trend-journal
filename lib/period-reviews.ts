import {db,localDate,setSetting} from './health-store';
import {shiftDay} from './calendar';
import {readDailyRange} from './trend-query';
import {detectDeviations} from '../features/analysis/deviations';
import {metricIds,summarizeTrend} from './trend-data';

import {periods} from '../features/analysis/period';
import type {Period,PeriodReview} from '../features/analysis/period';
export {periods};
function bounds(period:Period,end:string) {
 if(!periods.includes(period)||!/^\d{4}-\d\d-\d\d$/.test(end)||!Number.isFinite(Date.parse(end))||
  shiftDay(end,0)!==end||end>=localDate())throw new Error('请选择已经结束的日期');
 const next=shiftDay(end,1);
 if(period==='month'&&!next.endsWith('-01')||period==='year'&&!end.endsWith('-12-31'))throw new Error('请选择完整的自然月或自然年');
 const from=period==='year'?end.slice(0,4)+'-01-01':period==='month'?end.slice(0,7)+'-01':shiftDay(end,-29);
 return {from,next};
}
export async function periodEvidence(period:Period,end:string,page=0) {
 if(!Number.isInteger(page)||page<0)throw new Error('页码无效');
 const {from,next}=bounds(period,end);
 const all=await readDailyRange(shiftDay(from,-28),next);
 const selected=all.filter(p=>p.date>=from&&p.observed);
 const {flags,assessed}=detectDeviations(all,from);
 const months=[...new Set(selected.map(p=>p.date.slice(0,7)))];
 return {period,from,end,observedDays:selected.length,calendarDays:(Date.parse(next)-Date.parse(from))/86400000,
  monthly:months.map(month=>({month,metrics:Object.fromEntries(metricIds.map(m=>[m,summarizeTrend(selected.filter(p=>p.date.startsWith(month)),m)]))})),
  assessed,flagCount:flags.length,flags:flags.slice(page*35,(page+1)*35),nextPage:(page+1)*35<flags.length?page+1:null,
  existing:await db().prepare('SELECT value FROM settings WHERE key=?').bind('period-review:'+end+':'+period).first<string>('value').then(v=>v?JSON.parse(v) as PeriodReview:null)};
}
export async function savePeriodReview(period:Period,end:string,body:string) {
 const {from}=bounds(period,end);
 if(typeof body!=='string'||!body.trim()||body.length>10000)throw new Error('正文长度无效');
 const review:PeriodReview={period,end,from,body:body.trim(),created:new Date().toISOString()};
 await setSetting('period-review:'+end+':'+period,JSON.stringify(review));
 return {saved:true,period,end};
}
export async function recentPeriodReviews() {
 const rows=await db().prepare("SELECT value FROM settings WHERE key GLOB 'period-review:*' ORDER BY key DESC LIMIT 24").all<{value:string}>();
 return rows.results.map(row=>JSON.parse(row.value) as PeriodReview);
}
