const NAME='xiaomao-plants';const VERSION=2;
let connection;
export function openDb(){
  if(connection) return connection;
  connection=new Promise((resolve,reject)=>{
    const request=indexedDB.open(NAME,VERSION);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('plants'))db.createObjectStore('plants',{keyPath:'id'});if(!db.objectStoreNames.contains('entries'))db.createObjectStore('entries',{keyPath:'id'});if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'})};
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db)};
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('数据库被另一个打开的页面占用'));
  });return connection;
}
function transact(stores,mode,job){return openDb().then(db=>new Promise((resolve,reject)=>{
  const tx=db.transaction(stores,mode);let result;
  tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||Error('本地保存失败'));tx.onabort=()=>reject(tx.error||Error('本地保存已取消'));
  try{result=job(tx)}catch(err){tx.abort();reject(err)}
}))}
export async function all(store){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly');const req=tx.objectStore(store).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
export const put=(store,item)=>transact([store],'readwrite',tx=>tx.objectStore(store).put(item));
export const remove=(store,id)=>transact([store],'readwrite',tx=>tx.objectStore(store).delete(id));
export const removePlantAndEntries=id=>transact(['plants','entries'],'readwrite',tx=>{tx.objectStore('plants').delete(id);const store=tx.objectStore('entries');const request=store.getAll();request.onsuccess=()=>{for(const entry of request.result)if(entry.plantId===id)store.delete(entry.id)}});
export const saveMany=(plants,entries)=>transact(['plants','entries'],'readwrite',tx=>{for(const p of plants)tx.objectStore('plants').put(p);for(const e of entries)tx.objectStore('entries').put(e)});
export const replaceAll=(plants,entries,meta=[])=>transact(['plants','entries','meta'],'readwrite',tx=>{tx.objectStore('plants').clear();tx.objectStore('entries').clear();tx.objectStore('meta').clear();for(const p of plants)tx.objectStore('plants').put(p);for(const e of entries)tx.objectStore('entries').put(e);for(const item of meta)tx.objectStore('meta').put(item)});
