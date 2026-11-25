import {getChatGPTUser} from '../../chatgpt-auth';
import {loadLongTrends} from '../../../lib/trend-query';
import {validTrendRange} from '../../../lib/trend-data';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request){
 if(!await getChatGPTUser())return Response.json({error:'请先登录'},{status:401,headers});
 const range=new URL(request.url).searchParams.get('range')??'30';
 if(!validTrendRange(range))return Response.json({error:'请选择有效时间范围'},{status:400,headers});
 try{
  return Response.json(await loadLongTrends(range),{headers});
 }catch{return Response.json({error:'暂时无法读取长期记录，请重试'},{status:503,headers});}
}
