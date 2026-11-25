import {readFeed} from '../../features/providers/feeds';

// A consumer can use only the API client and provide its own HTTP transport and output.
export async function exportSleepHours(apiKey:string,from:string,to:string,transport:typeof fetch){
  const days=await readFeed('intervals',apiKey,from,to,undefined,transport);
  return days.map(day=>({date:day.date,hours:day.sleepSeconds===undefined?null:day.sleepSeconds/3600}));
}
