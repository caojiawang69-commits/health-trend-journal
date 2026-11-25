import {shiftDay} from '../../lib/calendar';
import type {detectDeviations} from '../analysis/deviations';

export const metricIds=['hrv','sleep','sleepScore','deep','light','rem','awake','resting','heartMin','heartMax','steps','stepGoal','distance','floors','intensity','calories','activeCalories','restCalories','stress'] as const;
export type HealthMetric=typeof metricIds[number];
export type TrendRange='30'|'90'|'180'|'365'|'all';
export type TrendScale='day'|'week'|'month';
export type TrendPoint={date:string;observed:number}&Record<HealthMetric,number|null>&Record<`${HealthMetric}Count`,number>;
export type TrendChange={metric:HealthMetric;recent:number;baseline:number;recentCount:number;baselineCount:number;delta:number;notable:boolean};
export type TrendPayload={today:string;from:string;scale:TrendScale;days:number;observed:number;points:TrendPoint[];deviations:ReturnType<typeof detectDeviations>;comparison:{recentFrom:string;baselineFrom:string;changes:TrendChange[]}};

export const ranges:ReadonlyArray<{id:TrendRange;label:string}>= [
 {id:'30',label:'30 天'},{id:'90',label:'90 天'},{id:'180',label:'半年'},{id:'365',label:'一年'},{id:'all',label:'全部'},
];
export const validTrendRange=(value:unknown):value is TrendRange=>ranges.some(r=>r.id===value);
export const monthStart=(date:string)=>date.slice(0,7)+'-01';
export const weekStart=(date:string)=>shiftDay(date,-((new Date(date+'T00:00:00Z').getUTCDay()+6)%7));
const nextMonth=(date:string)=>new Date(Date.UTC(Number(date.slice(0,4)),Number(date.slice(5,7)),1)).toISOString().slice(0,10);
export function emptyTrendPoint(date:string):TrendPoint{
 return Object.fromEntries([['date',date],['observed',0],...metricIds.flatMap(m=>[[m,null],[`${m}Count`,0]])]) as TrendPoint;
}
export function fillTrendBuckets(rows:TrendPoint[],from:string,today:string,scale:TrendScale):TrendPoint[]{
 const byDate=new Map(rows.map(row=>[row.date,row]));
 const out:TrendPoint[]=[];
 const start=scale==='month'?monthStart(from):scale==='week'?weekStart(from):from;
 for(let date=start;date<today;date=scale==='month'?nextMonth(date):shiftDay(date,scale==='week'?7:1)){
  out.push(byDate.get(date)??emptyTrendPoint(date));
 }
 return out;
}
export function summarizeTrend(points:TrendPoint[],metric:HealthMetric){
 let count=0,sum=0;
 for(const p of points){
  const value=p[metric],n=p[`${metric}Count`];
  if(value!==null&&n>0){sum+=value*n;count+=n;}
 }
 return {count,average:count?sum/count:null};
}
