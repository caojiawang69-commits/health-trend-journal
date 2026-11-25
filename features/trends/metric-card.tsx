'use client';
import {useId,useState} from 'react';
import {Activity,Flame,Footprints,Heart,Layers,Moon,Timer,Waves} from 'lucide-react';
import {Bar,BarChart,CartesianGrid,Line,LineChart,ReferenceDot,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {summarizeTrend,monthStart,weekStart} from './model';
import type {HealthMetric,MetricSeries} from './model';
import {metrics,metricValue} from './metrics';

const icons={hrv:Activity,sleep:Moon,sleepScore:Moon,resting:Heart,steps:Footprints,floors:Layers,intensity:Timer,calories:Flame,stress:Waves};
export type CardMetric=keyof typeof icons;
const companions:Partial<Record<CardMetric,HealthMetric[]>>={
 sleepScore:['sleep'],steps:['stepGoal','distance'],resting:['heartMin','heartMax'],calories:['activeCalories','restCalories'],
};
const lines:Partial<Record<CardMetric,HealthMetric[]>>={steps:['stepGoal'],calories:['activeCalories','restCalories']};
const stages=['deep','light','rem','awake'] as const;
function labelDate(date:string,scale:MetricSeries['scale']){
 return scale==='month'?date.slice(0,7):date.slice(5).replace('-','/');
}
type MetricCardProps={metric:CardMetric;payload:MetricSeries;featured?:boolean;baselineDescription?:string};
export default function MetricCard({metric,payload,featured=false,baselineDescription='此前 28 天的中位数'}:MetricCardProps){
 const id=useId(),{label,unit,color}=metrics[metric],Icon=icons[metric];
 const {points,scale}=payload,stats=summarizeTrend(points,metric);
 const [limit,setLimit]=useState(10);
 const flagged=payload.deviations.flags.filter(f=>f.metric===metric).reverse();
 const buckets=new Set(flagged.map(f=>scale==='month'?monthStart(f.date):scale==='week'?weekStart(f.date):f.date));
 const assessed=payload.deviations.assessed[metric];
 const step=Math.ceil(points.length/4)||1;
 const ticks=points.filter((_,i)=>i===0||i===points.length-1||i%step===0&&i<points.length-2).map(p=>p.date);
 const summaries=(companions[metric]??[]).map(key=>({key,...summarizeTrend(points,key)}));
 const rangeLabel=(d:unknown)=>scale==='week'?'当周自 '+String(d):scale==='month'?String(d).slice(0,7):String(d);
 const stagePresent=points.some(point=>stages.every(stage=>point[stage]!==null));
 return <section className={'card history-card health-metric'+(featured?' health-metric-featured':'')} aria-labelledby={id}>
  <div className="sectiontitle"><Icon size={21} style={{color}} aria-hidden="true"/><h3 id={id}>{label}</h3></div>
  {stats.average===null?<p className="muted">这段时间没有可用的{label}记录。</p>:<>
   <div className="health-metric-readings"><div className="health-main-value"><strong>{metricValue(stats.average,metric)}</strong><span>{unit}</span><small>日均 · {stats.count}/{payload.days} 天</small></div>
    {summaries.filter(s=>s.average!==null).map(s=><div className="health-secondary" key={s.key}><strong style={(lines[metric]??[]).includes(s.key)?{color:metrics[s.key].color}:undefined}>{metricValue(s.average!,s.key)} <span>{metrics[s.key].unit}</span></strong><small>平均{metrics[s.key].label}</small></div>)}
   </div>
   <div className="history-chart"><ResponsiveContainer width="100%" height={featured?202:158}><LineChart data={points} margin={{top:12,right:13,bottom:6,left:0}} accessibilityLayer>
    <CartesianGrid vertical={false} stroke="#e9edf0" strokeDasharray="3 4"/>
    <XAxis dataKey="date" ticks={ticks} tickFormatter={d=>labelDate(d,scale)} tick={{fontSize:11}} tickLine={false} axisLine={{stroke:'#e0e4e8'}} minTickGap={12}/>
    <YAxis width={42} tick={{fontSize:11}} tickLine={false} axisLine={false} domain={metric==='sleepScore'||metric==='stress'?[0,100]:metric==='resting'||metric==='hrv'?['auto','auto']:[0,'auto']}/>
    <Tooltip filterNull={false} labelFormatter={rangeLabel} formatter={(value,key)=>{const id=key as HealthMetric;return [typeof value==='number'?metricValue(value,id)+' '+metrics[id].unit:'无记录',metrics[id].label];}}/>
    <Line dataKey={metric} stroke={color} strokeWidth={2.2} dot={points.length<=31||stats.count<points.length/2?{r:2,strokeWidth:0,fill:color}:false} activeDot={{r:4}} isAnimationActive={false} connectNulls={false}/>
    {(lines[metric]??[]).map(k=><Line key={k} dataKey={k} stroke={metrics[k].color} strokeWidth={1.5} strokeDasharray={k==='stepGoal'?'5 4':undefined} dot={false} isAnimationActive={false} connectNulls={false}/>)}
    {points.filter(p=>buckets.has(p.date)&&p[metric]!==null).map(p=><ReferenceDot key={p.date} x={p.date} y={p[metric]!} r={4.5} fill="#fff" stroke="#a14c00" strokeWidth={2.5}/>)}
   </LineChart></ResponsiveContainer></div>
   {flagged.length?<details className="sleep-details"><summary>偏离个人基线 · {flagged.length} 天</summary>
    <p className="health-metric-note">{scale==='day'?'橙色圆点标出偏离的日期。':'橙色圆点表示这个周期内有偏离的日期，曲线显示周期平均值。'}以下按日期列出实测值和{baselineDescription}。</p>
    <ul>{flagged.slice(0,limit).map(f=><li key={f.date}>{f.date} · <strong>{metricValue(f.value,metric)} {unit}</strong>，平时 {metricValue(f.median,metric)} {unit}（{f.samples} 天）</li>)}</ul>
    {limit<flagged.length&&<button className="textbutton" onClick={()=>setLimit(n=>n+20)}>显示更多日期</button>}
   </details>:<p className="health-metric-note">{assessed?`已比较 ${assessed} 天，未触发偏离标记。`:'当前日期缺少足够的个人基线。'}</p>}
   {metric==='steps'&&summaries.some(x=>x.key==='stepGoal'&&x.count>0)&&<p className="health-metric-note">灰色虚线是佳明记录的步数目标。</p>}
   {metric==='intensity'&&<p className="health-metric-note">按佳明口径：中等强度分钟 + 2 × 高强度分钟。</p>}
   {metric==='calories'&&<p className="health-metric-note">佳明估算的消耗，非饮食热量目标。</p>}
   {metric==='sleepScore'&&stagePresent&&<details className="sleep-details"><summary>查看睡眠阶段时长</summary>
    <div className="health-stage-legend">{stages.map(k=><span key={k}><i style={{backgroundColor:metrics[k].color}}/>{metrics[k].label}</span>)}</div>
    <ResponsiveContainer width="100%" height={160}><BarChart data={points} margin={{top:8,right:13,bottom:6,left:0}} accessibilityLayer>
     <CartesianGrid vertical={false} stroke="#e9edf0"/><XAxis dataKey="date" ticks={ticks} tickFormatter={d=>labelDate(d,scale)} tick={{fontSize:11}} tickLine={false}/><YAxis width={42} tick={{fontSize:11}} unit="h"/>
     <Tooltip labelFormatter={rangeLabel} formatter={(value,key)=>[typeof value==='number'?metricValue(value,key as HealthMetric)+' 小时':'无记录',metrics[key as HealthMetric].label]}/>
     {stages.map(k=><Bar key={k} dataKey={k} stackId="sleep" fill={metrics[k].color} isAnimationActive={false}/>)}
    </BarChart></ResponsiveContainer>
    <p className="health-metric-note">按夜或按周期平均；仅使用四个阶段均有记录的夜晚。</p>
   </details>}
  </>}
 </section>;
}
