import {sealGarminKey,unsealGarminKey} from '../../features/garmin/credential';
import {readNights} from './external-api';

// Only the secret envelope is supplied by the journal. The host owns the store, API,
// unit conversion, comparison and SVG; it never sends its wrapping key to the API.
export async function saveStudyKey(store:Map<string,string>,apiKey:string,wrappingKey:string){
  store.set('study',await sealGarminKey(apiKey,wrappingKey));
}
export async function studySparkline(endpoint:string,store:Map<string,string>,wrappingKey:string){
  const encrypted=store.get('study');
  if(!encrypted)throw new Error('Study source not connected');
  const apiKey=await unsealGarminKey(encrypted,wrappingKey);
  const nights=await readNights(endpoint,apiKey);
  const measured=nights.flatMap(n=>n.hrvMs===null?[]:[n.hrvMs]);
  const peak=Math.max(1,...measured);
  const bars=measured.map((value,i)=>{
    const height=50*value/peak;
    return '<rect x="'+i*8+'" y="'+(50-height)+'" width="6" height="'+height+'"/>';
  });
  return {change:measured.length>=2?measured.at(-1)!-measured.at(-2)!:null,
    svg:'<svg aria-label="Measured nights" viewBox="0 0 '+Math.max(8,bars.length*8)+' 50">'+bars.join('')+'</svg>'};
}
