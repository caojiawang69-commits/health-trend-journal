export {PersonalAccount} from './accounts';
import {accountRequest} from './accounts';
import handler from 'vinext/server/fetch-handler';
import {timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';
function matches(actual:string,expected:string){
 const a=Buffer.from(actual),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export default {
 async scheduled(controller:ScheduledController){
  const {runScheduledGarmin}=await import('../lib/health');
  await runScheduledGarmin(controller.scheduledTime,controller.cron);
 },
 async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
  const path=new URL(request.url).pathname;
  if(path.startsWith('/account/')) return accountRequest(request,env);
  if (['GET','HEAD'].includes(request.method) && ['/demo','/demo/'].includes(path)) return handler.fetch(request,env,ctx);
  if (path==='/' && !env.DB && request.method==='GET') return Response.redirect(new URL('/account/space',request.url).href,302);
  const service=path==='/mcp'||path==='/api/service';
  const secret=service?env.SERVICE_TOKEN:env.OWNER_PASSWORD;
  if(!secret||secret.length<24)return new Response('Configure private access before using this instance.',{status:503});
  const expected=service?'Bearer '+secret:'Basic '+Buffer.from('owner:'+secret).toString('base64');
  if(!matches(request.headers.get('authorization')??'',expected))return new Response('Authentication required',{status:401,headers:{'WWW-Authenticate':service?'Bearer':'Basic realm="Health journal", charset="UTF-8"','Cache-Control':'no-store'}});
  if(!service&&!['GET','HEAD','OPTIONS'].includes(request.method)&&request.headers.get('origin')!==new URL(request.url).origin)return new Response('Check the request origin',{status:403});
  const headers=new Headers(request.headers);
  headers.delete('authorization');
  for(const key of [...headers.keys()])if(key.startsWith('oai-authenticated-user-'))headers.delete(key);
  headers.set('oai-authenticated-user-id','owner');
  headers.set('oai-authenticated-user-email','owner@localhost.invalid');
  return handler.fetch(new Request(request,{headers}),env,ctx);
 }
};
