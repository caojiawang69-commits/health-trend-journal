const context=new TextEncoder().encode('daily:garmin-personal-key:v1');
const fromBase64=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const toBase64=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function wrappingKey(secret:string){
 if(!/^[A-Za-z0-9_-]{43}$/.test(secret))throw new Error('Invalid credential configuration');
 return crypto.subtle.importKey('raw',fromBase64(secret),'AES-GCM',false,['encrypt','decrypt']);
}
export async function sealGarminKey(value:string,secret:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:context},await wrappingKey(secret),new TextEncoder().encode(value)));
 // Keep the existing iv + tag + ciphertext layout.
 return toBase64(Uint8Array.of(...iv,...data.subarray(-16),...data.subarray(0,-16)));
}
export async function unsealGarminKey(value:string,secret:string){
 const data=fromBase64(value);
 if(data.length<=28)throw new Error('Invalid saved credential');
 const ciphertext=Uint8Array.of(...data.subarray(28),...data.subarray(12,28));
 const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(0,12),additionalData:context},await wrappingKey(secret),ciphertext);
 return new TextDecoder().decode(clear);
}
export function validPersonalKey(value:unknown):value is string{
 return typeof value==='string'&&value.length>=20&&value.length<=512&&/^GCDC_[A-Za-z0-9._/+\-=]+$/.test(value);
}
