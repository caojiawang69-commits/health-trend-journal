const style = `*{box-sizing:border-box}body{margin:0;background:#f5f6f3;color:#18372e;font:16px/1.55 system-ui,sans-serif}main{max-width:730px;margin:auto;padding:clamp(24px,5vw,64px) 20px}header,nav{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}a{color:#255d4c}h1{font-size:clamp(28px,5vw,42px);margin:36px 0 12px}h2{font-size:19px;margin-top:0}.card{padding:24px;background:white;border:1px solid #dfe5dc;border-radius:16px;margin:16px 0}label{display:block;margin:12px 0}input,textarea{width:100%;padding:11px;font:inherit;border:1px solid #abbdb3;border-radius:7px}button,.primary{display:inline-block;padding:10px 16px;background:#23594b;color:white;border:0;border-radius:7px;font:inherit;text-decoration:none;cursor:pointer}p,small{color:#53695f}table{width:100%;text-align:left;border-collapse:collapse}th,td{padding:7px;border-bottom:1px solid #e6eae6}.alert{color:#80532c}header form{margin:0}`;

export function escapeText(value:string) {
  return value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
}

export function page(title:string,body:string,status=200) {
  return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Health Trend Journal</title><style>${style}</style><main>${body}</main></html>`,{status,headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'
  }});
}

export function accountForm(register:boolean,message='',status=200) {
  const action=register?'注册':'登录';
  return page(action,`<header><b>Health Trend Journal</b><a href="/demo">查看公开演示</a></header><h1>${register?'创建你的健康空间':'登录你的健康空间'}</h1><form class="card" method="post" action="/account/${register?'register':'login'}">
  ${message?'<p role="alert" class="alert">'+escapeText(message)+'</p>':''}
  <label>用户名<input required autocomplete="username" name="username" pattern="[a-zA-Z0-9_]{3,32}" maxlength="32"></label>
  ${register?'<small>3–32 位字母、数字或下划线，忽略大小写。</small>':''}
  <label>密码<input type="password" required name="password" autocomplete="${register?'new-password':'current-password'}" minlength="${register?12:1}" maxlength="128"></label>
  ${register?'<p>至少 12 个字符。请保存好登录信息，当前版本使用用户名登录。</p>':''}
  <nav><button>${register?'注册并进入':'登录'}</button><a href="/account/${register?'login':'register'}">${register?'已有账号，去登录':'创建账号'}</a></nav></form>`,status);
}

export type Reading={day:string;steps:number|null;sleep:number|null};
export function personalPage(user:string,rows:Reading[],note:string,message:string) {
  const measured=rows.filter(r=>r.sleep!==null);
  const average=measured.length?(measured.reduce((sum,r)=>sum+r.sleep!,0)/3600/measured.length).toFixed(1):null;
  return page('我的空间',`<header><b>Health Trend Journal</b><form method="post" action="/account/logout"><button>退出登录</button></form></header><h1>${escapeText(user)} 的健康空间</h1>
  ${message?'<p role="status">'+escapeText(message)+'</p>':''}
  <section class="card"><h2>导入 Garmin 记录</h2><p>读取最近 30 个已结束的北京时间日历日。密钥仅用于本次导入，重复导入会更新同一天的记录。</p><form method="post" action="/account/import"><label>Garmin 个人 API 密钥<input type="password" name="key" required maxlength="1024" autocomplete="off"></label><button>连接并导入</button></form></section>
  <section class="card"><h2>近期记录</h2>${rows.length?`<p>已记录 ${rows.length} 天。${average?'有睡眠观测的 '+measured.length+' 天平均睡眠 '+average+' 小时。':''}</p><table><thead><tr><th>日期</th><th>步数</th><th>睡眠时长</th></tr></thead><tbody>${rows.map(r=>'<tr><td>'+escapeText(r.day)+'</td><td>'+(r.steps??'—')+'</td><td>'+(r.sleep===null?'—':(r.sleep/3600).toFixed(1)+' 小时')+'</td></tr>').join('')}</tbody></table>`:'<p>这里还没有健康记录。连接有手表数据的 Garmin 账号后，即可查看自己的步数和睡眠。</p>'}</section>
  <form class="card" method="post" action="/account/note"><h2>个人备注</h2><label>记录近期目标<textarea name="note" maxlength="600">${escapeText(note)}</textarea></label><button>保存备注</button></form><a href="/demo">查看合成数据演示</a>`);
}
