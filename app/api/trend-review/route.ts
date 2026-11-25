import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {db,writeAllowed,setSetting} from '../../../lib/health';
import {loadLongTrends} from '../../../lib/trend-query';
import {validTrendRange} from '../../../features/trends/model';
import {createOpenAIReview,ReviewError} from '../../../features/analysis/openai';
import {reviewEvidence} from '../../../features/analysis/review';
import type {Review} from '../../../features/analysis/review';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const reply=(error:string,status:number)=>Response.json({error},{status,headers});
const storageKey=(range:string)=>'trend-review:'+range;
export async function GET(request:Request){
 if(!await getChatGPTUser())return reply('请先登录',401);
 const range=new URL(request.url).searchParams.get('range');
 if(!validTrendRange(range))return reply('请选择时间范围',400);
 try{
  const raw=await db().prepare('SELECT value FROM settings WHERE key=?').bind(storageKey(range)).first<string>('value');
  const review=raw?JSON.parse(raw) as Review:null;
  return Response.json({review,configured:!!env.OPENAI_API_KEY},{headers});
 }catch{return reply('暂时无法读取历史复盘，请重试',503);}
}
export async function POST(request:Request){
 if(!await getChatGPTUser())return reply('请先登录',401);
 if(!writeAllowed(request))return reply('请从健康网站提交',403);
 const range=new URL(request.url).searchParams.get('range');
 if(!validTrendRange(range))return reply('请选择时间范围',400);
 if(!env.OPENAI_API_KEY)return reply('网站尚未配置可用的 AI 服务。可先看个人基线和趋势图。',503);
 try{
  const data=await loadLongTrends(range);
  if(data.observed<14)return reply('至少要有 14 天的有效记录才能生成这段时间的复盘',422);
  const source='OpenAI',created=new Date().toISOString();
  const body=await createOpenAIReview(env.OPENAI_API_KEY)(reviewEvidence(data,range));
  const review={source,created,body};
  await setSetting(storageKey(range),JSON.stringify(review));
  return Response.json({review},{headers});
 }catch(e){return e instanceof ReviewError?reply(e.message,e.status):reply('复盘暂时无法生成，原记录已保留',502);}
}
