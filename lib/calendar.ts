export function shiftDay(day:string,by:number){
 return new Date(Date.parse(day+'T00:00:00Z')+by*86_400_000).toISOString().slice(0,10);
}
