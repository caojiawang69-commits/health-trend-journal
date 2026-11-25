// Retry reads only: writes may already have committed when a response fails.
export async function readWithRetry<T>(read:()=>Promise<T>):Promise<T>{
 for(let attempt=0;;attempt++){
  try{return await read();}catch(error){
   const message=error instanceof Error?error.message:'';
   if(attempt>=2||!(/D1_ERROR.*internal error|D1_ERROR.*overloaded|D1_ERROR.*reset|D1_ERROR.*temporar/i.test(message)))throw error;
   await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
  }
 }
}
export function readFailure(error:unknown){
 const message=error instanceof Error?error.message:'';
 const database=message.includes('D1_ERROR');
 console.error('health_read_failed',{database,reference:message.match(/reference\s*=\s*([a-z0-9]+)/i)?.[1]??null});
 return database?'云端数据库暂时不可用，已自动重试。请稍后重新读取。':'暂时无法读取云端记录，请稍后重试';
}
