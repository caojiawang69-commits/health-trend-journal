import {getChatGPTUser} from '../../chatgpt-auth';
import {getSetting} from '../../../lib/health-store';
import {recentPeriodReviews} from '../../../lib/period-reviews';
import {validTrendRange} from '../../../lib/trend-data';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const headers={'Cache-Control':'no-store'};
 if(!await getChatGPTUser())return Response.json({error:'请先登录'},{status:401,headers});
 const range=new URL(request.url).searchParams.get('range');
 if(!validTrendRange(range))return Response.json({error:'时间范围无效'},{status:400,headers});
 try{
  const [reports,old]=await Promise.all([recentPeriodReviews(),getSetting('trend-review:'+range)]);
  return Response.json({reports,previous:old?JSON.parse(old).body:null},{headers});
 }catch{return Response.json({error:'暂时无法读取回顾'},{status:503,headers});}
}
