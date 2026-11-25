'use client';
import {useEffect,useState} from 'react';
import {TrendingUp} from 'lucide-react';
import MetricCard from './metric-card';
import type {CardMetric} from './metric-card';
import {metrics,metricValue} from './metrics';
import {ranges} from './model';
import type {HealthMetric,TrendPayload,TrendRange} from './model';
import type {PeriodReview} from '../analysis/period';
import {PeriodReports} from './period-reports';

const sections={overview:{label:'概览',cards:['sleepScore','steps','hrv','resting','intensity','calories','stress','floors']},recovery:{label:'睡眠与恢复',cards:['sleepScore','hrv','sleep','resting','stress']},activity:{label:'活动与消耗',cards:['steps','intensity','calories','floors']}} as const satisfies Record<string,{label:string;cards:readonly CardMetric[]}>;
type Section=keyof typeof sections;
const scaleName={day:'每天',week:'每周平均',month:'每月平均'};
const note:Partial<Record<HealthMetric,string>>={
 hrv:'可回看同期的睡眠、训练和手表佩戴情况。先观察变化是否持续。',
 sleep:'可以回看最近的作息变化，以及白天精神是否也有变化。',
 sleepScore:'可以对照睡眠时长和实际精神状态，评分是佳明的估计。',
 stress:'可以对照同期活动、睡眠与主观感受，设备压力不等同于情绪。',
 calories:'可以对照训练与步行量；这是设备估计，不直接换算成饮食目标。',
 intensity:'可以对照这段时间的运动安排，看看活动量是否真的变化。',
 resting:'可以对照同期睡眠、活动和身体感受，再看变化是否维持。',
 steps:'可以回看通勤、运动或外出安排。感觉累时，留意恢复。',
 floors:'可以回看出行或工作场所变化。设备不会据此判断你是否出差。',
};
export type TrendPanelProps={
 load:(range:TrendRange,signal:AbortSignal)=>Promise<TrendPayload>;
 loadReview?:(range:TrendRange,signal:AbortSignal)=>Promise<{reports:PeriodReview[];previous:string|null}>;
 revision?:string;
 onSettings?:()=>void;
};
export default function TrendPanel({load,loadReview,revision,onSettings}:TrendPanelProps){
 const [range,setRange]=useState<TrendRange>('30'),[section,setSection]=useState<Section>('overview');
 const [report,setReport]=useState<{reports:PeriodReview[];previous:string|null}|null>(null);
 const [payload,setPayload]=useState<TrendPayload|null>(null);
 const [error,setError]=useState(''),[reportError,setReportError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setError('');setPayload(null);
  void load(range,controller.signal).then(j=>{if(!controller.signal.aborted)setPayload(j);})
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'暂时无法读取长期记录，请重试');});
  return ()=>controller.abort();
 },[range,revision,retry,load]);
 useEffect(()=>{
  const controller=new AbortController();
  setReport(null);setReportError('');
  void loadReview?.(range,controller.signal).then(r=>{if(!controller.signal.aborted)setReport(r);})
   .catch(()=>{if(!controller.signal.aborted)setReportError('暂时无法读取已保存的 AI 复盘。');});
  return ()=>controller.abort();
 },[range,loadReview,revision,retry]);
 const changes=payload?.comparison.changes??[];
 const significant=changes.filter(c=>c.notable);
 return <section className="history" aria-label="长期趋势">
  <div className="card history-header"><div><div className="sectiontitle"><TrendingUp size={20}/><h2>健康趋势</h2></div>
   <p className="muted">{payload?`${payload.from} 起 · 已记录 ${payload.observed}/${payload.days} 天 · ${scaleName[payload.scale]}`:'按北京时间查看已结束的日历日。'}</p></div>
   <div className="statetoggle history-periods" role="group" aria-label="时间范围">{ranges.map(({id,label})=><button key={id} type="button" className={range===id?'chosen':''} aria-pressed={range===id} onClick={()=>setRange(id)}>{id==='all'?'全部':'近 '+label}</button>)}</div>
  </div>
  {error&&<div className="alert" role="alert">{error} <button className="textbutton" onClick={()=>setRetry(n=>n+1)}>重试</button></div>}
  {!error&&!payload&&<div className="card empty" role="status">正在读取长期记录…</div>}
  {payload&&(payload.observed===0?<div className="card empty"><h3>这段时间还没有健康记录</h3><p>同步到网站后，数据会出现在这里。</p>{onSettings&&<button className="primary" onClick={onSettings}>查看佳明连接</button>}</div>:<>
  {payload.deviations.lastObserved&&Date.parse(payload.today)-Date.parse(payload.deviations.lastObserved)>2*86400000&&<p className="alert">最近有记录的日期是 {payload.deviations.lastObserved}，此后的完整日历日缺少同步数据。</p>}
  <div className="health-sections" role="group" aria-label="指标分类">{(Object.keys(sections) as Section[]).map(key=><button key={key} type="button" aria-pressed={section===key} onClick={()=>setSection(key)}>{sections[key].label}</button>)}</div>
  <div className="history-grid">{sections[section].cards.map((metric,i)=><MetricCard key={metric} metric={metric} payload={payload} featured={i<2}/>)}</div>
 </>)}
 {!!payload?.observed&&<p className="muted history-note">今天未计入；缺失的日期留空。周均、月均只使用当期有记录的日期。</p>}
  <section className="card history-card"><div className="sectiontitle"><h3>和自己的平时相比</h3></div>
   <p className="muted">最近 28 天与之前 28 天比较，每段至少有 14 天有效记录才参与。这里的变化提示不代表医学异常。</p>
   {!changes.length?<p>现在的有效记录还不够做可靠比较。</p>:significant.length?<ul>{significant.map(c=>{const m=metrics[c.metric];return <li key={c.metric}><strong>{m.label}</strong>：{metricValue(c.baseline,c.metric)} → {metricValue(c.recent,c.metric)} {m.unit}（{c.baselineCount} 天 → {c.recentCount} 天）。{note[c.metric]}</li>})}</ul>:<p>已有足够记录的指标，暂未出现明显变化。</p>}
  </section>
  {loadReview&&<section className="card history-card"><h3>定期健康回顾</h3>
   {report&&<PeriodReports reports={report.reports}/>}
   {report?.previous&&<details><summary>此前保存的区间复盘</summary><p className="reporttext">{report.previous}</p></details>}
   {reportError&&<button className="textbutton" onClick={()=>setRetry(n=>n+1)}>{reportError} 重试</button>}
  </section>}
 </section>;
}
