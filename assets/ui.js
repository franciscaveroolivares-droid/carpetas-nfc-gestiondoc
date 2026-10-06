/* ui.js — cromo de la aplicación, componentes y gráficos. */
import {S,esc,$,$$,setMeta,me,can,ROLES,labelNames,typeById,fileById,famById,famColor,fmtDate} from './core.js';

export const IC={
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
  dash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  tree:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6a2 2 0 0 1 2-2h3l2 2h6a2 2 0 0 1 2 2v2"/><path d="M7 12h3l1.5 2H19a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z"/></svg>',
  files:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  scan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 12h8"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  inbox:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13h5l1 3h6l1-3h5"/><path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/></svg>',
  tag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v7l9 9 9-9z"/><circle cx="8.5" cy="8.5" r="1.4"/></svg>',
  cog:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
  log:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 4h14v16H5z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
  more:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
  chk:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9"/></svg>',
  out:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3"/><path d="M10 8l-4 4 4 4M6 12h9"/></svg>'
};
export const DESKTOP_NAV=[
  ['dash','#/dash','Dashboard','dash'],
  ['estructura','#/estructura','Fichas madre','tree'],
  ['buscar','#/buscar','Búsqueda','search'],
  ['bandeja','#/bandeja','Por archivar','inbox'],
  ['sep'],
  ['escanear','#/escanear','Escanear tag','scan'],
  ['etiquetas','#/etiquetas','Etiquetas','tag'],
  ['sep'],
  ['admin','#/admin','Administración','cog'],
  ['eventos','#/eventos','Eventos','log'],
  ['pruebas','#/pruebas','Pruebas físicas','chk']
];
const MOBILE_NAV=[['home','#/','Inicio','home'],['estructura','#/estructura','Files','files'],
  ['escanear','#/escanear','Escanear','scan'],['buscar','#/buscar','Buscar','search'],['mas','#/mas','Más','more']];

export const layoutMode=()=>{
  const m=S.meta.layout||'auto';
  if(m==='movil')return 'movil';
  if(m==='escritorio')return 'escritorio';
  return window.innerWidth>=1000?'escritorio':'movil';
};
export function setLayout(m){setMeta('layout',m)}

let cleanup=null;
export const setCleanup=f=>{cleanup=f};
export const runCleanup=()=>{if(cleanup){try{cleanup()}catch(e){}cleanup=null}};

/** render({title, body, nav, back, actions}) */
export function render(o){
  const app=$('#app');
  const u=me();
  const mob=layoutMode()==='movil';
  const pend=S.docs.filter(d=>d.state==='por_archivar').length;
  if(mob){
    app.className='m-shell';
    app.innerHTML=`<header class="m-top">${o.back?'<button class="icbtn" id="bk" aria-label="Volver">‹</button>':''}
      <h1>${esc(o.title)}</h1>${o.actions||''}</header>
      <main>${o.body}</main>
      <nav class="m-nav" aria-label="Principal">${MOBILE_NAV.map(([k,h,l,i])=>
        `<a href="${h}" class="${k==='escanear'?'fab':''}" ${o.nav===k?'aria-current="page"':''} aria-label="${l}">${IC[i]}${k==='escanear'?'':`<span>${l}</span>`}</a>`).join('')}</nav>`;
  }else{
    app.className='d-shell';
    app.innerHTML=`<aside class="d-side">
      <div class="d-brand"><b>${esc(S.company?S.company.razon:'Carpetas NFC')}</b><span>${S.company&&S.company.ruc?'RUC '+esc(S.company.ruc):'Gestión documental física-digital'}</span></div>
      <nav>${DESKTOP_NAV.map(r=>r[0]==='sep'?'<div class="sep"></div>':
        `<a href="${r[1]}" ${o.nav===r[0]?'aria-current="page"':''}>${IC[r[3]]}<span>${r[2]}</span>${r[0]==='bandeja'&&pend?` <span class="chip warn" style="margin-left:auto">${pend}</span>`:''}</a>`).join('')}</nav>
      <div class="who"><div class="sm"><b>${esc(u?u.name:'')}</b><div class="muted">${esc(u?ROLES[u.role]:'')}</div></div>
        <button class="btn s" id="logout" type="button">${IC.out} Salir</button></div></aside>
      <div class="d-main"><header class="d-top">${o.back?'<button class="icbtn" id="bk" aria-label="Volver">‹</button>':''}
        <h1>${esc(o.title)}</h1>${o.actions||''}</header><main>${o.body}</main></div>`;
  }
  const bk=$('#bk');
  if(bk)bk.addEventListener('click',()=>{typeof o.back==='string'?(location.hash=o.back):history.back()});
  const lo=$('#logout');
  if(lo)lo.addEventListener('click',()=>{location.hash='#/salir'});
  window.scrollTo(0,0);
}
export function renderAuth(body){
  const app=$('#app');app.className='auth';
  app.innerHTML=`<div class="auth-box">${body}</div>`;
}
export function toast(msg,ms=3400){
  const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=msg;
  document.body.appendChild(t);setTimeout(()=>t.remove(),ms);
}
export const go=h=>{if(location.hash===h)window.dispatchEvent(new HashChangeEvent('hashchange'));else location.hash=h};

/* ---------- componentes ---------- */
export const estChip=d=>d.state==='archivado'?'<span class="chip ok">Archivado</span>':'<span class="chip warn">Por archivar</span>';
export const ocrChip=d=>{
  const s=d.ocr&&d.ocr.state;
  return s==='done'?'<span class="chip ok">texto indexado</span>':s==='error'?'<span class="chip bad">OCR con error</span>'
    :s==='running'?'<span class="chip acc">procesando</span>':'<span class="chip">sin OCR</span>';
};
export const famChip=f=>f?`<span class="chip"><i style="background:${famColor(f)}"></i>${esc(f.name)}</span>`:'';
export function docRow(d,o={}){
  const f=fileById(d.fileId),t=typeById(d.docTypeId);
  return `<a class="item" href="#/d/${d.id}"><span class="t">${esc(d.name)}${d.demo?' <span class="chip">ejemplo</span>':''}</span>
    <span class="m">${o.showFile&&f?`<span class="code">${esc(f.code)}</span>`:''}<span>${esc(t?t.name:'sin tipo')} · ${d.pages} pág.</span>
    ${estChip(d)}${ocrChip(d)}${labelNames(d).map(l=>`<span class="chip">${esc(l)}</span>`).join('')}</span>
    ${o.snip?`<span class="sm muted">${o.snip}</span>`:''}${o.by?`<span class="m"><span class="chip acc">por ${esc(o.by)}</span></span>`:''}</a>`;
}
export const fileRow=f=>{
  const t=S.tags.find(x=>x.fileId===f.id&&x.state==='activo');
  const n=S.docs.filter(d=>d.fileId===f.id).length;
  return `<a class="item" href="#/f/${f.id}"><span class="t"><span class="code">${esc(f.code)}</span> ${esc(f.name)}</span>
    <span class="m">${famChip(famById(f.familyId))}${t?`<span class="chip ok">tag ${t.public}</span>`:'<span class="chip warn">sin tag</span>'}
    <span>${n} documento${n===1?'':'s'}</span>${f.location?`<span>${esc(f.location)}</span>`:''}</span></a>`;
};
export const needs=(p,what)=>can(p)?null:`<div class="banner warn">Tu rol (${esc(ROLES[me()?me().role:'consulta'])}) no permite ${esc(what)}. Pídele a un administrador que cambie tu rol.</div>`;

/* ---------- gráficos ---------- */
/** Barras horizontales con valor rotulado en cada barra. */
export function barChart(items,o={}){
  const max=Math.max(1,...items.map(i=>i.value));
  const rows=items.map(i=>`<div class="bar"><span class="nm">${i.color?`<i style="background:${i.color}"></i>`:''}${esc(i.name)}</span>
    <span class="track"><span class="fill" style="width:${Math.max(2,Math.round(i.value/max*100))}%;background:${i.color||'var(--s1)'}"></span></span>
    <span class="v">${i.value}</span></div>`).join('');
  const table=`<details class="sm"><summary class="muted">Ver como tabla</summary><div class="scrollx"><table><thead><tr><th>${esc(o.dim||'Categoría')}</th><th>Documentos</th></tr></thead><tbody>${items.map(i=>`<tr><td>${esc(i.name)}</td><td class="num">${i.value}</td></tr>`).join('')}</tbody></table></div></details>`;
  return `<div class="chart">${o.title?`<h2>${esc(o.title)}</h2>`:''}${o.note?`<div class="muted sm">${esc(o.note)}</div>`:''}
    ${items.length?`<div class="bars">${rows}</div>${table}`:'<div class="muted sm">Sin datos todavía.</div>'}</div>`;
}
/** Columnas verticales para una serie en el tiempo. */
export function colChart(items,o={}){
  const max=Math.max(1,...items.map(i=>i.value));
  return `<div class="chart">${o.title?`<h2>${esc(o.title)}</h2>`:''}${o.note?`<div class="muted sm">${esc(o.note)}</div>`:''}
    <div class="cols">${items.map(i=>`<div class="col"><span class="v">${i.value}</span>
      <span class="bx" style="height:${Math.max(3,Math.round(i.value/max*100))}%;background:${o.color||'var(--s1)'}"></span>
      <span class="cap">${esc(i.cap)}</span></div>`).join('')}</div>
    <details class="sm"><summary class="muted">Ver como tabla</summary><div class="scrollx"><table><thead><tr><th>${esc(o.dim||'Periodo')}</th><th>Documentos</th></tr></thead><tbody>${items.map(i=>`<tr><td>${esc(i.cap)}</td><td class="num">${i.value}</td></tr>`).join('')}</tbody></table></div></details></div>`;
}
export const kpi=(v,k,sub,alert)=>`<div class="kpi${alert?' alert':''}"><b>${esc(String(v))}</b><span class="k">${esc(k)}</span>${sub?`<span class="sub">${esc(sub)}</span>`:''}</div>`;
export const crumbs=parts=>`<div class="crumbs">${parts.map((p,i)=>(i?'<span>›</span>':'')+(p[1]?`<a href="${p[1]}">${esc(p[0])}</a>`:`<span>${esc(p[0])}</span>`)).join('')}</div>`;
export function confirmBtn(btn,label,fn){
  btn.addEventListener('click',()=>{
    if(btn.dataset.armed!=='1'){btn.dataset.armed='1';btn.dataset.prev=btn.textContent;btn.textContent=label;
      setTimeout(()=>{if(btn.dataset.armed==='1'){btn.dataset.armed='';btn.textContent=btn.dataset.prev}},4000);return}
    btn.dataset.armed='';fn();
  });
}

/* Estado de navegación compartido: de qué tag venimos y cuándo empezó la medición. */
export const Nav={viaFileId:null,viaAt:0,t0:null,src:null};
/** Llegar por el tag vale para este file y por diez minutos: después vuelve a contar como captura sin tag. */
export const cameFromTag=fileId=>Nav.viaFileId===fileId&&Date.now()-Nav.viaAt<600000;
