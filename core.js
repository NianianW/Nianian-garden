export const ENTRY_TYPES = ['care','observation','hypothesis','plan','knowledge','moisture'];
export const CARE_TYPES = ['water','mist','fertilize','pest'];
export const MOISTURE_CONTEXTS = ['daily','before_water','after_water'];
export const KNOWLEDGE_SECTION_KEYS = ['environment','habits','issues','effectiveCare','hypotheses'];
export const KNOWLEDGE_STATUS_KEYS = ['verified','unverified'];
export const SOURCE_KINDS = ['user_quote','assistant_recap','demo','manual'];
export const labels = {care:'已完成养护',observation:'观察事实',hypothesis:'待验证的猜想',plan:'待观察问题',knowledge:'专属养护知识',moisture:'土壤湿度',water:'浇水 / 泡水',mist:'喷雾',fertilize:'施肥',pest:'除虫',daily:'日常检查',before_water:'浇水前',after_water:'浇水后'};
export const isoDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) === value;
export const normalize = value => String(value ?? '').trim().replace(/\s+/g,' ').toLocaleLowerCase();
export function fingerprint(entry){
  const base = `${normalize(entry.plantId || entry.plant)}|${entry.date || normalize(entry.dateLabel)}|${entry.kind}`;
  if(entry.kind === 'care') return `${base}|${entry.care}`;
  if(entry.kind === 'moisture') return `${normalize(entry.plantId || entry.plant)}|${entry.observedAt||entry.date}|moisture|${entry.moistureValue}|${entry.moistureContext||'daily'}`;
  return `${base}|${normalize(entry.text)}`;
}
export function validatePlant(p){
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw Error('植物资料不是对象');
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 60) throw Error('植物名称须为 1–60 字');
  for (const key of ['species','location']) if (p[key] != null && (typeof p[key] !== 'string' || p[key].length > 100)) throw Error(`${key} 格式不正确`);
  if (p.checkEveryDays != null && (!Number.isInteger(p.checkEveryDays) || p.checkEveryDays < 1 || p.checkEveryDays > 365)) throw Error('检查间隔须为 1–365 天');
  if (p.reminderCareType != null && !CARE_TYPES.includes(p.reminderCareType)) throw Error('检查依据不正确');
  if (p.moistureEnabled != null && typeof p.moistureEnabled !== 'boolean') throw Error('湿度记录开关格式不正确');
  if (p.knowledge != null) {
    if (typeof p.knowledge !== 'object' || Array.isArray(p.knowledge)) throw Error('养护档案格式不正确');
    for (const key of ['environment','habits','issues','effectiveCare','hypotheses']) if (p.knowledge[key] != null && (typeof p.knowledge[key] !== 'string' || p.knowledge[key].length > 5000)) throw Error('养护档案内容过长');
  }
  if (p.knowledgeHistory != null && !Array.isArray(p.knowledgeHistory)) throw Error('养护档案修订历史格式不正确');
}
export function validateEntry(e,{backup=false}={}){
  if (!e || typeof e !== 'object' || Array.isArray(e)) throw Error('记录不是对象');
  if (!ENTRY_TYPES.includes(e.kind)) throw Error('记录类别不正确');
  if (e.date != null && !isoDate(e.date)) throw Error('日期须为 YYYY-MM-DD');
  if (!e.date && (typeof e.dateLabel !== 'string' || !e.dateLabel.trim() || e.dateLabel.length > 80)) throw Error('没有精确日期时须填写 dateLabel');
  if (e.kind === 'care' && (!e.date || !CARE_TYPES.includes(e.care))) throw Error('已完成养护必须有精确日期及动作');
  if (e.care != null && !CARE_TYPES.includes(e.care)) throw Error('养护动作不正确');
  if (e.pestDetails != null) {
    if (typeof e.pestDetails !== 'object' || Array.isArray(e.pestDetails)) throw Error('除虫详情格式不正确');
    for (const key of ['product','area','note']) if (e.pestDetails[key] != null && (typeof e.pestDetails[key] !== 'string' || e.pestDetails[key].length > 500)) throw Error('除虫详情过长');
  }
  if (e.environment != null) {
    if (typeof e.environment !== 'object' || Array.isArray(e.environment)) throw Error('环境数据格式不正确');
    for (const key of ['lightLux','temperatureC','humidityPct']) if (e.environment[key] != null && (typeof e.environment[key] !== 'number' || !Number.isFinite(e.environment[key]))) throw Error('环境测量须为数字');
  }
  if (e.kind === 'moisture') {
    if (!Number.isInteger(e.moistureValue) || e.moistureValue < 1 || e.moistureValue > 10) throw Error('土壤湿度须为 1–10 的整数');
    if (!MOISTURE_CONTEXTS.includes(e.moistureContext||'daily')) throw Error('湿度记录场景不正确');
    if (e.observedAt != null && (typeof e.observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(e.observedAt))) throw Error('湿度记录时间须为 YYYY-MM-DDTHH:mm');
    if (!e.observedAt && !e.date) throw Error('湿度记录须有日期或时间');
  }
  if (typeof e.text !== 'string' || !e.text.trim() || e.text.length > 2000) throw Error('记录内容须为 1–2000 字');
  if (backup && (typeof e.plantId !== 'string' || !e.plantId)) throw Error('记录缺少 plantId');
  if (!backup && (typeof e.plant !== 'string' || !e.plant.trim())) throw Error('记录缺少植物名称');
  if (e.source != null) {
    if (typeof e.source !== 'object' || !SOURCE_KINDS.includes(e.source.kind)) throw Error('来源类别不正确');
    for (const key of ['conversation','quote','note']) if (e.source[key] != null && (typeof e.source[key] !== 'string' || e.source[key].length > 3000)) throw Error(`来源 ${key} 格式不正确`);
  }
  if (backup && e.photoDataUrl != null && (typeof e.photoDataUrl !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(e.photoDataUrl))) throw Error('照片格式不正确');
}
export function validateChatImport(data){
  if (!data || data.format !== 'xiaomao-chat-import' || data.version !== 1) throw Error('这不是小猫植物园聊天整理稿 v1');
  if (!Array.isArray(data.plants) || !Array.isArray(data.entries)) throw Error('缺少 plants 或 entries 数组');
  if (data.plants.length > 100 || data.entries.length > 1000) throw Error('一次最多导入 100 盆植物和 1000 条记录');
  data.plants.forEach(validatePlant);
  const names = new Set(data.plants.map(p=>normalize(p.name)));
  data.entries.forEach((e,i)=>{try{validateEntry(e);if(!e.source || typeof e.source.quote !== 'string' || !e.source.quote.trim()) throw Error('须保留支持这条记录的原句');if(!names.has(normalize(e.plant))) throw Error('未在 plants 中找到对应植物');if(e.kind==='knowledge'&&e.knowledgeSection!=null&&!KNOWLEDGE_SECTION_KEYS.includes(e.knowledgeSection))throw Error('养护知识栏目不正确');if(e.kind==='knowledge'&&e.knowledgeStatus!=null&&!KNOWLEDGE_STATUS_KEYS.includes(e.knowledgeStatus))throw Error('养护知识证据状态不正确');}catch(err){throw Error(`第 ${i+1} 条：${err.message}`)}});
  return data;
}
export function validateBackup(data){
  if (!data || data.format !== 'xiaomao-backup' || data.version !== 1) throw Error('这不是小猫植物园完整备份 v1');
  if (!Array.isArray(data.plants) || !Array.isArray(data.entries)) throw Error('备份缺少植物或记录');
  if (data.plants.length > 1000 || data.entries.length > 10000) throw Error('备份记录数量超出上限');
  const ids = new Set();
  data.plants.forEach(p=>{validatePlant(p);if(typeof p.id !== 'string'||!p.id||ids.has(p.id)) throw Error('植物 ID 缺失或重复');ids.add(p.id)});
  const entryIds = new Set();
  data.entries.forEach(e=>{validateEntry(e,{backup:true});if(!ids.has(e.plantId)) throw Error('记录指向不存在的植物');if(typeof e.id !== 'string'||!e.id||entryIds.has(e.id)) throw Error('记录 ID 缺失或重复');entryIds.add(e.id)});
  if (data.meta != null && !Array.isArray(data.meta)) throw Error('备份 meta 格式不正确');
  if (Array.isArray(data.meta)) {const metaKeys=new Set();for(const item of data.meta){if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.key!=='string'||!item.key||metaKeys.has(item.key))throw Error('备份 meta 项缺少或重复 key');metaKeys.add(item.key)}}
  return data;
}
export function mergeBackupData(currentPlants,currentEntries,currentMeta,backup,makeId){
  validateBackup(backup);
  const nextId=makeId||(()=>crypto.randomUUID());
  const byId=new Map(currentPlants.map(p=>[p.id,p]));
  const byName=new Map(currentPlants.map(p=>[normalize(p.name),p]));
  const idMap=new Map();
  const plantWrites=[];
  for(const p of backup.plants){
    const sameName=byName.get(normalize(p.name));
    if(sameName){
      idMap.set(p.id,sameName.id);
      const historyIds=new Set((sameName.knowledgeHistory||[]).map(item=>item.id));
      const nonemptyCurrent=Object.fromEntries(Object.entries(sameName.knowledge||{}).filter(([,value])=>value));
      const merged={...sameName,moistureEnabled:Boolean(sameName.moistureEnabled||p.moistureEnabled),knowledge:{...(p.knowledge||{}),...nonemptyCurrent},knowledgeHistory:[...(sameName.knowledgeHistory||[]),...(p.knowledgeHistory||[]).filter(item=>!historyIds.has(item.id))]};
      plantWrites.push(merged);byId.set(merged.id,merged);byName.set(normalize(merged.name),merged);continue;
    }
    const id=byId.has(p.id)?nextId():p.id;const copy={...p,id};idMap.set(p.id,id);plantWrites.push(copy);byId.set(id,copy);byName.set(normalize(copy.name),copy);
  }
  const knownIds=new Set(currentEntries.map(e=>e.id));const knownFingerprints=new Set(currentEntries.map(fingerprint));const entryWrites=[];
  for(const e of backup.entries){const copy={...e,plantId:idMap.get(e.plantId)};const key=fingerprint(copy);if(knownFingerprints.has(key))continue;if(knownIds.has(copy.id))copy.id=nextId();entryWrites.push(copy);knownIds.add(copy.id);knownFingerprints.add(key)}
  const currentMetaByKey=new Map(currentMeta.map(item=>[item.key,item]));const metaWrites=(backup.meta||[]).filter(item=>{const current=currentMetaByKey.get(item.key);return !current||!current.completedAt||!item.completedAt||item.completedAt>current.completedAt});
  return {plants:plantWrites,entries:entryWrites,meta:metaWrites};
}
export function checkStatus(plant,entries,today){
  const basis=plant.reminderCareType||'water';
  const last = entries.filter(e=>e.plantId===plant.id && e.kind==='care' && e.care===basis && e.date && e.date<=today).map(e=>e.date).sort().at(-1);
  if (!plant.checkEveryDays) return {last:last||null,check:false,basis};
  if (!last) return {last:null,check:true,basis};
  const days = Math.floor((Date.parse(`${today}T12:00:00Z`)-Date.parse(`${last}T12:00:00Z`))/86400000);
  return {last,check:days>=plant.checkEveryDays,basis};
}
