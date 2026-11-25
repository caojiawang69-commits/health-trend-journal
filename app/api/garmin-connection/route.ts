import {getChatGPTUser} from '../../chatgpt-auth';
import {connectGarmin,writeAllowed} from '../../../lib/health';


const reply=(message:string,status:number)=>Response.json({message},{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 if(!await getChatGPTUser())return reply('请先登录生活与健康',401);
 if(!writeAllowed(request))return reply('请从生活与健康页面提交',403);
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return reply('提交格式不正确',415);
 if(Number(request.headers.get('content-length'))>4096||!request.body)return reply('提交格式不正确',400);
 const reader=request.body.getReader();
 const decoder=new TextDecoder();
 let size=0,body='';
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return reply('提交内容过长',413);}body+=decoder.decode(value,{stream:true});}
  body+=decoder.decode();
  const {key,provider}=JSON.parse(body)??{};
  if(typeof key!=='string'||!key.trim()||key.length>512||/[\r\n]/.test(key))return reply('请输入所选服务的 API 密钥',400);
  const result=await connectGarmin(key,provider);
  if(result==='source_conflict')return reply('当前数据库已绑定其他数据源',409);
  if(result==='not_configured')return reply('网站暂时无法保存连接，请稍后重试',503);
  if(result==='rejected')return reply('数据源拒绝了这把密钥，请确认它仍有效并属于正在使用的账号',422);
  if(result==='encryption_failed')return reply('网站无法加密保存密钥，请联系维护人员',503);
  if(result==='storage_unavailable')return reply('数据源已通过验证，但暂时无法保存，请稍后重试',503);
  if(result==='provider_unavailable')return reply('暂时无法连接数据源服务器，请稍后重试',502);
  return reply('数据源已连接',200);
 }catch(e){
  return e instanceof SyntaxError?reply('提交格式不正确',400):reply('暂时无法建立数据源连接，请稍后重试',502);
 }
}
