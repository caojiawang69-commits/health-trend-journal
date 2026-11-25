import {getChatGPTUser} from '../../chatgpt-auth';
import {db,setSetting,writeAllowed} from '../../../lib/health';
import {validDate,validPlan,validTargets,normalizePlan} from '../../../lib/plan';
import {readWithRetry,readFailure} from '../../../lib/read-retry';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 if(!await getChatGPTUser())return Response.json({error:'请先登录'},{status:401});
 const date=new URL(req.url).searchParams.get('date');if(!validDate(date))return Response.json({error:'日期无效'},{status:400});
 try{
  const read=(key:string)=>db().prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{value:string}>();
  const [row,t]=await readWithRetry(()=>Promise.all([read('plan:'+date),read('plan:targets')]));
  return Response.json({plan:row?normalizePlan(JSON.parse(row.value)):null,targets:t?JSON.parse(t.value):null},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:readFailure(e)},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export async function POST(req:Request){
 if(!await getChatGPTUser())return Response.json({error:'请先登录'},{status:401});
 if(!writeAllowed(req))return Response.json({error:'来源不匹配'},{status:403});
 try{const b:any=await req.json();
 if(b.targets!==undefined){
  if(!validTargets(b.targets))return Response.json({error:'请检查目标数值'},{status:400});
  const {high,medium,low,ratios}=b.targets;const pick=(m:any)=>({carbs:m.carbs,protein:m.protein,fat:m.fat});
  const targets={high:pick(high),medium:pick(medium),low:pick(low),ratios:{rice:ratios.rice,noodle:ratios.noodle}};
  await setSetting('plan:targets',JSON.stringify(targets));return Response.json({saved:true,targets});
 }
 if(!validDate(b.date)||!validPlan(b.plan))return Response.json({error:'请检查日期、计划、食物和测量数值'},{status:400});
 const {mode,focus,status,note,weight,waist}=b.plan;const foods=(b.plan.foods??[]).map(({id,meal,food,state,amount,custom,src}:any)=>({id,meal,food,state,amount,...(food==='custom'?{custom:{name:custom.name,protein:custom.protein,carbs:custom.carbs,fat:custom.fat}}:{}),...(src?{src}:{})}));
 const plan={mode,focus,status,note,weight,waist,foods,updated:new Date().toISOString()};await setSetting('plan:'+b.date,JSON.stringify(plan));return Response.json({saved:true,plan});
 }catch{return Response.json({error:'保存失败，请重试'},{status:503});}
}
