/* core.js — estado, almacenamiento, usuarios y búsqueda. */

/* ---------- utilidades ---------- */
export const $=(s,r=document)=>r.querySelector(s);
export const $$=(s,r=document)=>[...r.querySelectorAll(s)];
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const MONTHS=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
export const p2=n=>String(n).padStart(2,'0');
export const fmtDate=t=>{const d=new Date(t);return `${p2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`};
export const fmtDay=t=>{const d=new Date(t);return `${p2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`};
export const fmtTime=t=>{const d=new Date(t);return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`};
export const isoLocal=t=>{const d=new Date(t);return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`};
export const dayKey=t=>{const d=new Date(t);return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`};
export const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const fmtMB=b=>b==null?'—':b<1048576?Math.max(1,Math.round(b/1024))+' KB':(b/1048576).toFixed(1)+' MB';
export const DAY=86400000;
export const daysSince=t=>Math.floor((Date.now()-t)/DAY);
const ALPHA='ABCDEFGHJKMNPQRSTVWXYZ23456789';
export const rid=(n=8)=>{const a=new Uint8Array(n);crypto.getRandomValues(a);return [...a].map(x=>ALPHA[x%ALPHA.length]).join('')};
export const uid=p=>p+'_'+rid(10).toLowerCase();
export const hex=buf=>[...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function sha256(bytes){try{return hex(await crypto.subtle.digest('SHA-256',bytes))}catch(e){return 'sin-hash-'+(bytes.length||0)}}

/* ---------- normalización y búsqueda ----------
   Requisito: mayúsculas/minúsculas, con o sin acentos, y coincidencia parcial.
   normMap devuelve además la correspondencia de posiciones, para resaltar sobre el texto original. */
export function normMap(s){
  s=String(s==null?'':s);let out='';const map=[];
  for(let i=0;i<s.length;i++){
    const n=s[i].normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
    for(const ch of n){out+=ch;map.push(i)}
  }
  return {norm:out,map};
}
export const norm=s=>normMap(s).norm;
export function queryTokens(q){
  const out=[];const re=/"([^"]*)"|(\S+)/g;let m;
  while((m=re.exec(String(q==null?'':q)))!==null){
    const t=norm(m[1]!==undefined?m[1]:m[2]).trim().replace(/\s+/g,' ');
    if(t)out.push(t);
  }
  return out;
}
export const matchesAll=(hayNorm,toks)=>toks.length>0&&toks.every(t=>hayNorm.includes(t));
/** Primer fragmento del texto donde aparece alguno de los términos, con el término marcado. */
export function snippet(text,toks,pad=44){
  const {norm:n,map}=normMap(text);
  for(const t of toks){
    const i=n.indexOf(t);
    if(i<0)continue;
    const a=map[i],b=(map[i+t.length-1]!==undefined?map[i+t.length-1]:a)+1;
    const from=Math.max(0,a-pad),to=Math.min(text.length,b+pad);
    return {before:(from>0?'…':'')+text.slice(from,a).replace(/\s+/g,' '),hit:text.slice(a,b),after:text.slice(b,to).replace(/\s+/g,' ')+(to<text.length?'…':'')};
  }
  return null;
}

/* ---------- almacenamiento ---------- */
const DBN='carpetas-nfc',DBV=1;
export const STORES=['company','users','families','docTypes','files','tags','docs','labels','events','batches','meta'];
let DB=null;
export let MEM=false;
function openDB(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open(DBN,DBV);
    r.onupgradeneeded=()=>{const d=r.result;
      for(const s of STORES)if(!d.objectStoreNames.contains(s))
        d.createObjectStore(s,s==='events'?{keyPath:'id',autoIncrement:true}:{keyPath:s==='meta'?'k':(s==='tags'?'public':'id')});
    };
    r.onsuccess=()=>{DB=r.result;res()};r.onerror=()=>rej(r.error);
  });
}
function tx(store,mode,fn){
  return new Promise((res,rej)=>{
    const t=DB.transaction(store,mode),st=t.objectStore(store);const r=fn(st);
    t.oncomplete=()=>res(r&&'result' in r?r.result:undefined);
    t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error);
  });
}
export const S={company:null,users:[],families:[],docTypes:[],files:[],tags:[],docs:[],labels:[],events:[],batches:[],meta:{}};
export async function put(store,obj){if(MEM)return;try{await tx(store,'readwrite',st=>st.put(obj))}catch(e){console.warn('put',store,e)}}
export async function del(store,key){if(MEM)return;try{await tx(store,'readwrite',st=>st.delete(key))}catch(e){console.warn('del',store,e)}}
export async function wipe(){if(MEM)return;for(const s of STORES){try{await tx(s,'readwrite',st=>st.clear())}catch(e){}}}
export const setMeta=(k,v)=>{S.meta[k]=v;put('meta',{k,v})};
export async function loadAll(){
  try{await openDB()}catch(e){MEM=true;console.warn('IndexedDB no disponible',e);return}
  const get=s=>tx(s,'readonly',st=>st.getAll());
  try{
    S.company=(await get('company'))[0]||null;
    S.users=await get('users');S.families=await get('families');S.docTypes=await get('docTypes');
    S.files=await get('files');S.tags=await get('tags');S.docs=await get('docs');S.labels=await get('labels');
    S.batches=await get('batches');
    S.events=(await get('events')).sort((a,b)=>b.t-a.t).slice(0,500);
    (await get('meta')).forEach(m=>{S.meta[m.k]=m.v});
  }catch(e){MEM=true;console.warn(e)}
}

/* ---------- registro de eventos ---------- */
export async function ev(type,o={}){
  const e={companyId:S.company?S.company.id:null,userId:SESSION?SESSION.userId:null,type,
    resourceType:o.resourceType||'',resourceId:o.resourceId||'',note:o.note||'',ms:o.ms==null?null:Math.round(o.ms),kind:o.kind||'',t:Date.now()};
  if(!MEM){try{e.id=await tx('events','readwrite',st=>st.add(e))}catch(x){e.id=Date.now()+Math.random()}}
  else e.id=Date.now()+Math.random();
  S.events.unshift(e);if(S.events.length>500)S.events.pop();
  return e;
}

/* ---------- usuarios y sesión ---------- */
const ITER=120000;
export async function hashPw(pw,saltHex){
  const salt=Uint8Array.from(saltHex.match(/../g).map(h=>parseInt(h,16)));
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),{name:'PBKDF2'},false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:ITER,hash:'SHA-256'},key,256));
}
export const newSalt=()=>hex(crypto.getRandomValues(new Uint8Array(16)));
export const ROLES={admin:'Administrador',operador:'Operador',consulta:'Consulta'};
export const PERMS={admin:['ver','capturar','archivar','administrar'],operador:['ver','capturar','archivar'],consulta:['ver']};
export let SESSION=null;
const SKEY='carpetas-nfc.session';
function readStored(){
  for(const st of [sessionStorage,localStorage]){
    try{const v=st.getItem(SKEY);if(v)return JSON.parse(v)}catch(e){}
  }
  return null;
}
export function restoreSession(){
  const s=readStored();
  if(s&&S.users.some(u=>u.id===s.userId&&u.state==='activo')){SESSION=s;return true}
  SESSION=null;return false;
}
export function me(){return SESSION?S.users.find(u=>u.id===SESSION.userId)||null:null}
export function can(p){const u=me();return !!u&&(PERMS[u.role]||[]).includes(p)}
export async function createUser({name,email,role,password}){
  const salt=newSalt();
  const u={id:uid('u'),companyId:S.company.id,name:name.trim(),email:email.trim().toLowerCase(),role,
    salt,hash:await hashPw(password,salt),state:'activo',created:Date.now(),failed:0,lockedUntil:0,mustChange:false};
  S.users.push(u);await put('users',u);
  await ev('USER_CREATED',{resourceType:'user',resourceId:u.id,note:`${u.email} · ${ROLES[u.role]}`,kind:'ok'});
  return u;
}
export async function setPassword(u,password){
  u.salt=newSalt();u.hash=await hashPw(password,u.salt);u.failed=0;u.lockedUntil=0;u.mustChange=false;
  await put('users',u);await ev('PASSWORD_SET',{resourceType:'user',resourceId:u.id,note:u.email,kind:'ok'});
}
export const MAX_FAILS=5,LOCK_MS=60000;
/** Resultado: {ok} | {error, wait} */
export async function login(email,password,keep){
  const em=String(email||'').trim().toLowerCase();
  const u=S.users.find(x=>x.email===em);
  if(!u||u.state!=='activo'){
    await ev('LOGIN_FAILED',{resourceType:'user',resourceId:em,note:'Usuario inexistente o inactivo',kind:'bad'});
    return {error:'Correo o contraseña incorrectos.'};
  }
  if(u.lockedUntil&&u.lockedUntil>Date.now()){
    const wait=Math.ceil((u.lockedUntil-Date.now())/1000);
    return {error:`Demasiados intentos. Espera ${wait} s.`,wait};
  }
  const h=await hashPw(password,u.salt);
  if(h!==u.hash){
    u.failed=(u.failed||0)+1;
    if(u.failed>=MAX_FAILS){u.lockedUntil=Date.now()+LOCK_MS;u.failed=0;await put('users',u);
      await ev('LOGIN_LOCKED',{resourceType:'user',resourceId:u.id,note:`${MAX_FAILS} intentos fallidos · bloqueo de 60 s`,kind:'bad'});
      return {error:'Demasiados intentos. Espera 60 s.',wait:60}}
    await put('users',u);
    await ev('LOGIN_FAILED',{resourceType:'user',resourceId:u.id,note:`Intento ${u.failed} de ${MAX_FAILS}`,kind:'bad'});
    return {error:`Correo o contraseña incorrectos. Intento ${u.failed} de ${MAX_FAILS}.`};
  }
  u.failed=0;u.lockedUntil=0;u.lastLogin=Date.now();await put('users',u);
  SESSION={userId:u.id,at:Date.now()};
  try{(keep?localStorage:sessionStorage).setItem(SKEY,JSON.stringify(SESSION));
      (keep?sessionStorage:localStorage).removeItem(SKEY)}catch(e){}
  await ev('LOGIN',{resourceType:'user',resourceId:u.id,note:`${u.email} · ${ROLES[u.role]}`,kind:'ok'});
  return {ok:true,user:u};
}
export async function logout(){
  const u=me();if(u)await ev('LOGOUT',{resourceType:'user',resourceId:u.id,note:u.email});
  SESSION=null;try{sessionStorage.removeItem(SKEY);localStorage.removeItem(SKEY)}catch(e){}
}

/* ---------- consultas derivadas ---------- */
export const famById=id=>S.families.find(f=>f.id===id);
export const typeById=id=>S.docTypes.find(t=>t.id===id);
export const fileById=id=>S.files.find(f=>f.id===id);
export const docById=id=>S.docs.find(d=>d.id===id);
export const userById=id=>S.users.find(u=>u.id===id);
export const typesOfFamily=fid=>S.docTypes.filter(t=>t.familyId===fid).sort((a,b)=>a.order-b.order);
export const filesOfFamily=fid=>S.files.filter(f=>f.familyId===fid).sort((a,b)=>a.code.localeCompare(b.code,'es'));
export const docsOfFile=fid=>S.docs.filter(d=>d.fileId===fid).sort((a,b)=>b.created-a.created);
export const activeTag=fid=>S.tags.find(t=>t.fileId===fid&&t.state==='activo');
export const tagsOfFile=fid=>S.tags.filter(t=>t.fileId===fid).sort((a,b)=>b.assignedAt-a.assignedAt);
export const labelById=id=>S.labels.find(l=>l.id===id);
export const labelNames=d=>(d.labels||[]).map(id=>{const l=labelById(id);return l?l.name:''}).filter(Boolean);
export const pending=()=>S.docs.filter(d=>d.state==='por_archivar').sort((a,b)=>a.created-b.created);
export const SERIES=['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)','var(--s6)','var(--s7)','var(--s8)'];
export const famColor=f=>SERIES[(f&&f.colorSlot!=null?f.colorSlot:0)%8];
export function lastMovement(fileId){
  const d=docsOfFile(fileId)[0];const f=fileById(fileId);
  return d?d.created:(f?f.created:0);
}

/* ---------- búsqueda ---------- */
function haystack(d){
  if(d._hay&&d._hayV===d._v)return d._hay;
  const f=fileById(d.fileId),fam=f?famById(f.familyId):null,t=typeById(d.docTypeId);
  const parts=[d.name,t?t.name:'',labelNames(d).join(' '),f?f.code:'',f?f.name:'',f?(f.location||''):'',fam?fam.name:'',
    d.ocr&&d.ocr.state==='done'?d.ocr.text:''];
  d._hay=norm(parts.join(' · '));d._hayV=d._v;
  return d._hay;
}
export function touchDoc(d){d._v=(d._v||0)+1;d._hay=null}
/** filtros: {familyId,fileId,docTypeId,labels:[],state,from,to,dateBy:'doc'|'cap'} */
export function searchDocs(q,filters={}){
  const toks=queryTokens(q);
  const from=filters.from?new Date(filters.from+'T00:00:00').getTime():null;
  const to=filters.to?new Date(filters.to+'T23:59:59').getTime():null;
  const out=[];
  for(const d of S.docs){
    const f=fileById(d.fileId);
    if(filters.fileId&&d.fileId!==filters.fileId)continue;
    if(filters.familyId&&(!f||f.familyId!==filters.familyId))continue;
    if(filters.docTypeId&&d.docTypeId!==filters.docTypeId)continue;
    if(filters.state&&d.state!==filters.state)continue;
    if(filters.labels&&filters.labels.length&&!filters.labels.every(l=>(d.labels||[]).includes(l)))continue;
    const when=filters.dateBy==='doc'?(d.docDate?new Date(d.docDate).getTime():d.created):d.created;
    if(from!=null&&when<from)continue;
    if(to!=null&&when>to)continue;
    if(toks.length){
      if(!matchesAll(haystack(d),toks))continue;
      const inName=matchesAll(norm([d.name,typeById(d.docTypeId)?typeById(d.docTypeId).name:'',labelNames(d).join(' ')].join(' ')),toks);
      out.push({doc:d,by:inName?'nombre, tipo o etiqueta':'contenido (OCR)',
        snip:inName?null:(d.ocr&&d.ocr.state==='done'?snippet(d.ocr.text,toks):null)});
    }else out.push({doc:d,by:'',snip:null});
  }
  out.sort((a,b)=>b.doc.created-a.doc.created);
  return out;
}

/* ---------- datos iniciales ---------- */
const PLANTILLA=[
  ['Contabilidad',0,['Factura','Boleta','Guía de remisión','Recibo por honorarios','Nota de crédito','Estado de cuenta']],
  ['Personal',1,['Planilla mensual','Contrato','Boleta de pago','Certificado de trabajo','Descanso médico']],
  ['SST',2,['Registro de capacitación','Póliza SCTR','Acta de inspección','Entrega de EPP']]
];
const LBL=['Pagado','Pendiente de pago','Original','Copia','Urgente','Auditoría'];
export async function bootstrapCompany({razon,ruc}){
  const c={id:uid('c'),razon:razon.trim(),ruc:(ruc||'').trim(),plan:'piloto',state:'activo',created:Date.now()};
  S.company=c;await put('company',c);
  for(const [name,slot,types] of PLANTILLA){
    const fam={id:uid('fam'),companyId:c.id,name,colorSlot:slot,order:slot,created:Date.now()};
    S.families.push(fam);await put('families',fam);
    let i=0;
    for(const tn of types){const t={id:uid('dt'),companyId:c.id,familyId:fam.id,name:tn,order:i++};S.docTypes.push(t);await put('docTypes',t)}
  }
  for(const n of LBL){const l={id:uid('lb'),companyId:c.id,name:n,useCount:0};S.labels.push(l);await put('labels',l)}
  await ev('COMPANY_CREATED',{resourceType:'company',resourceId:c.id,note:c.razon,kind:'ok'});
  return c;
}
export async function addFile({familyId,code,name,defaultDocTypeId,location}){
  const f={id:uid('f'),companyId:S.company.id,familyId,code:code.trim(),name:name.trim(),
    defaultDocTypeId:defaultDocTypeId||null,location:(location||'').trim(),state:'activo',created:Date.now(),demo:false};
  S.files.push(f);await put('files',f);
  await ev('FILE_CREATED',{resourceType:'file',resourceId:f.id,note:`${f.code} · ${f.name}`,kind:'ok'});
  return f;
}
export async function newTag(fileId,kind='qr'){
  let p;do{p=rid(8)}while(S.tags.some(t=>t.public===p));
  const t={public:p,companyId:S.company.id,fileId,kind,state:'activo',assignedAt:Date.now(),revokedAt:null};
  S.tags.push(t);await put('tags',t);
  const f=fileById(fileId);
  await ev('TAG_ASSIGNED',{resourceType:'tag',resourceId:p,note:f?f.code:'',kind:'ok'});
  return t;
}
export async function revokeTag(t){
  t.state='revocado';t.revokedAt=Date.now();await put('tags',t);
  const f=fileById(t.fileId);
  await ev('TAG_REVOKED',{resourceType:'tag',resourceId:t.public,note:(f?f.code+' · ':'')+'queda en el historial',kind:'bad'});
}
/** Documentos de ejemplo para que el dashboard y la búsqueda no arranquen vacíos. */
export async function seedDemo(){
  const fam=n=>S.families.find(f=>f.name===n);
  const type=(fn,tn)=>S.docTypes.find(t=>t.familyId===fam(fn).id&&t.name===tn);
  const lb=n=>{const l=S.labels.find(x=>x.name===n);return l?l.id:null};
  const mk=async(famName,code,name,typeName,loc,demo=true)=>{
    const f=await addFile({familyId:fam(famName).id,code,name,defaultDocTypeId:type(famName,typeName).id,location:loc});
    f.demo=demo;await put('files',f);return f;
  };
  const f1=await mk('Contabilidad','C-014','Compras 2026 · Facturas','Factura','Estante A, nivel 2');
  const f2=await mk('Contabilidad','C-015','Ventas 2026 · Boletas','Boleta','Estante A, nivel 2');
  const f3=await mk('Contabilidad','C-021','Guías de remisión 2026','Guía de remisión','Estante A, nivel 3');
  const f4=await mk('Personal','P-003','Planillas 2026','Planilla mensual','Archivador cerrado 1');
  const f5=await mk('Personal','P-007','Contratos laborales','Contrato','Archivador cerrado 1');
  const f6=await mk('SST','S-002','Capacitaciones SST','Registro de capacitación','Estante B, nivel 1');
  const f7=await mk('SST','S-004','Inspecciones de seguridad','Acta de inspección','Estante B, nivel 1');
  const f8=await mk('Contabilidad','C-009','Compras 2025 · Facturas','Factura','Caja de archivo 2025');
  const D=[
    [f1,'Factura','Factura F001-2331 · Ferretería Lima',1,2,'archivado',['Pagado'],'Ferretería Lima SAC RUC 20512345678. Cemento Sol tipo I de 42.5 kg, 120 bolsas. IGV 18%. Total S/ 4,720.00. Sustento de gasto de obra.'],
    [f1,'Factura','Factura E001-884 · Transportes Rímac',2,5,'archivado',['Original'],'Transportes Rímac SRL. Servicio de flete Lima - Arequipa según guía de remisión T001-5521. Condición de pago: crédito 30 días.'],
    [f1,'Factura','Factura F001-2340 · Aceros del Perú',1,1,'por_archivar',['Pendiente de pago'],'Aceros del Perú SA. Fierro corrugado de 1/2 pulgada, 300 varillas. Orden de compra OC-2026-118.'],
    [f1,'Nota de crédito','Nota de crédito NC001-19 · Ferretería Lima',1,9,'archivado',[],'Nota de crédito por devolución de 10 bolsas de cemento con empaque dañado. Referencia factura F001-2331.'],
    [f2,'Boleta','Boleta B001-5521 · Bodega San Martín',1,12,'archivado',[],'Boleta de venta electrónica. Cliente Bodega San Martín. Total S/ 86.50.'],
    [f2,'Boleta','Boleta B001-5604 · Consumo interno',1,3,'archivado',[],'Boleta de venta por consumo interno de oficina. Útiles de escritorio.'],
    [f3,'Guía de remisión','Guía T001-5521 · Lima a Arequipa',2,6,'archivado',['Original'],'Guía de remisión transportista T001-5521. Punto de partida Lima, punto de llegada Arequipa. Placa AQW-882.'],
    [f4,'Planilla mensual','Planilla setiembre 2026',4,16,'archivado',['Original'],'Planilla de remuneraciones de setiembre. 14 trabajadores. Aportes a EsSalud y AFP declarados en PLAME.'],
    [f4,'Planilla mensual','Planilla agosto 2026',4,45,'archivado',[],'Planilla de remuneraciones de agosto. 14 trabajadores.'],
    [f5,'Contrato','Contrato a plazo fijo · J. Quispe',3,21,'archivado',['Original'],'Contrato de trabajo sujeto a modalidad. Plazo fijo de seis meses con renovación. Cláusula de confidencialidad.'],
    [f6,'Póliza SCTR','Póliza SCTR vigencia 2026',8,1,'por_archivar',['Original','Urgente'],'Seguro Complementario de Trabajo de Riesgo SCTR. Póliza 0034-882. Vigencia del 01/01/2026 al 31/12/2026. Asegurado Distribuidora Andina SAC. Cobertura de salud y pensión para personal de almacén.'],
    [f6,'Registro de capacitación','Capacitación en uso de extintores',3,8,'archivado',[],'Registro de capacitación en uso de extintores portátiles. 12 asistentes. Capacitador externo certificado.'],
    [f7,'Acta de inspección','Acta de inspección de almacén',2,19,'archivado',['Auditoría'],'Acta de inspección interna de almacén. Observación: señalización de salida obstruida en pasillo 3. Plazo de corrección 15 días.'],
    [f8,'Factura','Factura F001-1902 · Papelería Central',1,96,'archivado',['Copia'],'Papelería Central EIRL. Útiles de oficina del ejercicio anterior. Archivo histórico.']
  ];
  for(const [f,tn,name,pages,ago,state,labels,text] of D){
    const famName=famById(f.familyId).name;
    const d={id:uid('d'),companyId:S.company.id,fileId:f.id,docTypeId:type(famName,tn).id,name,state,
      docDate:isoLocal(Date.now()-ago*DAY),pages,bytes:pages*820000,hash:'ejemplo',
      labels:labels.map(lb).filter(Boolean),created:Date.now()-ago*DAY,createdBy:null,
      pdf:null,pageBlobs:[],ocr:{state:'done',text,ms:0},demo:true};
    S.docs.push(d);await put('docs',d);
  }
  setMeta('demo',true);
  await ev('DEMO_SEEDED',{note:`${D.length} documentos y 7 files de ejemplo`,kind:''});
}
export async function removeDemo(){
  for(const d of S.docs.filter(x=>x.demo))await del('docs',d.id);
  S.docs=S.docs.filter(d=>!d.demo);
  const demoFiles=S.files.filter(f=>f.demo&&!S.docs.some(d=>d.fileId===f.id));
  for(const f of demoFiles){
    for(const t of tagsOfFile(f.id))await del('tags',t.public);
    S.tags=S.tags.filter(t=>t.fileId!==f.id);
    await del('files',f.id);
  }
  S.files=S.files.filter(f=>!demoFiles.includes(f));
  setMeta('demo',false);
  await ev('DEMO_REMOVED',{note:'Datos de ejemplo eliminados',kind:''});
}
