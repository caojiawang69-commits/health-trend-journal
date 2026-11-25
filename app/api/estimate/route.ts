import {getChatGPTUser} from '../../chatgpt-auth';
import {writeAllowed} from '../../../lib/health';
import {estimateMeal} from '../../../lib/estimate';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 if(!await getChatGPTUser())return Response.json({error:'请先登录'},{status:401});
 if(!writeAllowed(req))return Response.json({error:'来源不匹配'},{status:403});
 try{const b:any=await req.json();return Response.json({estimate:await estimateMeal(b.id,b.mode==='ai'?'ai':'text')});}
 catch(e){return Response.json({error:e instanceof Error?e.message:'估算失败，请重试'},{status:400});}
}
