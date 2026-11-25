// This example's API uses a paginated POST and measures nightly HRV in microseconds.
export type Night = {date:string; hrvMs:number|null};

export async function readNights(endpoint:string, apiKey:string):Promise<Night[]> {
  const nights:Night[]=[];
  const seenDates=new Set<string>();
  const cursors=new Set<string>();
  let cursor:string|null=null;
  do {
    const response:Response=await fetch(endpoint,{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{'Content-Type':'application/json','X-Study-Key':apiKey},
      body:JSON.stringify({series:'overnight-hrv',cursor})
    });
    if(!response.ok)throw new Error('Study API returned '+response.status);
    const page:unknown=await response.json();
    if(!page||typeof page!=='object'||!('items' in page)||!Array.isArray(page.items)||
      !('next' in page)||(page.next!==null&&typeof page.next!=='string'))throw new Error('Invalid study page');
    for(const {night,rmssd_us} of page.items) {
      if(typeof night!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(night)||!Number.isFinite(Date.parse(night))||
        new Date(night).toISOString().slice(0,10)!==night||seenDates.has(night))throw new Error('Invalid or duplicate night');
      if(rmssd_us!==null&&(typeof rmssd_us!=='number'||!Number.isFinite(rmssd_us)||rmssd_us<=0))throw new Error('Invalid nightly HRV');
      seenDates.add(night);
      nights.push({date:night,hrvMs:rmssd_us===null?null:rmssd_us/1000});
    }
    cursor=page.next;
    if(cursor!==null){
      if(typeof cursor!=='string'||!cursor||cursors.has(cursor))throw new Error('Invalid pagination cursor');
      cursors.add(cursor);
    }
  }while(cursor!==null);
  return nights.sort((a,b)=>a.date.localeCompare(b.date));
}
