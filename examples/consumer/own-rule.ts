import {emptyTrendPoint,fillTrendBuckets} from '../../features/trends/model';
import type {MetricSeries,TrendFlag} from '../../features/trends/model';
import type {Night} from './external-api';

// Example display rule: a change of at least 20% from the previous three measured nights.
export function ownSeries(nights:Night[],from:string,endExclusive:string):MetricSeries {
  const flags:TrendFlag[]=[];
  const previous:number[]=[];
  let assessed=0;
  let lastObserved:string|null=null;
  const readings=nights.filter(n=>n.date<endExclusive).map(({date,hrvMs})=>{
    const point=emptyTrendPoint(date);
    if(hrvMs===null)return point;
    point.hrv=hrvMs;point.hrvCount=1;point.observed=1;
    if(date>=from){
      lastObserved=date;
      if(previous.length===3){
        assessed++;
        const median=[...previous].sort((a,b)=>a-b)[1];
        if(Math.abs(hrvMs-median)>=0.2*median)flags.push({date,metric:'hrv',value:hrvMs,median,samples:3});
      }
    }
    previous.push(hrvMs);
    if(previous.length>3)previous.shift();
    return point;
  });
  const points=fillTrendBuckets(readings,from,endExclusive,'day');
  return {points,days:points.length,scale:'day',deviations:{flags,assessed:{hrv:assessed},lastObserved}};
}
