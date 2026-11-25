import {db,localDate} from './health';
import {readWithRetry} from './read-retry';
import {shiftDay} from './garmin-schedule';
import {metricIds,fillTrendBuckets} from './trend-data';
import {compareTrend} from '../features/analysis/compare';
import {detectDeviations} from '../features/analysis/deviations';
import type {TrendPayload,TrendPoint,TrendRange,TrendScale} from './trend-data';

const hasWellness="coalesce(json_extract(payload,'$.includesWellnessData'),1)<>0";
const metricPaths=[
 ['hrv','hrv','$.lastNightAvg',1,1,500],
 ['sleep','sleep','$.sleepTimeSeconds',1,3600,86400],
 ['sleepScore','sleep','$.sleepScores.overall.value',0,1,100],
 ['deep','sleep','$.deepSleepSeconds',0,3600,86400],
 ['light','sleep','$.lightSleepSeconds',0,3600,86400],
 ['rem','sleep','$.remSleepSeconds',0,3600,86400],
 ['awake','sleep','$.awakeSleepSeconds',0,3600,86400],
 ['resting','summary','$.heartRate.restingValue',1,1,300],
 ['heartMin','summary','$.heartRate.minValue',1,1,300],
 ['heartMax','summary','$.heartRate.maxValue',1,1,300],
 ['steps','summary','$.movement.steps.value',0,1,200000],
 ['stepGoal','summary','$.movement.steps.goal',1,1,200000],
 ['distance','summary','$.movement.steps.distanceInMeters',0,1000,500000],
 ['floors','summary','$.movement.floorsAscended.value',0,1,2000],
 ['calories','summary','$.calories.burnedTotal',1,1,15000],
 ['activeCalories','summary','$.calories.burnedActive',0,1,10000],
 ['restCalories','summary','$.calories.burnedResting',1,1,10000],
 ['stress','summary','$.stress.avgLevel',0,1,100],
] as const;
const intensity=(field:'moderate'|'vigorous')=>`json_extract(payload,'$.intensityMinutes.${field}')`;
const [moderate,vigorous]=[intensity('moderate'),intensity('vigorous')];
const stages=['deep','light','rem','awake'] as const;
const stageConditions=stages.map(stage=>{const v=`json_extract(payload,'$.${stage}SleepSeconds')`;return `typeof(${v}) IN ('integer','real') AND ${v} BETWEEN 0 AND 86400`;}).join(' AND ');
// One reading per metric per day, then one row per plotted bucket.
const daily=metricPaths.map(([name,kind,path,min,div,max])=>{
 const val=`json_extract(payload,'${path}')`;
 const isStage=stages.some(stage=>stage===name);
 return `max(CASE WHEN kind='${kind}' AND ${kind==='summary'?hasWellness+' AND ':''}${isStage?stageConditions+' AND ':''}typeof(${val}) IN ('integer','real') AND ${val} BETWEEN ${min} AND ${max} THEN ${val}/${div}.0 END) AS ${name}`;
}).join(',')+`,max(CASE WHEN kind='summary' AND ${hasWellness} AND typeof(${moderate}) IN ('integer','real') AND typeof(${vigorous}) IN ('integer','real') AND ${moderate} BETWEEN 0 AND 1440 AND ${vigorous} BETWEEN 0 AND 1440 THEN ${moderate}+2*${vigorous} END) AS intensity`;
const aggregates=metricIds.map(m=>`avg(${m}) AS ${m},count(${m}) AS ${m}Count`).join(',');
const kinds="kind IN ('summary','sleep','hrv')";
const knownDays='count(*) FILTER (WHERE '+metricIds.map(m=>m+' IS NOT NULL').join(' OR ')+')';
function readBuckets(from:string,today:string,scale:TrendScale){
 const bucket=scale==='month'?"date(date,'start of month')":scale==='week'?"date(date,'-6 days','weekday 1')":"date";
 return readWithRetry(()=>db().prepare(`WITH readings AS (
  SELECT date,${daily} FROM health WHERE date>=? AND date<? AND ${kinds} AND json_valid(payload) GROUP BY date)
  SELECT ${bucket} AS bucket,${aggregates},${knownDays} AS observed
  FROM readings GROUP BY bucket ORDER BY bucket`).bind(from,today).all<Omit<TrendPoint,'date'>&{bucket:string}>())
 .then(r=>r.results.map(({bucket,...row})=>({...row,date:bucket})));
}
export async function readDailyRange(from:string,endExclusive:string){
 const all:TrendPoint[]=[];
 for(let start=from;start<endExclusive;start=shiftDay(start,180)){
  const next=shiftDay(start,180);
  all.push(...await readBuckets(start,next<endExclusive?next:endExclusive,'day'));
 }
 return all;
}
export async function loadLongTrends(range:TrendRange):Promise<TrendPayload>{
 const today=localDate(),recentFrom=shiftDay(today,-28),baselineFrom=shiftDay(today,-56);
 const scale:TrendScale=range==='all'||range==='365'?'month':range==='180'?'week':'day';
 const from=range==='all'?(await readWithRetry(()=>db().prepare(`SELECT min(date) AS firstDate FROM health WHERE date<? AND ${kinds}`).bind(today).first<string>('firstDate')))??shiftDay(today,-30):shiftDay(today,-Number(range));
 const warmup=shiftDay(from,-28);
 const samples=await readDailyRange(warmup<baselineFrom?warmup:baselineFrom,today);
 const comparisonRows=samples.filter(p=>p.date>=baselineFrom);
 const rows=scale==='day'?samples.filter(p=>p.date>=from):await readBuckets(from,today,scale);
 const deviations=detectDeviations(samples,from);
 const days=Math.round((Date.parse(today)-Date.parse(from))/86_400_000);
 const changes=compareTrend(comparisonRows.filter(p=>p.date>=recentFrom),comparisonRows.filter(p=>p.date<recentFrom));
 return {today,from,scale,days,deviations,observed:rows.reduce((sum,r)=>sum+r.observed,0),points:fillTrendBuckets(rows,from,today,scale),comparison:{recentFrom,baselineFrom,changes}};
}
