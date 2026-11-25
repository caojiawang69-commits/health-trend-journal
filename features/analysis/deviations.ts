import {shiftDay} from '../../lib/calendar';
import type {TrendPoint} from '../trends/model';

// Product sensitivity settings in each metric's unit, not clinical cut-offs.
const minimum = {hrv:8, resting:5, sleep:1, sleepScore:10, steps:2500, floors:5,
 intensity:25, calories:350, stress:10} as const;
export type FlagMetric = keyof typeof minimum;
export type Deviation = {date:string; metric:FlagMetric; value:number; median:number; samples:number};
const tracked = Object.keys(minimum) as FlagMetric[];
function median(values:number[]) {
 const sorted=values.slice().sort((a,b)=>a-b);
 const middle=Math.floor(sorted.length/2);
 return (sorted[middle]+sorted[(sorted.length-1)>>1])/2;
}
export function detectDeviations(points:TrendPoint[],from:string) {
 const history:TrendPoint[]=[], flags:Deviation[]=[];
 const assessed=Object.fromEntries(tracked.map(metric=>[metric,0])) as Record<FlagMetric,number>;
 for(const point of [...points].sort((a,b)=>a.date.localeCompare(b.date))) {
  const start=shiftDay(point.date,-28);
  while(history.length && history[0].date<start)history.shift();
  if(point.date>=from) for(const metric of tracked) {
   const value=point[metric];
   if(value===null)continue;
   const values=history.map(p=>p[metric]).filter((v):v is number=>v!==null);
   if(values.length<14)continue;
   assessed[metric]++;
   const center=median(values);
   const mad=median(values.map(v=>Math.abs(v-center)));
   if(Math.abs(value-center)>=Math.max(minimum[metric],3*1.4826*mad)) {
    flags.push({date:point.date,metric,value,median:center,samples:values.length});
   }
  }
  history.push(point);
 }
 const dates=points.filter(p=>p.date>=from&&p.observed>0).map(p=>p.date).sort();
 return {flags,assessed,lastObserved:dates.at(-1)??null};
}
