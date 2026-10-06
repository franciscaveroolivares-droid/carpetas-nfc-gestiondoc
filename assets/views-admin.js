/* views-admin.js — administración, eventos, diagnóstico, pruebas físicas y menú del celular. */
import {S,$,$$,esc,fmtDate,fmtTime,norm,put,del,ev,setMeta,wipe,MEM,ROLES,PERMS,me,can,createUser,
        setPassword,userById,famById,typeById,fileById,typesOfFamily,filesOfFamily,activeTag,tagsOfFile,
        revokeTag,uid,SERIES,famColor,seedDemo,removeDemo,STORES,loadAll} from './core.js';
import {render,toast,go,needs,confirmBtn,famChip,setLayout,layoutMode,DESKTOP_NAV,IC} from './ui.js';
import {baseUrl,tagUrl} from './views-capture.js';
import {needQR,needJsQR,needOCR,download} from './lib.js';

const TESTS=[
  ['qr-native','Escanear el QR con la cámara normal del celular abre la plataforma y pide la contraseña'],
  ['qr-login','Después del login, vuelve al file que se escaneó y no a la pantalla de inicio'],
  ['qr-app','Escanear el QR desde la app, con sesión abierta, abre la carpeta en menos de 2 s'],
  ['nfc-tap','Acercar el celular a un chip NFC abre la plataforma sin abrir la app a mano'],
  ['nfc-write','Grabar un chip NFC desde la app y verificarlo (Android con Chrome)'],
  ['print','Las etiquetas impresas se leen a 20 cm y a 40 cm'],
  ['light','Una etiqueta pegada en un file palanca se lee con poca luz'],
  ['capture','Capturar un documento de 3 páginas toma menos de 30 s por página'],
  ['pdf','El PDF se abre en el visor del teléfono y las páginas están en orden'],
  ['ocr','El OCR encuentra una palabra que solo existe dentro de un comprobante real'],
  ['search-acc','Buscar sin acentos encuentra el documento escrito con acentos, y al revés'],
  ['revoke','Un tag revocado ya no abre la carpeta y el mensaje no revela qué file era'],
  ['roles','Un usuario con rol Consulta no ve el botón de capturar'],
  ['clone','Un chip NFC copiado a otro abre lo mismo: confirma que la seguridad está en el login']
];

/* ---------- hub ---------- */
export function vAdmin(){
  if(!can('administrar')){
    render({title:'Administración',nav:'admin',body:needs('administrar','entrar a la administración')});
    return;
  }
  render({title:'Administración',nav:'admin',body:`
    <div class="list">
      <a class="item" href="#/admin/usuarios"><span class="t">Usuarios y roles</span><span class="m">${S.users.length} usuario${S.users.length===1?'':'s'} · el administrador define la contraseña</span></a>
      <a class="item" href="#/admin/estructura"><span class="t">Familias, tipos y etiquetas</span><span class="m">${S.families.length} familias · ${S.docTypes.length} tipos · ${S.labels.length} etiquetas</span></a>
      <a class="item" href="#/admin/tags"><span class="t">Tags</span><span class="m">${S.tags.filter(t=>t.state==='activo').length} activos · ${S.tags.filter(t=>t.state!=='activo').length} revocados</span></a>
      <a class="item" href="#/admin/empresa"><span class="t">Empresa y ajustes</span><span class="m">${esc(S.company.razon)}</span></a>
      <a class="item" href="#/admin/datos"><span class="t">Datos de este equipo</span><span class="m">Exportar, importar, ejemplos y borrado</span></a>
    </div>
    <div class="card"><h2>Qué protege esta maqueta y qué no</h2>
      <p class="muted sm" style="margin:0">El login y los roles están aquí para probar el flujo completo, incluido el paso previo al abrir un tag. No son seguridad real: todo corre en el navegador, sin servidor, y cualquiera con acceso a este equipo puede leer los datos guardados. En el producto, la autorización vive en el backend y filtra por empresa en cada consulta.</p></div>`});
}

/* ---------- usuarios ---------- */
export function vUsuarios(){
  if(!can('administrar')){render({title:'Usuarios',nav:'admin',body:needs('administrar','ver usuarios')});return}
  const yo=me();
  render({title:'Usuarios',nav:'admin',back:'#/admin',body:`
    <div class="card pad0"><div class="scrollx"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>
      ${S.users.map(u=>`<tr><td><b>${esc(u.name)}</b><div class="muted sm">${esc(u.email)}</div>
          ${u.lockedUntil&&u.lockedUntil>Date.now()?'<span class="chip bad">bloqueado</span>':''}</td>
        <td>${u.id===yo.id?esc(ROLES[u.role]):`<select data-r="${u.id}" style="min-height:36px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);padding:4px 6px">
          ${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${u.role===k?'selected':''}>${v}</option>`).join('')}</select>`}</td>
        <td>${u.state==='activo'?'<span class="chip ok">activo</span>':'<span class="chip bad">inactivo</span>'}</td>
        <td><div class="row tight"><button class="btn s" data-pw="${u.id}" type="button">Contraseña</button>
          ${u.id===yo.id?'<span class="chip">tú</span>':`<button class="btn s" data-st="${u.id}" type="button">${u.state==='activo'?'Desactivar':'Activar'}</button>`}</div></td></tr>`).join('')}
    </tbody></table></div></div>
    <div id="pwbox"></div>
    <form class="card" id="nu"><h2>Nuevo usuario</h2>
      <p class="muted sm" style="margin:0">La contraseña la defines tú aquí y se la entregas a la persona. Ella puede cambiarla luego en Mi cuenta.</p>
      <div class="fgrid">
        <div class="field"><label for="n">Nombre</label><input id="n" required></div>
        <div class="field"><label for="e">Correo</label><input id="e" type="email" required autocapitalize="none"></div>
        <div class="field"><label for="r">Rol</label><select id="r">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${k==='operador'?'selected':''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label for="p">Contraseña <span class="chip">mínimo 8</span></label><input id="p" type="password" required minlength="8" autocomplete="new-password"></div>
      </div>
      <div id="ue"></div><button class="btn pri block" type="submit">Crear usuario</button></form>
    <div class="card"><h2>Qué puede hacer cada rol</h2><div class="scrollx"><table><thead><tr><th>Rol</th><th>Ver</th><th>Capturar</th><th>Archivar</th><th>Administrar</th></tr></thead><tbody>
      ${Object.entries(ROLES).map(([k,v])=>`<tr><td>${v}</td>${['ver','capturar','archivar','administrar'].map(p=>
        `<td><span class="ck ${PERMS[k].includes(p)?'y':'n'}">${PERMS[k].includes(p)?'Sí':'No'}</span></td>`).join('')}</tr>`).join('')}
    </tbody></table></div></div>`});
  $$('select[data-r]').forEach(s=>s.addEventListener('change',async()=>{
    const u=userById(s.dataset.r);u.role=s.value;await put('users',u);
    await ev('USER_ROLE_CHANGED',{resourceType:'user',resourceId:u.id,note:`${u.email} → ${ROLES[u.role]}`,kind:'ok'});
    toast('Rol actualizado');
  }));
  $$('button[data-st]').forEach(b=>b.addEventListener('click',async()=>{
    const u=userById(b.dataset.st);u.state=u.state==='activo'?'inactivo':'activo';await put('users',u);
    await ev('USER_STATE_CHANGED',{resourceType:'user',resourceId:u.id,note:`${u.email} → ${u.state}`,kind:u.state==='activo'?'ok':'bad'});
    go('#/admin/usuarios');
  }));
  $$('button[data-pw]').forEach(b=>b.addEventListener('click',()=>{
    const u=userById(b.dataset.pw);
    $('#pwbox').innerHTML=`<form class="card" id="pf"><h2>Nueva contraseña para ${esc(u.name)}</h2>
      <div class="field"><label for="np">Contraseña</label><input id="np" type="password" required minlength="8" autocomplete="new-password"></div>
      <div class="row"><button class="btn pri" type="submit">Guardar</button><button class="btn" type="button" id="pc">Cancelar</button></div></form>`;
    $('#np').focus();
    $('#pc').addEventListener('click',()=>{$('#pwbox').innerHTML=''});
    $('#pf').addEventListener('submit',async e=>{
      e.preventDefault();await setPassword(u,$('#np').value);
      $('#pwbox').innerHTML='';toast('Contraseña restablecida');
    });
  }));
  $('#nu').addEventListener('submit',async e=>{
    e.preventDefault();
    const em=$('#e').value.trim().toLowerCase();
    if(S.users.some(u=>u.email===em)){$('#ue').innerHTML='<div class="banner bad">Ya existe un usuario con ese correo.</div>';return}
    await createUser({name:$('#n').value,email:em,role:$('#r').value,password:$('#p').value});
    toast('Usuario creado');go('#/admin/usuarios');
  });
}

/* ---------- familias, tipos y etiquetas ---------- */
export function vAdminEstructura(){
  if(!can('administrar')){render({title:'Estructura',nav:'admin',body:needs('administrar','administrar la estructura')});return}
  render({title:'Familias y tipos',nav:'admin',back:'#/admin',body:`
    <p class="muted sm" style="margin:0">La familia madre define qué tipos documentales existen. Cada file elige uno como valor por defecto, y así el usuario captura sin clasificar.</p>
    ${S.families.slice().sort((a,b)=>a.order-b.order).map(f=>`
      <div class="card"><h2>${famChip(f)}</h2>
        <div class="row tight">${SERIES.map((c,i)=>`<button class="btn s" data-col="${f.id}" data-i="${i}" title="Color ${i+1}" style="background:${c};border-color:${c};width:34px;min-width:34px;padding:0;${f.colorSlot===i?'outline:2px solid var(--ink);outline-offset:2px':''}" aria-label="Color ${i+1}"></button>`).join('')}</div>
        <div class="fgrid"><div class="field"><label for="fn-${f.id}">Nombre</label>
          <input id="fn-${f.id}" value="${esc(f.name)}" data-fn="${f.id}"></div></div>
        <div><span class="lbl">Tipos documentales</span>
          <div class="list" style="margin-top:6px">${typesOfFamily(f.id).map(t=>`
            <div class="item flat" style="flex-direction:row;align-items:center;gap:8px">
              <span style="flex:1;min-width:0">${esc(t.name)}</span>
              <span class="chip">${S.docs.filter(d=>d.docTypeId===t.id).length} doc.</span>
              <button class="btn s bad" data-dt="${t.id}" type="button">Quitar</button></div>`).join('')
            ||'<div class="empty">Sin tipos todavía.</div>'}</div></div>
        <form class="row" data-add="${f.id}"><input placeholder="Nuevo tipo documental" required style="flex:1 1 180px;border:1px solid var(--line);background:var(--surface-2);border-radius:10px;padding:9px 11px;min-height:42px">
          <button class="btn s" type="submit">Agregar tipo</button></form></div>`).join('')}
    <form class="card" id="nf"><h2>Nueva familia madre</h2>
      <div class="field"><label for="fnm">Nombre</label><input id="fnm" required placeholder="Tributario"></div>
      <button class="btn pri block" type="submit">Crear familia</button></form>
    <div class="card"><h2>Etiquetas rápidas</h2>
      <div class="chips">${S.labels.map(l=>`<span class="chip">${esc(l.name)} <button data-lb="${l.id}" type="button" aria-label="Quitar ${esc(l.name)}" style="border:0;background:transparent;cursor:pointer;color:inherit">✕</button></span>`).join('')||'<span class="muted sm">Sin etiquetas.</span>'}</div>
      <form class="row" id="nl"><input id="lnm" placeholder="Nueva etiqueta" required style="flex:1 1 180px;border:1px solid var(--line);background:var(--surface-2);border-radius:10px;padding:9px 11px;min-height:42px">
        <button class="btn s" type="submit">Agregar</button></form></div>`});
  $$('input[data-fn]').forEach(i=>i.addEventListener('change',async()=>{
    const f=famById(i.dataset.fn);f.name=i.value.trim()||f.name;await put('families',f);toast('Familia renombrada');
  }));
  $$('button[data-col]').forEach(b=>b.addEventListener('click',async()=>{
    const f=famById(b.dataset.col);f.colorSlot=+b.dataset.i;await put('families',f);go('#/admin/estructura');
  }));
  $$('button[data-dt]').forEach(b=>b.addEventListener('click',async()=>{
    const t=typeById(b.dataset.dt);
    const used=S.docs.filter(d=>d.docTypeId===t.id).length+S.files.filter(f=>f.defaultDocTypeId===t.id).length;
    if(used){toast('No se puede quitar: hay documentos o files que lo usan');return}
    await del('docTypes',t.id);S.docTypes=S.docTypes.filter(x=>x.id!==t.id);
    await ev('DOCTYPE_REMOVED',{resourceType:'docType',resourceId:t.id,note:t.name});
    go('#/admin/estructura');
  }));
  $$('form[data-add]').forEach(f=>f.addEventListener('submit',async e=>{
    e.preventDefault();
    const fid=f.dataset.add,inp=f.querySelector('input');
    const t={id:uid('dt'),companyId:S.company.id,familyId:fid,name:inp.value.trim(),order:typesOfFamily(fid).length};
    S.docTypes.push(t);await put('docTypes',t);
    await ev('DOCTYPE_ADDED',{resourceType:'docType',resourceId:t.id,note:t.name,kind:'ok'});
    go('#/admin/estructura');
  }));
  $('#nf').addEventListener('submit',async e=>{
    e.preventDefault();
    const fam={id:uid('fam'),companyId:S.company.id,name:$('#fnm').value.trim(),
      colorSlot:S.families.length%8,order:S.families.length,created:Date.now()};
    S.families.push(fam);await put('families',fam);
    await ev('FAMILY_CREATED',{resourceType:'family',resourceId:fam.id,note:fam.name,kind:'ok'});
    go('#/admin/estructura');
  });
  $$('button[data-lb]').forEach(b=>b.addEventListener('click',async()=>{
    const id=b.dataset.lb;
    if(S.docs.some(d=>(d.labels||[]).includes(id))){toast('No se puede quitar: hay documentos con esa etiqueta');return}
    await del('labels',id);S.labels=S.labels.filter(l=>l.id!==id);go('#/admin/estructura');
  }));
  $('#nl').addEventListener('submit',async e=>{
    e.preventDefault();
    const l={id:uid('lb'),companyId:S.company.id,name:$('#lnm').value.trim(),useCount:0};
    S.labels.push(l);await put('labels',l);go('#/admin/estructura');
  });
}

/* ---------- tags ---------- */
export function vAdminTags(){
  if(!can('administrar')){render({title:'Tags',nav:'admin',body:needs('administrar','administrar tags')});return}
  const rows=S.tags.slice().sort((a,b)=>b.assignedAt-a.assignedAt);
  render({title:'Tags',nav:'admin',back:'#/admin',body:`
    <p class="muted sm" style="margin:0">El identificador impreso es aleatorio y no revela empresa ni file. Revocar un tag no toca el file: se le asigna otro y el historial se conserva.</p>
    <div class="card pad0"><div class="scrollx"><table><thead><tr><th>Identificador</th><th>File</th><th>Estado</th><th>Asignado</th><th></th></tr></thead><tbody>
      ${rows.length?rows.map(t=>{const f=fileById(t.fileId);return `<tr>
        <td class="mono">${esc(t.public)}</td>
        <td>${f?`<a href="#/f/${f.id}"><b>${esc(f.code)}</b></a><div class="muted sm">${esc(f.name)}</div>`:'<span class="muted">file eliminado</span>'}</td>
        <td>${t.state==='activo'?'<span class="chip ok">activo</span>':'<span class="chip bad">revocado</span>'}</td>
        <td class="sm muted">${esc(fmtDate(t.assignedAt))}</td>
        <td>${t.state==='activo'&&f?`<button class="btn s bad" data-rv="${t.public}" type="button">Revocar</button>`:''}</td></tr>`}).join('')
        :'<tr><td colspan="5"><div class="empty">Todavía no hay tags. Crea uno desde la ficha de un file.</div></td></tr>'}
    </tbody></table></div></div>`});
  $$('button[data-rv]').forEach(b=>confirmBtn(b,'Confirmar',async()=>{
    const t=S.tags.find(x=>x.public===b.dataset.rv);
    const {newTag}=await import('./core.js');
    await revokeTag(t);await newTag(t.fileId);
    toast('Tag revocado y reemplazado');go('#/admin/tags');
  }));
}

/* ---------- empresa y ajustes ---------- */
export function vEmpresa(){
  if(!can('administrar')){render({title:'Empresa',nav:'admin',body:needs('administrar','ver los ajustes')});return}
  const c=S.company;
  render({title:'Empresa y ajustes',nav:'admin',back:'#/admin',body:`
    <form class="card" id="cf"><h2>Empresa</h2>
      <div class="fgrid">
        <div class="field"><label for="rz">Razón social</label><input id="rz" value="${esc(c.razon)}" required></div>
        <div class="field"><label for="ruc">RUC</label><input id="ruc" value="${esc(c.ruc||'')}" inputmode="numeric"></div>
      </div><button class="btn pri" type="submit">Guardar</button></form>
    <div class="card"><h2>URL base de los tags</h2>
      <div class="field"><label for="bu">Dirección</label><input id="bu" value="${esc(baseUrl())}"></div>
      <p class="muted sm" style="margin:0">Los QR y los chips llevan esta dirección. Si cambia, los tags ya impresos o grabados dejan de abrir. Fíjala antes de imprimir el primer lote.</p>
      <button class="btn" id="sb" type="button">Guardar URL</button></div>
    <div class="card"><h2>Vista</h2>
      <div class="seg" role="group" aria-label="Vista">
        ${[['auto','Automática'],['movil','Celular'],['escritorio','Escritorio']].map(([k,l])=>
          `<button type="button" data-lay="${k}" aria-pressed="${(S.meta.layout||'auto')===k}">${l}</button>`).join('')}</div>
      <p class="muted sm" style="margin:0">Automática usa el ancho de la pantalla: barra inferior en el celular, barra lateral en el navegador. Fíjala si quieres ver la otra vista en este equipo.</p>
      <label class="sm" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ao" ${S.meta.autoOcr?'checked':''}> Extraer el texto (OCR) automáticamente al guardar</label></div>`});
  $('#cf').addEventListener('submit',async e=>{
    e.preventDefault();c.razon=$('#rz').value.trim();c.ruc=$('#ruc').value.trim();
    await put('company',c);toast('Empresa actualizada');go('#/admin/empresa');
  });
  $('#sb').addEventListener('click',()=>{setMeta('baseUrl',$('#bu').value.trim());toast('URL guardada')});
  $$('button[data-lay]').forEach(b=>b.addEventListener('click',()=>{setLayout(b.dataset.lay);go('#/admin/empresa')}));
  $('#ao').addEventListener('change',e=>setMeta('autoOcr',e.target.checked));
}

/* ---------- datos ---------- */
export function vDatos(){
  if(!can('administrar')){render({title:'Datos',nav:'admin',body:needs('administrar','administrar los datos')});return}
  render({title:'Datos de este equipo',nav:'admin',back:'#/admin',body:`
    <div class="card"><h2>Llevar la estructura a otro equipo</h2>
      <p class="muted sm" style="margin:0">Exporta empresa, usuarios, familias, tipos, files, tags y etiquetas. Los documentos y sus PDF no viajan: viven en el navegador donde se capturaron. El archivo incluye el hash de las contraseñas, así que trátalo como información sensible.</p>
      <div class="row"><button class="btn" id="ex" type="button">Exportar</button>
        <label class="btn" for="im">Importar</label><input id="im" type="file" accept="application/json" hidden></div></div>
    <div class="card"><h2>Datos de ejemplo</h2>
      <p class="muted sm" style="margin:0">${S.meta.demo?'Hay files y documentos de ejemplo cargados, marcados con la etiqueta “ejemplo”.':'No hay datos de ejemplo cargados.'}</p>
      ${S.meta.demo?'<button class="btn" id="rd" type="button">Quitar los datos de ejemplo</button>'
        :'<button class="btn" id="sd" type="button">Cargar datos de ejemplo</button>'}</div>
    <div class="card"><h2>Estado del almacenamiento</h2>
      <div class="scrollx"><table><tbody>
        <tr><th>IndexedDB</th><td>${MEM?'<span class="ck n">No disponible: los datos se perderán al cerrar</span>':'<span class="ck y">Activo</span>'}</td></tr>
        <tr><th>Documentos</th><td>${S.docs.length}</td></tr>
        <tr><th>Files</th><td>${S.files.length}</td></tr>
        <tr><th>Eventos</th><td>${S.events.length}</td></tr>
      </tbody></table></div></div>
    <div class="card"><h2>Borrar todo</h2>
      <p class="muted sm" style="margin:0">Elimina empresa, usuarios y documentos de este navegador y vuelve al primer arranque. No se puede deshacer.</p>
      <button class="btn bad block" id="wp" type="button">Borrar todo</button></div>`});
  $('#ex').addEventListener('click',async()=>{
    const data={v:1,exported:Date.now(),company:S.company,users:S.users,families:S.families,
      docTypes:S.docTypes,files:S.files.map(f=>Object.assign({},f)),tags:S.tags,labels:S.labels};
    download(new Blob([JSON.stringify(data,null,1)],{type:'application/json'}),'estructura-carpetas-nfc.json');
    await ev('EXPORT',{note:`${S.files.length} files · ${S.users.length} usuarios`,kind:'ok'});
  });
  $('#im').addEventListener('change',async e=>{
    try{
      const j=JSON.parse(await e.target.files[0].text());
      if(!j.company)throw new Error('El archivo no tiene una empresa');
      let n=0;
      S.company=j.company;await put('company',S.company);
      for(const [store,arr,key] of [['users',j.users,'id'],['families',j.families,'id'],['docTypes',j.docTypes,'id'],
        ['files',j.files,'id'],['tags',j.tags,'public'],['labels',j.labels,'id']]){
        for(const o of arr||[]){
          const list=S[store];
          if(!list.some(x=>x[key]===o[key])){list.push(o);await put(store,o);n++}
        }
      }
      await ev('IMPORT',{note:`${n} registros nuevos`,kind:'ok'});
      toast(`${n} registros importados`);go('#/admin/datos');
    }catch(x){toast('No se pudo importar: '+x.message)}
  });
  const sd=$('#sd');if(sd)sd.addEventListener('click',async()=>{await seedDemo();toast('Ejemplos cargados');go('#/admin/datos')});
  const rd=$('#rd');if(rd)confirmBtn(rd,'Confirmar: quitar ejemplos',async()=>{await removeDemo();toast('Ejemplos eliminados');go('#/admin/datos')});
  confirmBtn($('#wp'),'Toca de nuevo para borrar todo',async()=>{
    await wipe();
    S.company=null;S.users=[];S.families=[];S.docTypes=[];S.files=[];S.tags=[];S.docs=[];S.labels=[];S.events=[];
    for(const k of Object.keys(S.meta))delete S.meta[k];
    try{sessionStorage.clear();localStorage.clear()}catch(e){}
    location.hash='#/';location.reload();
  });
}

/* ---------- eventos ---------- */
export function vEventos(){
  const q=norm(S.meta.evQ||'');
  const rows=S.events.filter(e=>!q||norm(e.type+' '+e.note+' '+e.resourceId).includes(q));
  render({title:'Eventos',nav:'eventos',body:`
    <div class="card"><h2>Tabla <code>event</code></h2>
      <p class="muted sm" style="margin:0">De aquí salen el dashboard y las métricas del piloto: taps por tag, capturas con su duración, búsquedas con su término y archivados.</p>
      <div class="field"><label for="q">Filtrar</label><input id="q" type="search" placeholder="TAG_TAP, login, factura"></div></div>
    <div class="card pad0"><div class="scrollx"><table><thead><tr><th>Evento</th><th>Recurso</th><th>Detalle</th><th>Quién</th></tr></thead>
      <tbody id="tb">${rows.length?rows.map(rowHTML).join(''):'<tr><td colspan="4"><div class="empty">Sin eventos.</div></td></tr>'}</tbody></table></div></div>`});
  const inp=$('#q');
  inp.addEventListener('input',()=>{
    const nq=norm(inp.value);
    const r=S.events.filter(e=>!nq||norm(e.type+' '+e.note+' '+e.resourceId).includes(nq));
    $('#tb').innerHTML=r.length?r.map(rowHTML).join(''):'<tr><td colspan="4"><div class="empty">Ningún evento coincide.</div></td></tr>';
  });
}
const rowHTML=e=>{
  const u=e.userId?userById(e.userId):null;
  return `<tr><td><b class="mono ${e.kind==='bad'?'ck n':e.kind==='ok'?'ck y':''}">${esc(e.type)}</b>
    <div class="muted sm mono">${esc(fmtTime(e.t))}${e.ms!=null?` · ${e.ms>=1000?(e.ms/1000).toFixed(1)+' s':e.ms+' ms'}`:''}</div></td>
    <td class="mono sm" style="overflow-wrap:anywhere">${esc(e.resourceId||'—')}</td>
    <td class="sm">${esc(e.note)}</td>
    <td class="sm muted">${esc(u?u.name:'—')}</td></tr>`;
};

/* ---------- diagnóstico ---------- */
export function vDiag(){
  const ua=navigator.userAgent,ios=/iPhone|iPad|iPod/.test(ua);
  const canvasFilter=(()=>{try{return 'filter' in document.createElement('canvas').getContext('2d')}catch(e){return false}})();
  const rows=[
    ['HTTPS',window.isSecureContext,'Sin HTTPS no hay cámara ni NFC.','Aloja la página con HTTPS'],
    ['Cámara',!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia),'Captura y lector de QR dentro de la app.','Queda la cámara del sistema como alternativa'],
    ['Lector de QR del navegador',('BarcodeDetector' in window)?true:'w','Si falta, la app usa jsQR.','Usa jsQR, algo más lento'],
    ['Lectura NFC desde la página',('NDEFReader' in window),'Solo Android con Chrome.',ios?'En iPhone el sistema abre la URL del chip por su cuenta':'No disponible en este navegador'],
    ['Grabación NFC desde la página',('NDEFReader' in window),'Para codificar chips durante el arranque asistido.','Graba los chips con una app como NFC Tools'],
    ['Almacenamiento (IndexedDB)',!MEM,'Guarda files, documentos y eventos.','Los datos se perderán al cerrar'],
    ['Huella SHA-256 y PBKDF2',!!(window.crypto&&crypto.subtle),'Integridad del PDF y hash de contraseñas.','Sin HTTPS no está disponible'],
    ['Filtro de contraste en canvas',canvasFilter,'Mejora la legibilidad al capturar.','Se captura sin mejorar, habitual en Safari']
  ];
  render({title:'Diagnóstico',nav:'pruebas',body:`
    <p class="muted sm" style="margin:0">La decisión técnica pendiente del DEF: confirmar NFC y QR en los celulares reales del cliente piloto. Abre esta pantalla en cada equipo.</p>
    <div class="card pad0"><div class="scrollx"><table><thead><tr><th>Capacidad</th><th>Resultado</th></tr></thead><tbody>
      ${rows.map(([n,ok,why,no])=>`<tr><td><b>${esc(n)}</b><div class="muted sm">${esc(why)}</div></td>
        <td><span class="ck ${ok===true?'y':ok==='w'?'w':'n'}">${ok===true?'✓ Sí':ok==='w'?'~ Parcial':'✕ No'}</span>
        ${ok===true?'':`<div class="muted sm">${esc(no)}</div>`}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="card"><h2>Librerías externas</h2>
      <p class="muted sm" style="margin:0">Se descargan la primera vez que se usan. Pruébalas ahora para saber si la red del cliente las permite.</p>
      <div class="row"><button class="btn s" data-l="qr" type="button">Generador de QR</button>
        <button class="btn s" data-l="jsqr" type="button">Lector jsQR</button>
        <button class="btn s" data-l="ocr" type="button">Motor de OCR</button></div>
      <div id="ls" class="sm"></div></div>
    <div class="card"><h2>Este equipo</h2>
      <p class="mono" style="margin:0;overflow-wrap:anywhere">${esc(ua)}</p>
      <p class="muted sm" style="margin:0">Pantalla ${screen.width}×${screen.height} · densidad ${window.devicePixelRatio}× · vista ${layoutMode()}</p></div>`});
  $$('button[data-l]').forEach(b=>b.addEventListener('click',async()=>{
    $('#ls').textContent='Cargando…';
    try{await ({qr:needQR,jsqr:needJsQR,ocr:needOCR})[b.dataset.l]();
      $('#ls').innerHTML=`<span class="ck y">✓</span> ${esc(b.textContent)} disponible`}
    catch(e){$('#ls').innerHTML=`<span class="ck n">✕</span> ${esc(b.textContent)}: no se pudo cargar. Revisa la conexión o el bloqueo de la red.`}
  }));
}

/* ---------- pruebas físicas ---------- */
export function vPruebas(){
  const T=S.meta.tests||{};
  const done=TESTS.filter(([k])=>(T[k]||{}).r==='ok').length;
  render({title:'Pruebas físicas',nav:'pruebas',body:`
    <div class="card"><h2>${done} de ${TESTS.length} pruebas pasadas</h2>
      <div class="prog"><i style="width:${Math.round(done/TESTS.length*100)}%"></i></div>
      <p class="muted sm" style="margin:0">Marca el resultado y anota lo que viste. Se guarda en este navegador; el botón de abajo copia todo para pegarlo donde lo necesites.</p></div>
    <div class="list">${TESTS.map(([k,t])=>`<div class="item flat"><span class="t">${esc(t)}</span>
      <div class="fgrid" style="margin-top:4px">
        <select data-k="${k}" style="min-height:42px;border:1px solid var(--line);background:var(--surface-2);border-radius:10px;padding:8px 10px">
          <option value="">Sin probar</option>
          <option value="ok" ${(T[k]||{}).r==='ok'?'selected':''}>Pasó</option>
          <option value="fail" ${(T[k]||{}).r==='fail'?'selected':''}>Falló</option></select>
        <input data-n="${k}" placeholder="Nota: qué equipo, qué pasó" value="${esc((T[k]||{}).n||'')}"
          style="min-height:42px;border:1px solid var(--line);background:var(--surface-2);border-radius:10px;padding:8px 10px"></div></div>`).join('')}</div>
    <button class="btn block" id="cp" type="button">Copiar resultados</button>`});
  const save=()=>{
    const o={};
    $$('select[data-k]').forEach(s=>{o[s.dataset.k]={r:s.value,n:($(`input[data-n="${s.dataset.k}"]`)||{}).value||''}});
    setMeta('tests',o);
  };
  $$('select[data-k]').forEach(s=>s.addEventListener('change',()=>{save();go('#/pruebas')}));
  $$('input[data-n]').forEach(i=>i.addEventListener('change',save));
  $('#cp').addEventListener('click',async()=>{
    save();
    const t=S.meta.tests||{};
    const txt=TESTS.map(([k,d])=>{const x=t[k]||{};return `[${x.r==='ok'?'PASÓ':x.r==='fail'?'FALLÓ':'—'}] ${d}${x.n?' → '+x.n:''}`}).join('\n')
      +`\n\nEquipo: ${navigator.userAgent}\nFecha: ${fmtDate(Date.now())}`;
    try{await navigator.clipboard.writeText(txt);toast('Resultados copiados')}catch(e){toast('No se pudo copiar')}
  });
}

/* ---------- menú del celular ---------- */
export function vMas(){
  const u=me();
  render({title:'Más',nav:'mas',body:`
    <div class="card"><h2>${esc(u.name)}</h2><div class="muted sm">${esc(u.email)} · ${esc(ROLES[u.role])}</div>
      <a class="btn block" href="#/perfil">Mi cuenta</a></div>
    <div class="list">
      ${DESKTOP_NAV.filter(r=>r[0]!=='sep'&&!['estructura','buscar','escanear'].includes(r[0]))
        .filter(r=>r[0]!=='admin'||can('administrar'))
        .map(r=>`<a class="item" href="${r[1]}"><span class="t">${esc(r[2])}</span></a>`).join('')}
      <a class="item" href="#/diag"><span class="t">Diagnóstico del equipo</span></a>
    </div>
    <button class="btn bad block" id="so" type="button">Cerrar sesión</button>
    <p class="muted sm">Carpetas NFC · maqueta de campo. Los datos viven en este navegador.</p>`});
  confirmBtn($('#so'),'Toca de nuevo para salir',()=>go('#/salir'));
}
