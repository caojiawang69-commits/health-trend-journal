import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {db,snapshot,writeAllowed} from '../../../lib/health';
import {readFailure} from '../../../lib/read-retry';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){if(!await getChatGPTUser())return json({error:'请先登录'},401);try{return json(await snapshot());}catch(e){return json({error:readFailure(e)},503);}}
export async function POST(req:Request){
 if(!await getChatGPTUser())return json({error:'请先登录'},401);if(!writeAllowed(req))return json({error:'来源不匹配'},403);
 try{
 const data=await req.formData();const id=String(data.get('id')||crypto.randomUUID());if(!/^[a-zA-Z0-9-]{1,64}$/.test(id))return json({error:'记录编号无效'},400);
 const type=String(data.get('type')||'');if(!['早餐','午餐','晚餐','加餐','饮料'].includes(type))return json({error:'请选择餐次'},400);
 const when=String(data.get('occurred')||'');const time=new Date(when);if(!Number.isFinite(time.valueOf()))return json({error:'请填写有效时间'},400);
 const phase=String(data.get('phase'));if(!['before','after'].includes(phase))return json({error:'请选择餐前或餐后'},400);
 const file=data.get('photo');if(!(file instanceof File)||!file.size)return json({error:'请拍照或选择照片'},400);
 if(file.size>12*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))return json({error:'请选择不超过12MB的 JPG、PNG 或 WebP 图片'},400);
 const existing=await db().prepare('SELECT * FROM meals WHERE id=?').bind(id).first<any>();
 if(phase==='after'&&!existing)return json({error:'请先选择一条已保存的餐前记录'},400);
 if(phase==='before'&&existing)return json({error:'这条餐前记录已保存，请勿重复提交'},409);
 if(phase==='after'&&existing?.after_key)return json({error:'这餐已经有餐后照片'},409);
 if(!env.BUCKET)throw new Error('照片存储未连接');
 const key=`meals/${id}/${phase}-${crypto.randomUUID()}`;await env.BUCKET.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});
 try{
 if(existing){await db().prepare('UPDATE meals SET after_key=?,after_occurred=?,note=? WHERE id=?').bind(key,time.toISOString(),[existing.note,String(data.get('note')||'').slice(0,2000)].filter(Boolean).join('\n餐后：'),id).run();}
 else{await db().prepare('INSERT INTO meals(id,type,occurred,timezone,note,before_key,created) VALUES(?,?,?,?,?,?,?)').bind(id,type,time.toISOString(),String(data.get('timezone')||'Asia/Shanghai').slice(0,80),String(data.get('note')||'').slice(0,2000),key,new Date().toISOString()).run();}
 }catch(e){await env.BUCKET.delete(key);throw e;}
 return json({id,saved:true});
 }catch{return json({error:'保存失败，照片尚未确认入库。请重试。'},500);}
}
