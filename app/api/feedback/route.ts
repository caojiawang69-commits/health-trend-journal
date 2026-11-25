import {getChatGPTUser} from '../../chatgpt-auth';
import {writeAllowed} from '../../../lib/health';
import {generateFeedback} from '../../../lib/feedback';
export async function POST(req:Request){
 if(!await getChatGPTUser())return Response.json({error:'请先登录'},{status:401});
 if(!writeAllowed(req))return Response.json({error:'来源不匹配'},{status:403});
 try{const body:any=await req.json();return Response.json(await generateFeedback(body.date));}
 catch(e){return Response.json({error:e instanceof Error?e.message:'生成失败，请重试'},{status:502});}
}
