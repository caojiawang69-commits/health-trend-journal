import {metricIds,summarizeTrend} from '../trends/model';
import type {TrendPayload,TrendRange} from '../trends/model';
import {metrics} from '../trends/metrics';

export type Review={body:string;created:string;source:string};
export type ReviewGenerator=(evidence:ReturnType<typeof reviewEvidence>)=>Promise<string>;
export function reviewEvidence(data:TrendPayload,range:TrendRange){
 const stride=Math.max(1,Math.ceil(data.points.length/48));
 const series=[];
 for(let i=0;i<data.points.length;i+=stride){
  const slice=data.points.slice(i,i+stride);
  const metrics=Object.fromEntries(metricIds.map(m=>[m,summarizeTrend(slice,m)]));
  series.push({firstBucket:slice[0].date,lastBucket:slice[slice.length-1].date,metrics});
 }
 return {
  range,from:data.from,throughExclusive:data.today,calendarDays:data.days,observedDays:data.observed,
  metrics:Object.fromEntries(metricIds.map(m=>[m,{label:metrics[m].label,unit:metrics[m].unit}])),
  totals:Object.fromEntries(metricIds.map(m=>[m,summarizeTrend(data.points,m)])),
  comparison:data.comparison,
  // Group neighboring buckets rather than dropping parts of the selected range.
  series,
  scale:data.scale,
 };
}
