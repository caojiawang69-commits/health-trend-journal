import {env} from 'cloudflare:workers';
export const db=()=>{if(!env.DB)throw new Error('数据库尚未连接');return env.DB;};
export function localDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export async function setSetting(key:string,value:string){await db().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,value).run();}
export async function saveHealth(date:string,kind:string,payload:unknown){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;await db().prepare('INSERT INTO health(id,date,kind,payload,updated) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated').bind(`${kind}:${date}`,date,kind,JSON.stringify(payload),new Date().toISOString()).run();}
export const getSetting=(key:string)=>db().prepare('SELECT value FROM settings WHERE key=?').bind(key).first<string>('value');
export function healthWrite(date:string,kind:string,payload:unknown,at:string){
 return db().prepare('INSERT INTO health(id,date,kind,payload,updated) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated').bind(`${kind}:${date}`,date,kind,JSON.stringify(payload),at);
}
export function writeAllowed(request:Request){return request.headers.get('origin')===new URL(request.url).origin;}
