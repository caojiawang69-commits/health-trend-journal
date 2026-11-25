'use client';
import {useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {ArrowUpRight,RefreshCw} from 'lucide-react';

export default function GarminConnection({configured,onSaved,provider:initialProvider='garmin',options=['garmin']}:{options?:string[];provider?:string;configured:boolean;onSaved:()=>Promise<void>}){
 const [provider,setProvider]=useState(initialProvider);
 const title=provider==='intervals'?'Intervals.icu':provider==='daily-json'?'Daily JSON':'Garmin Connect';
 const input=useRef<HTMLInputElement>(null);
 const [editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function connect(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const key=input.current?.value.trim();
  if(!key||busy)return;
  setError('');setBusy(true);
  try{
   const response=await fetch('/api/garmin-connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,provider})});
   if(!response.ok){const result=await response.json().catch(()=>null) as {message?:string}|null;throw new Error(result?.message||'暂时无法建立佳明连接，请稍后重试');}
   if(input.current)input.current.value='';
   setEditing(false);
   await onSaved();
  }catch(e){setError(e instanceof Error&&e.message!=='Failed to fetch'?e.message:'网络连接失败，请稍后重试');}
  finally{setBusy(false);}
 }
 if(configured&&!editing)return <button type="button" className="subtle" onClick={()=>setEditing(true)}>更换数据源密钥</button>;
 return <form className="garmin-connect-form" onSubmit={connect} autoComplete="off">
  {options.length>1&&<label>健康数据来源<select value={provider} disabled={busy} onChange={e=>{if(input.current)input.current.value='';setError('');setProvider(e.target.value);}}>{options.map(id=><option key={id} value={id}>{id==='garmin'?'Garmin Connect':id==='intervals'?'Intervals.icu':'Daily JSON'}</option>)}</select></label>}
  <p><strong>{title}</strong> · {provider==='garmin'?<a href="https://connect.garmin.com/app/settings/personalApiToken" target="_blank" rel="noreferrer">获取佳明个人密钥</a>:provider==='intervals'?<a href="https://intervals.icu/settings" target="_blank" rel="noreferrer">打开账户设置</a>:'使用部署者配置的数据源'}</p>
  <label htmlFor="garmin-connect-key"><strong>粘贴 {title} API 密钥</strong></label>
  <input ref={input} type="password" id="garmin-connect-key" required maxLength={512} autoComplete="off" spellCheck={false} autoCapitalize="none" placeholder="API 密钥" aria-describedby="garmin-key-help"/>
  <small className="muted" id="garmin-key-help">已有有效密钥就直接用。请使用当前数据源签发的密钥。</small>
  <div className="garmin-connect-actions"><button type="submit" className="primary" disabled={busy}><RefreshCw size={16} className={busy?'spin':''} aria-hidden="true"/>{busy?'正在连接…':'连接并同步'}</button>{configured&&<button type="button" className="subtle" disabled={busy} onClick={()=>{setError('');setEditing(false);}}>取消</button>}</div>
  {error&&<p className="alert" role="alert">{error}</p>}
 </form>;
}
