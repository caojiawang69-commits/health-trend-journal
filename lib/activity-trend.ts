type ActivityRow={date:string;kind:string;payload?:{movement?:{steps?:{value?:unknown};floorsAscended?:{value?:unknown}};includesWellnessData?:boolean}};
type Point={date:string;steps:number|null;floors:number|null};
const value=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
function minus(day:string,days:number){return new Date(Date.parse(day+'T00:00:00Z')-days*86_400_000).toISOString().slice(0,10);}
function median(values:number[]){const v=values.toSorted((a,b)=>a-b),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;}
export function activityTrend(rows:ActivityRow[],date:string,today:string){
 const last=date>=today?minus(today,1):date;
 const byDay=new Map<string,Point>();
 for(const r of rows){if(r.kind!=='summary'||r.date>last||r.date<minus(last,30)||r.payload?.includesWellnessData===false)continue;
  const m=r.payload?.movement;byDay.set(r.date,{date:r.date,steps:value(m?.steps?.value),floors:value(m?.floorsAscended?.value)});
 }
 const days=[last,minus(last,1),minus(last,2)];
 const recent=days.flatMap(d=>byDay.has(d)?[byDay.get(d)!]:[]);
 const comparison=Array.from(byDay.values()).filter(p=>p.date<days[2]);
 const metric=(key:'steps'|'floors')=>comparison.flatMap(p=>p[key]===null?[]:[p[key]]);
 // A zero step total is not useful as a comparison for a normal day; zero floors with recorded steps is valid.
 const steps=metric('steps').filter(n=>n>0);
 const floors=comparison.flatMap(p=>p.floors!==null&&p.steps!==null&&p.steps>0?[p.floors]:[]);
 const typicalSteps=steps.length>=7?median(steps):null,typicalFloors=floors.length>=7?median(floors):null;
 const highSteps=(p:Point)=>p.steps!==null&&p.steps>0&&typicalSteps!==null&&p.steps>=Math.max(typicalSteps*1.3,typicalSteps+2000);
 const highFloors=(p:Point)=>p.floors!==null&&p.steps!==null&&p.steps>0&&typicalFloors!==null&&p.floors>=Math.max(typicalFloors*1.5,typicalFloors+4);
 const elevated=recent.filter(p=>highSteps(p)||highFloors(p));
 return {recent,typicalSteps,typicalFloors,alert:elevated.length>=2&&elevated[0].date>=days[1],elevatedDays:elevated.length};
}
