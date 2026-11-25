import {shiftDay} from '../../lib/calendar';
import {emptyTrendPoint,fillTrendBuckets,monthStart,weekStart,metricIds} from '../trends/model';
import {compareTrend} from '../analysis/compare';
import {detectDeviations} from '../analysis/deviations';
import type {TrendPayload,TrendPoint,TrendRange,TrendScale} from '../trends/model';

export function exampleTrends(range:TrendRange):TrendPayload{
 const today='2026-11-25',days=range==='all'?1460:Number(range),from=shiftDay(today,-days);
 const scale:TrendScale=range==='all'||range==='365'?'month':range==='180'?'week':'day';
 const points:TrendPoint[]=[];
 for(let i=0;i<Math.max(days+28,56);i++){
  const date=shiftDay(today,-i-1);
  if(i%13===0||i%49>45)continue;
  const season=Math.sin(i/60),wave=Math.sin(i*0.67);
  const hrv=i%11===0?null:Math.round(52+7*season+4*wave-(i%41===5?19:0));
  const sleep=7.2+0.4*season+0.55*wave,steps=Math.round(7300+900*season+1900*wave+(i%37===7?8500:0));
  const deep=1.25+0.27*season,rem=1.55+0.3*wave;
  const activeCalories=Math.round(470+100*season+180*wave),restCalories=1660;
  const values={hrv,sleep,steps,deep,light:sleep-deep-rem,rem,awake:0.35+0.15*wave,
   sleepScore:Math.round(82+5*season+8*wave),resting:Math.round(56-3*season+2*wave),heartMin:Math.round(48-3*season+2*wave),heartMax:Math.round(137+16*wave),
   stepGoal:8500,distance:steps*0.00075,floors:Math.max(0,Math.round(5+2*season+4*wave)),
   intensity:Math.max(0,Math.round(18+6*season+22*wave)),calories:activeCalories+restCalories,activeCalories,restCalories,stress:Math.round(32-3*season+7*wave)};
  const point={...emptyTrendPoint(date),observed:1,...values};
  for(const m of metricIds)point[`${m}Count`]=values[m]===null?0:1;
  points.push(point);
 }
 const selected=points.filter(p=>p.date>=from),buckets=new Map<string,TrendPoint>();
 for(const point of selected){
  const date=scale==='month'?monthStart(point.date):scale==='week'?weekStart(point.date):point.date;
  const bucket=buckets.get(date);
  if(!bucket){buckets.set(date,{...point,date});continue;}
  bucket.observed+=point.observed;
  for(const m of metricIds){
   const count=`${m}Count` as const,a=bucket[count],b=point[count],value=point[m];
   if(b&&value!==null){bucket[m]=((bucket[m]??0)*a+value*b)/(a+b);bucket[count]=a+b;}
  }
 }
 const recentFrom=shiftDay(today,-28),baselineFrom=shiftDay(today,-56);
 return {today,from,days,scale,deviations:detectDeviations(points,from),observed:selected.length,points:fillTrendBuckets([...buckets.values()],from,today,scale),comparison:{recentFrom,baselineFrom,changes:compareTrend(points.filter(p=>p.date>=recentFrom),points.filter(p=>p.date>=baselineFrom&&p.date<recentFrom))}};
}
