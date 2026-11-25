import {DurableObject} from 'cloudflare:workers';
import {Buffer} from 'node:buffer';
import {timingSafeEqual} from 'node:crypto';
import {accountForm,personalPage,type Reading} from './account-pages';
import {exchangePersonalKey,garminClient} from '../features/garmin/client';
import {shiftDay} from '../lib/calendar';

const cookie='__Host-health_session';
const lifetime=60*60*24*7;
const usernamePattern=/^[a-z0-9_]{3,32}$/;
const random=(size:number)=>Buffer.from(crypto.getRandomValues(new Uint8Array(size))).toString('hex');
const digest=async(text:string)=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).toString('hex');
async function passwordHash(password:string,salt:string) {
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:Buffer.from(salt,'hex'),iterations:100000},material,256);
  return Buffer.from(bits);
}
function redirect(location:string,session?:string,maxAge=lifetime) {
  const headers=new Headers({Location:location,'Cache-Control':'no-store'});
  if(session!==undefined) headers.set('Set-Cookie',cookie+'='+session+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge);
  return new Response(null,{status:303,headers});
}
type StoredAccount={username:string;hash:string;salt:string};
export class PersonalAccount extends DurableObject<Cloudflare.Env> {
  async fetch(request:Request) {
    const path=new URL(request.url).pathname;
    const storage=this.ctx.storage;
    const registered=await storage.get<StoredAccount>('account');
    if(request.method==='POST' && (path==='/account/register'||path==='/account/login')) {
      const form=await request.formData();
      const register=path==='/account/register';
      const username=String(form.get('username')).trim().toLowerCase();
      const password=String(form.get('password'));
      if(!usernamePattern.test(username)||password.length>128||(register&&password.length<12)) return accountForm(register,'请检查用户名和密码长度。',400);
      const salt=registered?.salt??random(16);
      const hash=await passwordHash(password,salt);
      if(register) {
        const created=await storage.transaction(async tx=>{
          if(await tx.get('account')) return false;
          await tx.put('account',{username,salt,hash:hash.toString('hex')});
          return true;
        });
        if(!created)return accountForm(true,'该用户名已被使用。',409);
      } else if(!registered||!timingSafeEqual(hash,Buffer.from(registered.hash,'hex'))) {
        return accountForm(false,'用户名或密码有误。',401);
      }
      const token=random(32);
      const sql=storage.sql;
      sql.exec('CREATE TABLE IF NOT EXISTS sessions (key TEXT PRIMARY KEY, expires INTEGER NOT NULL)');
      sql.exec('DELETE FROM sessions WHERE expires<=?',Date.now());
      sql.exec('INSERT INTO sessions VALUES (?,?)',await digest(token),Date.now()+lifetime*1000);
      return redirect('/account/space',username+'.'+token);
    }
    if(!registered)return redirect('/account/login','',0);
    const tokenHash=await digest(request.headers.get('x-session-token')??'');
    if(!storage.sql.exec('SELECT 1 FROM sessions WHERE key=? AND expires>?',tokenHash,Date.now()).toArray().length)return redirect('/account/login','',0);
    if(request.method==='POST'&&path==='/account/logout'){
      storage.sql.exec('DELETE FROM sessions WHERE key=?',tokenHash);
      return redirect('/account/login','',0);
    }
    if(request.method==='POST'&&path==='/account/note'){
      const note=String((await request.formData()).get('note')??'');
      if(note.length>600)return new Response('备注过长',{status:400});
      await storage.put('note',note);
      return redirect('/account/space?s=saved');
    }
    if(request.method==='POST'&&path==='/account/import'){
      const key=String((await request.formData()).get('key')??'').trim();
      if(!key||key.length>1024||/[\r\n]/.test(key))return redirect('/account/space?s=key');
      try {
        const token=await exchangePersonalKey(key);
        if(!token)return redirect('/account/space?s=key');
        const client=garminClient(token);
        const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        const from=shiftDay(today,-30),to=shiftDay(today,-1);
        const [daily,sleep]=await Promise.all([client.summaries(from,to),client.sleep(from,to)]);
        if(!Array.isArray(daily?.data)||!Array.isArray(sleep))throw new Error('Invalid response');
        const values=new Map<string,Reading>();
        const add=(day:string,metric:'steps'|'sleep',value:unknown)=>{
          if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<from||day>to||typeof value!=='number'||!Number.isFinite(value)||value<0||(metric==='sleep'&&value===0))return;
          const row=values.get(day)??{day,steps:null,sleep:null};row[metric]=value;values.set(day,row);
        };
        for(const row of daily.data)if(row?.includesWellnessData!==false)add(row?.calendarDate,'steps',row?.movement?.steps?.value);
        for(const row of sleep)add(row?.calendarDate,'sleep',row?.sleepTimeSeconds);
        storage.transactionSync(()=>{
          storage.sql.exec('CREATE TABLE IF NOT EXISTS readings (day TEXT PRIMARY KEY,steps INTEGER,sleep INTEGER)');
          for(const r of values.values())storage.sql.exec('INSERT INTO readings VALUES(?,?,?) ON CONFLICT(day) DO UPDATE SET steps=coalesce(excluded.steps,steps),sleep=coalesce(excluded.sleep,sleep)',r.day,r.steps,r.sleep);
        });
        return redirect('/account/space?s='+(values.size?'imported':'empty'));
      }catch{return redirect('/account/space?s=failed');}
    }
    if(request.method!=='GET'||path!=='/account/space')return new Response(null,{status:404});
    storage.sql.exec('CREATE TABLE IF NOT EXISTS readings (day TEXT PRIMARY KEY,steps INTEGER,sleep INTEGER)');
    const messages:Record<string,string>={saved:'备注已保存。',key:'佳明未接受这把密钥，请检查后重试。',empty:'已连接佳明，该账号在所选日期内没有可导入的记录。',failed:'本次导入未完成，请稍后重试。',imported:'导入完成。'};
    const rows=storage.sql.exec<Reading>('SELECT * FROM readings ORDER BY day DESC LIMIT 30').toArray();
    return personalPage(registered.username,rows,await storage.get<string>('note')??'',Object.hasOwn(messages, new URL(request.url).searchParams.get('s')??'') ? messages[new URL(request.url).searchParams.get('s')!] : '');
  }
}

export async function accountRequest(request:Request,env:Cloudflare.Env) {
  const url=new URL(request.url),path=url.pathname;
  const ns=env.PERSONAL_ACCOUNTS;
  if(!ns)return new Response('账号服务尚未配置',{status:503});
  const register=path==='/account/register',login=path==='/account/login';
  const session=request.headers.get('Cookie')?.split(/;\s*/).find(part=>part.startsWith(cookie+'='))?.slice(cookie.length+1)??'';
  const [user,token]=session.split('.');
  if(request.method==='GET'&&(login||register))return accountForm(register);
  if(request.method==='POST'){
    if(request.headers.get('Origin')!==url.origin)return new Response('来源校验失败',{status:403});
    if(!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded'))return new Response(null,{status:415});
    if(Number(request.headers.get('Content-Length')??0)>8192)return new Response(null,{status:413});
    if(login||register){
      const limit=await env.ACCOUNT_LIMIT?.limit({key:request.headers.get('CF-Connecting-IP')??'local'});
      if(limit&&!limit.success)return accountForm(register,'尝试次数较多，请一分钟后重试。',429);
      const form=await request.clone().formData();
      const name=String(form.get('username')??'').trim().toLowerCase();
      if(!usernamePattern.test(name))return accountForm(register,'请输入有效用户名。',400);
      return ns.get(ns.idFromName(name)).fetch(request);
    }
  }
  if(!usernamePattern.test(user)||!token||!/^[a-f0-9]{64}$/.test(token))return redirect('/account/login');
  const headers=new Headers(request.headers);headers.set('x-session-token',token);
  return ns.get(ns.idFromName(user)).fetch(new Request(request,{headers}));
}
