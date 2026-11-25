import {summarizeTrend} from '../trends/model';
import type {TrendChange,TrendPoint} from '../trends/model';
const thresholds=[
 ['hrv',5,0.1],['sleep',0.4,0.08],['sleepScore',8,0.1],['resting',3,0.06],['steps',1500,0.2],
 ['floors',3,0.35],['intensity',10,0.25],['calories',200,0.12],['stress',6,0.18],
] as const;
export function compareTrend(recent:TrendPoint[],baseline:TrendPoint[]):TrendChange[]{
 return thresholds.flatMap(([metric,minimum,relative])=>{
  const a=summarizeTrend(recent,metric),b=summarizeTrend(baseline,metric);
  if(a.count<14||b.count<14||a.average===null||b.average===null)return [];
  const delta=a.average-b.average;
  return [{metric,recent:a.average,baseline:b.average,recentCount:a.count,baselineCount:b.count,delta,notable:Math.abs(delta)>=Math.max(minimum,Math.abs(b.average)*relative)}];
 });
}
