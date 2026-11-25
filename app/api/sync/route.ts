import {getChatGPTUser} from '../../chatgpt-auth';
import {syncGarmin,writeAllowed} from '../../../lib/health';
export async function POST(req:Request){if(!await getChatGPTUser())return Response.json({error:'请先登录'},{status:401});if(!writeAllowed(req))return Response.json({error:'来源不匹配'},{status:403});try{return Response.json(await syncGarmin());}catch(e){return Response.json({error:e instanceof Error?e.message:'同步失败'},{status:502});}}
