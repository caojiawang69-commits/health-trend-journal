import {db} from './health';
export async function updateMealType(id:unknown,type:unknown){
 if(typeof id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(id)||typeof type!=='string'||!['早餐','午餐','晚餐','加餐','饮料'].includes(type))return Response.json({error:'餐次无效'},{status:400});
 const found=await db().prepare('SELECT id FROM meals WHERE id=?').bind(id).first();
 if(!found)return Response.json({error:'记录不存在'},{status:404});
 await db().prepare('UPDATE meals SET type=? WHERE id=?').bind(type,id).run();
 return Response.json({saved:true,id,type});
}
