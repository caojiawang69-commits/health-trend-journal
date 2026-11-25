'use client';
import {useEffect,useState} from 'react';
import {entryMacro,meals as mealNames,stateLabel,foodById,sum,DayPlan,Entry,Estimate,EstItem,Targets} from '../lib/plan';
const r0=(x:number)=>Math.round(x),r1=(x:number)=>Math.round(x*10)/10;
const dayOf=(iso:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date(iso));
const timeOf=(iso:string)=>new Date(iso).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Shanghai'});
const itemName=(e:EstItem)=>{if(e.food==='custom')return e.custom?.name??'其他';const f=foodById(e.food)!;const s=stateLabel(f,e.state);return f.name+(s?` · ${s}`:'');};
const itemUnit=(e:EstItem)=>e.food==='custom'?'克':foodById(e.food)!.unit;
type Meal={id:string;type:string;occurred:string;note:string;before_key:string|null;after_key:string|null};

// 把饮食日记里的照片和备注变成营养估算；用户核对重量后计入当天记录（同一餐重复计入会覆盖）
export default function MealImport({date,plan,targets,disabled,onApply}:{date:string;plan:DayPlan;targets:Targets;disabled:boolean;onApply:(foods:Entry[])=>void}){
 const [list,setList]=useState<Meal[]>([]),[ests,setEsts]=useState<Record<string,Estimate>>({}),[rows,setRows]=useState<Record<string,EstItem[]>>({}),[ai,setAi]=useState(false),[busy,setBusy]=useState(''),[errs,setErrs]=useState<Record<string,string>>({}),[loadErr,setLoadErr]=useState('');
 useEffect(()=>{let active=true;setLoadErr('');fetch('/api/data',{cache:'no-store'}).then(async r=>{const j:any=await r.json();if(!r.ok)throw Error(j.error);if(!active)return;
  const ms:Meal[]=(j.meals??[]).filter((m:Meal)=>dayOf(m.occurred)===date).sort((a:Meal,b:Meal)=>a.occurred<b.occurred?-1:1);
  const es:Record<string,Estimate>={};for(const m of ms){const raw=j.settings?.['estimate:'+m.id];if(raw)try{es[m.id]=JSON.parse(raw);}catch{}}
  setList(ms);setEsts(es);setRows(Object.fromEntries(Object.entries(es).map(([k,v])=>[k,v.items])));setAi(!!j.aiConfigured);}).catch(e=>{if(active)setLoadErr(e.message||'读取饮食日记失败');});return()=>{active=false};},[date]);
 async function run(id:string,mode:'ai'|'text'){setBusy(id);setErrs(x=>({...x,[id]:''}));try{const r=await fetch('/api/estimate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,mode})});const j:any=await r.json();if(!r.ok)throw Error(j.error);setEsts(x=>({...x,[id]:j.estimate}));setRows(x=>({...x,[id]:j.estimate.items}));}catch(e){setErrs(x=>({...x,[id]:e instanceof Error?e.message:'估算失败'}));}finally{setBusy('');}}
 function apply(m:Meal){const items=(rows[m.id]??[]).filter(i=>i.amount>0);const meal=mealNames.includes(m.type)?m.type:'加餐';
  const entries:Entry[]=items.map((i,n)=>({id:`${m.id.slice(0,24)}-${n}-${Date.now().toString(36)}`,meal,food:i.food,state:i.state,amount:i.amount,src:m.id,...(i.custom?{custom:i.custom}:{})}));
  onApply([...plan.foods.filter(e=>e.src!==m.id),...entries]);}
 return <section className="card"><div className="sectiontitle"><h2>从饮食日记估算</h2><span>{list.length} 餐 · 核对后再计入</span></div>
 {loadErr&&<div role="alert" className="alert">{loadErr}</div>}
 {!list.length&&!loadErr&&<p className="muted">这一天还没有拍照记录。在“饮食日记”里记一餐，备注写上“米饭200g，鸡胸150g”这类重量，估算会更准。</p>}
 {list.map(m=>{const est=ests[m.id],r=rows[m.id]??[],tot=sum(r.map(i=>entryMacro({id:'',meal:'',...i},targets))),counted=plan.foods.some(e=>e.src===m.id);
  return <article key={m.id} className="importmeal"><div className="importphotos">{m.before_key?<img src={`/api/photo/${m.id}?phase=before`} alt={`${m.type}餐前照片`}/>:<span>无照片</span>}{m.after_key&&<img src={`/api/photo/${m.id}?phase=after`} alt={`${m.type}餐后照片`}/>}</div>
  <div className="importbody"><h3>{timeOf(m.occurred)} · {m.type}{counted&&<span className="pill">已计入</span>}</h3><p>{m.note||<span className="muted">没有备注</span>}</p>
  {errs[m.id]&&<div role="alert" className="alert">{errs[m.id]}</div>}
  {est&&<div className="estbox">{r.length?<table className="reversetable"><thead><tr><th>食物</th><th>重量</th><th>蛋白</th><th>碳水</th><th>脂肪</th></tr></thead><tbody>{r.map((i,n)=>{const x=entryMacro({id:'',meal:'',...i},targets);return <tr key={n}><td>{itemName(i)}<small>{i.basis==='note'?'来自备注':i.low&&i.high?`照片估计 ${i.low}–${i.high}`:'照片估计'}</small></td><td><input type="number" min="0" aria-label={`${itemName(i)}重量`} value={i.amount||''} placeholder="补重量" onChange={e=>setRows(v=>({...v,[m.id]:r.map((y,k)=>k===n?{...y,amount:e.target.value===''?0:Math.max(0,Number(e.target.value))}:y)}))}/>{itemUnit(i)}</td><td>{r1(x.protein)}</td><td>{r1(x.carbs)}</td><td>{r1(x.fat)}</td></tr>;})}</tbody></table>:null}
   <p className="muted">{est.mode==='ai'?`AI 看了 ${est.photos} 张照片`:'按备注识别'}{r.length?` · 合计蛋白质 ${r0(tot.protein)} 克、碳水 ${r0(tot.carbs)} 克、脂肪 ${r0(tot.fat)} 克`:''}{est.comment?` · ${est.comment}`:''}</p></div>}
  <div className="importactions">{est&&r.some(i=>i.amount>0)&&<button className="primary" disabled={disabled||!!busy} onClick={()=>apply(m)}>{counted?'更新当天记录':'计入当天记录'}</button>}
  <button disabled={!!busy||!ai} title={ai?'':'AI 密钥尚未接入云端'} onClick={()=>run(m.id,'ai')}>{busy===m.id?'估算中…':est?.mode==='ai'?'AI 重新估算':'AI 看照片估算'}</button>
  <button disabled={!!busy||!m.note} onClick={()=>run(m.id,'text')}>按备注识别</button></div></div></article>;})}
 <p className="muted">照片只能粗估份量，备注里写明的重量优先采用。计入后会自动保存当天记录。{!ai&&' 照片估算需要云端接入 OpenAI 密钥并有可用额度。'}</p></section>;
}
