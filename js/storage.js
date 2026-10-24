/** IndexedDB is local to this browser/device. No cloud sync, no external account. */
import {newAppData, validateBackup} from './model.js';
const dbName='serveiq-local-v1';
function openDB(){return new Promise((resolve,reject)=>{
  if(!('indexedDB' in globalThis))return reject(Error('IndexedDB nicht verfügbar'));
  const r=indexedDB.open(dbName,1);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('kv'))r.result.createObjectStore('kv');};
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
});}
export async function load(){try{
  const db=await openDB();const x=await new Promise((resolve,reject)=>{
    const t=db.transaction('kv','readonly'),r=t.objectStore('kv').get('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });db.close();if(x){validateBackup(x);return x;}
}catch(err){console.warn('IndexedDB-Laden:',err);}
  try{const x=JSON.parse(localStorage.getItem('serveiq_emergency')||'null');if(x){validateBackup(x);return x;}}catch{}
  return newAppData();
}
export async function save(x){
  try{const db=await openDB();await new Promise((resolve,reject)=>{
    const t=db.transaction('kv','readwrite');t.objectStore('kv').put(x,'state');t.oncomplete=resolve;t.onerror=()=>reject(t.error);
  });db.close();return true;
  }catch(err){console.error('Lokale Speicherung fehlgeschlagen',err);
    try{localStorage.setItem('serveiq_emergency',JSON.stringify(x));return true;}catch{return false;}
  }
}
