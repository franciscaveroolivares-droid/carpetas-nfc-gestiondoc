/* views-browse.js — inicio, dashboard, fichas madre, ficha del file, documento, búsqueda y bandeja. */
import {S,$,$$,esc,norm,queryTokens,searchDocs,snippet,fmtDate,fmtDay,fmtMB,daysSince,DAY,MONTHS,p2,
        famById,typeById,fileById,docById,userById,typesOfFamily,filesOfFamily,docsOfFile,activeTag,
        pending,labelNames,famColor,lastMovement,can,me,ROLES,put,ev,setMeta,isoLocal} from './core.js';
import {render,toast,go,docRow,fileRow,famChip,estChip,ocrChip,barChart,colChart,kpi,crumbs,needs,
        cameFromTag,setCleanup} from './ui.js';
import {ocrBlobs,download} from './lib.js';

/* ---------- inicio (celular) ---------- */
export function vHome(){
  const pend=pending();
  const u=me();
  render({title:S.company?S.company.razon:'Carpetas NFC',nav:'home',body:`
    <div class="card"><h2>Hola, ${esc(u.name.split(' ')[0])}</h2>
      <p class="muted sm" style="margin:0">Acerca el celular al tag del file, o escanea su QR, para abrir la carpeta y capturar.</p>
      <a class="btn pri block" href="#/escanear">Escanear tag</a></div>
    <div class="kpis">
      ${kpi(S.docs.length,'Documentos')}
      ${kpi(S.files.length,'Files')}
      ${kpi(pend.length,'Por archivar',pend.length?`el más antiguo, ${daysSince(pend[0].created)} día${daysSince(pend[0].created)===1?'':'s'}`:'',pend.length>0)}
      ${kpi(S.tags.filter(t=>t.state==='activo').length,'Tags activos')}
    </div>
    <div class="list">
      <a class="item" href="#/estructura"><span class="t">Fichas madre y files</span><span class="m">${S.families.length} familias · ${S.files.length} files</span></a>
      <a class="item" href="#/buscar"><span class="t">Buscar un documento</span><span class="m">Por nombre, tipo, etiqueta o contenido</span></a>
      <a class="item" href="#/bandeja"><span class="t">Por archivar</span><span class="m">${pend.length} pendiente${pend.length===1?'':'s'} de confirmar</span></a>
      <a class="item" href="#/dash"><span class="t">Dashboard</span><span class="m">Inventario por familia y por tipo</span></a>
    </div>
    ${S.docs.length?`<div class="card pad0"><div class="item flat"><span class="lbl">Último capturado</span></div>${docRow(S.docs.slice().sort((a,b)=>b.created-a.created)[0],{showFile:true})}</div>`:''}`});
}

/* ---------- dashboard ---------- */
export function vDash(){
  const byFam=S.families.slice().sort((a,b)=>a.order-b.order).map(f=>({
    name:f.name,color:famColor(f),
    value:S.docs.filter(d=>{const fl=fileById(d.fileId);return fl&&fl.familyId===f.id}).length}));
  const byType=S.docTypes.map(t=>({name:t.name,color:famColor(famById(t.familyId)),
      value:S.docs.filter(d=>d.docTypeId===t.id).length}))
    .filter(x=>x.value>0).sort((a,b)=>b.value-a.value).slice(0,10);
  const now=Date.now(),weeks=[];
  for(let i=3;i>=0;i--){
    const end=now-i*7*DAY,start=end-7*DAY;
    const d=new Date(start+DAY);
    weeks.push({cap:`${p2(d.getDate())} ${MONTHS[d.getMonth()]}`,
      value:S.docs.filter(x=>x.created>start&&x.created<=end).length});
  }
  const pend=pending();
  const quietCut=now-30*DAY;
  const quiet=S.files.filter(f=>lastMovement(f.id)<quietCut)
    .sort((a,b)=>lastMovement(a.id)-lastMovement(b.id));
  const weekAgo=now-7*DAY;
  const empties=S.events.filter(e=>e.type==='SEARCH_EMPTY'&&e.t>weekAgo);
  const last4=weeks.reduce((a,w)=>a+w.value,0);
  render({title:'Dashboard',nav:'dash',body:`
    <div class="kpis">
      ${kpi(S.docs.length,'Documentos en total',`${S.files.length} files · ${S.families.length} familias`)}
      ${kpi(last4,'Capturados en 4 semanas','ventanas de 7 días que terminan hoy')}
      ${kpi(pend.length,'Por archivar',pend.length?`antigüedad máxima: ${daysSince(pend[0].created)} día${daysSince(pend[0].created)===1?'':'s'}`:'nada pendiente',pend.length>0)}
      ${kpi(quiet.length,'Files sin movimiento','más de 30 días',quiet.length>0)}
      ${kpi(empties.length,'Búsquedas sin resultado','en los últimos 7 días',empties.length>0)}
    </div>
    <div class="grid2">
      <div class="card">${barChart(byFam,{title:'Documentos por familia',dim:'Familia'})}</div>
      <div class="card">${barChart(byType,{title:'Documentos por tipo documental',note:byType.length>=10?'Los diez tipos con más documentos.':'',dim:'Tipo documental'})}</div>
    </div>
    <div class="card">${colChart(weeks,{title:'Capturados en las últimas cuatro semanas',note:'Cada columna es una ventana de siete días; la última termina hoy.',dim:'Semana que inicia'})}</div>
    <div class="grid2">
      <div class="card pad0"><div class="item flat"><span class="t">Pendientes más antiguos</span><span class="m">Se destaca lo que lleva más de 7 días</span></div>
        ${pend.length?pend.slice(0,6).map(d=>{const a=daysSince(d.created);const f=fileById(d.fileId);
          return `<a class="item" href="#/d/${d.id}"><span class="t">${esc(d.name)}</span><span class="m">${f?`<span class="code">${esc(f.code)}</span>`:''}<span class="chip ${a>7?'bad':'warn'}">${a} día${a===1?'':'s'}</span></span></a>`}).join('')
          :'<div class="empty">Nada pendiente por archivar.</div>'}</div>
      <div class="card pad0"><div class="item flat"><span class="t">Files sin movimiento</span><span class="m">Sin documentos nuevos en 30 días</span></div>
        ${quiet.length?quiet.slice(0,6).map(f=>`<a class="item" href="#/f/${f.id}"><span class="t"><span class="code">${esc(f.code)}</span> ${esc(f.name)}</span><span class="m">${famChip(famById(f.familyId))}<span>último movimiento ${esc(fmtDay(lastMovement(f.id)))}</span></span></a>`).join('')
          :'<div class="empty">Todos los files tuvieron movimiento este mes.</div>'}</div>
    </div>
    <div class="card pad0"><div class="item flat"><span class="t">Búsquedas sin resultado de la semana</span><span class="m">La mejor fuente de mejoras del producto</span></div>
      ${empties.length?empties.slice(0,10).map(e=>`<a class="item" href="#/buscar?q=${encodeURIComponent(e.resourceId||e.note)}"><span class="t">${esc(e.resourceId||e.note)}</span><span class="m">${esc(fmtDate(e.t))}</span></a>`).join('')
        :'<div class="empty">Ninguna búsqueda quedó sin resultado esta semana.</div>'}</div>
    <p class="muted sm">El panel cuenta documentos: no suma montos ni cruza información contable. La promesa es inventario documental.</p>`});
}

/* ---------- fichas madre ---------- */
export function vEstructura(){
  const fams=S.families.slice().sort((a,b)=>a.order-b.order);
  render({title:'Fichas madre',nav:'estructura',body:`
    <div class="card"><div class="field"><label for="q">Filtrar files por código, nombre o ubicación</label>
      <input id="q" type="search" placeholder="C-014, planillas, estante B"></div>
      <p class="muted sm" style="margin:0">No distingue mayúsculas ni acentos, y acepta partes de palabra.</p></div>
    <div id="hits"></div>
    <div class="grid2" id="fams">${fams.map(f=>{
      const fl=filesOfFamily(f.id),dc=S.docs.filter(d=>{const x=fileById(d.fileId);return x&&x.familyId===f.id}).length;
      return `<a class="card" href="#/fam/${f.id}" style="text-decoration:none;color:inherit">
        <h2><span class="chip"><i style="background:${famColor(f)}"></i>${esc(f.name)}</span></h2>
        <div class="row tight"><span class="chip">${fl.length} file${fl.length===1?'':'s'}</span><span class="chip">${dc} documento${dc===1?'':'s'}</span><span class="chip">${typesOfFamily(f.id).length} tipos</span></div>
        <div class="muted sm">${typesOfFamily(f.id).map(t=>esc(t.name)).join(' · ')||'Sin tipos documentales'}</div></a>`}).join('')}</div>
    ${can('administrar')?'<a class="btn block" href="#/admin/estructura">Administrar familias y tipos</a>':''}`});
  const q=$('#q'),hits=$('#hits'),grid=$('#fams');
  const paint=()=>{
    const nq=norm(q.value);
    if(!nq){hits.innerHTML='';grid.hidden=false;return}
    grid.hidden=true;
    const r=S.files.filter(f=>norm(f.code+' '+f.name+' '+(f.location||'')).includes(nq))
      .sort((a,b)=>a.code.localeCompare(b.code,'es'));
    hits.innerHTML=`<div class="card pad0"><div class="item flat"><span class="t">${r.length} file${r.length===1?'':'s'} para “${esc(q.value)}”</span></div>`+
      (r.length?r.map(fileRow).join(''):'<div class="empty">Ningún file coincide. Quita el filtro para ver las familias.</div>')+'</div>';
  };
  q.addEventListener('input',paint);
}

export function vFamilia(fam){
  const files=filesOfFamily(fam.id);
  const dc=S.docs.filter(d=>{const x=fileById(d.fileId);return x&&x.familyId===fam.id}).length;
  render({title:fam.name,nav:'estructura',back:'#/estructura',body:`
    ${crumbs([['Fichas madre','#/estructura'],[fam.name,null]])}
    <div class="card"><h2><span class="chip"><i style="background:${famColor(fam)}"></i>${esc(fam.name)}</span></h2>
      <div class="row tight"><span class="chip">${filesOfFamily(fam.id).length} files</span><span class="chip">${dc} documentos</span></div>
      <div><span class="lbl">Tipos documentales de esta familia</span>
        <div class="chips" style="margin-top:6px">${typesOfFamily(fam.id).map(t=>`<span class="chip">${esc(t.name)}</span>`).join('')||'<span class="muted sm">Sin tipos</span>'}</div></div>
      <p class="muted sm" style="margin:0">La familia define qué tipos existen; cada file fija cuál se aplica por defecto al capturar.</p></div>
    <div class="card"><div class="field"><label for="q">Filtrar los files de esta familia</label><input id="q" type="search" placeholder="Código, nombre o ubicación"></div></div>
    <div class="list" id="lsf">${files.length?files.map(fileRow).join(''):'<div class="empty">Esta familia aún no tiene files.</div>'}</div>
    ${can('administrar')?`<a class="btn pri block" href="#/fam/${fam.id}/nuevo">+ Nuevo file en ${esc(fam.name)}</a>`:''}`});
  const q=$('#q'),box=$('#lsf');
  q.addEventListener('input',()=>{
    const nq=norm(q.value);
    const r=nq?files.filter(f=>norm(f.code+' '+f.name+' '+(f.location||'')).includes(nq)):files;
    box.innerHTML=r.length?r.map(fileRow).join(''):'<div class="empty">Ningún file de esta familia coincide.</div>';
  });
}

export function vNuevoFile(fam){
  const types=typesOfFamily(fam.id);
  render({title:'Nuevo file',nav:'estructura',back:'#/fam/'+fam.id,body:`
    ${needs('administrar','crear files')||''}
    <form class="card" id="nf">
      <h2>Nuevo file en ${esc(fam.name)}</h2>
      <div class="fgrid">
        <div class="field"><label for="cd">Código</label><input id="cd" required placeholder="C-022"></div>
        <div class="field"><label for="nm">Nombre</label><input id="nm" required placeholder="Compras 2027 · Facturas"></div>
      </div>
      <div class="fgrid">
        <div class="field"><label for="ty">Tipo documental por defecto</label><select id="ty">${types.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="lc">Ubicación física (opcional)</label><input id="lc" placeholder="Estante A, nivel 2"></div>
      </div>
      <button class="btn pri block" type="submit" ${can('administrar')?'':'disabled'}>Crear file</button></form>`});
  $('#nf').addEventListener('submit',async e=>{
    e.preventDefault();
    const {addFile}=await import('./core.js');
    const f=await addFile({familyId:fam.id,code:$('#cd').value,name:$('#nm').value,defaultDocTypeId:$('#ty').value,location:$('#lc').value});
    toast('File creado');go('#/f/'+f.id);
  });
}

/* ---------- ficha del file ---------- */
export function vFile(f,opts={}){
  const fam=famById(f.familyId),t=activeTag(f.id);
  const docs=docsOfFile(f.id);
  const total=docs.length;
  const pend=docsOfFile(f.id).filter(d=>d.state==='por_archivar');
  const viaTag=cameFromTag(f.id);
  render({title:f.code,nav:'estructura',back:fam?'#/fam/'+fam.id:'#/estructura',body:`
    ${crumbs([['Fichas madre','#/estructura'],[fam?fam.name:'—',fam?'#/fam/'+fam.id:null],[f.code,null]])}
    ${opts.ms!=null?`<div class="banner ok"><b>Carpeta abierta en ${opts.ms} ms.</b> ${esc(opts.via||'')}</div>`:''}
    <div class="card">
      <h2 style="font-size:21px">${esc(f.name)}</h2>
      <div class="row tight">${famChip(fam)}<span class="chip">${esc(f.code)}</span>
        ${t?`<span class="chip ok">tag ${t.public}</span>`:'<span class="chip warn">sin tag</span>'}
        <span class="chip">${total} documento${total===1?'':'s'}</span></div>
      <div class="muted sm">Tipo por defecto: ${esc(typeById(f.defaultDocTypeId)?typeById(f.defaultDocTypeId).name:'sin definir')}${f.location?` · Ubicación: ${esc(f.location)}`:''}</div>
      <div class="row">
        ${can('capturar')?`<a class="btn pri" href="#/f/${f.id}/escanear">Escanear documento</a>`:''}
        <a class="btn" href="#/f/${f.id}/tag">${t?'Ver tag':'Crear tag'}</a>
        <a class="btn" href="#/buscar?file=${f.id}">Buscar aquí</a></div>
    </div>
    ${pend.length&&viaTag&&can('archivar')?`<div class="banner warn"><span><b>${pend.length} documento${pend.length===1?'':'s'} por archivar.</b> Llegaste por el tag de este file: si el papel ya está dentro, confírmalo.</span>
      <button class="btn s" id="conf" type="button">Confirmar archivado de ${pend.length}</button></div>`:''}
    <div class="card"><div class="field"><label for="q">Buscar dentro de este file</label>
      <input id="q" type="search" placeholder="Nombre, tipo, etiqueta o contenido"></div></div>
    <div class="list" id="lsd">${docs.length?docs.map(d=>docRow(d)).join(''):'<div class="empty">Este file aún no tiene documentos.</div>'}</div>`});
  const q=$('#q'),box=$('#lsd');
  q.addEventListener('input',()=>{
    if(!q.value.trim()){box.innerHTML=docs.length?docs.map(d=>docRow(d)).join(''):'<div class="empty">Este file aún no tiene documentos.</div>';return}
    const res=searchDocs(q.value,{fileId:f.id});
    box.innerHTML=res.length?res.map(r=>docRow(r.doc,{by:r.by,
      snip:r.snip?`${esc(r.snip.before)}<mark>${esc(r.snip.hit)}</mark>${esc(r.snip.after)}`:null})).join('')
      :'<div class="empty">Ningún documento de este file coincide.</div>';
  });
  const c=$('#conf');
  if(c)c.addEventListener('click',async()=>{
    for(const d of pend){d.state='archivado';await put('docs',d);
      await ev('DOCUMENT_ARCHIVED',{resourceType:'document',resourceId:d.id,note:`Confirmado con el tag de ${f.code}`,kind:'ok'})}
    toast(`${pend.length} archivado${pend.length===1?'':'s'}`);go('#/f/'+f.id);
  });
}

/* ---------- documento ---------- */
export function vDoc(d){
  const f=fileById(d.fileId),fam=f?famById(f.familyId):null,t=typeById(d.docTypeId),u=userById(d.createdBy);
  let url=null;
  if(d.pdf){url=URL.createObjectURL(d.pdf);setCleanup(()=>URL.revokeObjectURL(url))}
  render({title:'Documento',nav:'estructura',back:f?'#/f/'+f.id:'#/buscar',body:`
    ${crumbs([['Fichas madre','#/estructura'],[fam?fam.name:'—',fam?'#/fam/'+fam.id:null],[f?f.code:'—',f?'#/f/'+f.id:null],['Documento',null]])}
    <div class="card">
      <h2 style="font-size:20px">${esc(d.name)}</h2>
      <div class="row tight">${estChip(d)}${ocrChip(d)}${famChip(fam)}<span class="chip">${esc(t?t.name:'sin tipo')}</span>
        ${labelNames(d).map(l=>`<span class="chip">${esc(l)}</span>`).join('')}${d.demo?'<span class="chip">ejemplo</span>':''}</div>
      <div class="scrollx"><table><tbody>
        <tr><th>Fecha del documento</th><td>${esc(d.docDate?fmtDate(d.docDate):'—')}</td></tr>
        <tr><th>Capturado</th><td>${esc(fmtDate(d.created))}${u?' por '+esc(u.name):''}</td></tr>
        <tr><th>Páginas</th><td>${d.pages}</td></tr>
        <tr><th>Tamaño</th><td>${esc(fmtMB(d.bytes))}</td></tr>
        <tr><th>Huella SHA-256</th><td class="mono" style="overflow-wrap:anywhere">${esc(d.hash||'—')}</td></tr>
      </tbody></table></div>
      ${url?`<div class="row"><a class="btn pri" href="${url}" target="_blank" rel="noopener">Abrir PDF</a>
        <button class="btn" id="dl" type="button">Descargar</button></div>`
        :'<div class="banner info">Documento de ejemplo: no tiene archivo PDF. Captura uno real para probar el visor y la descarga.</div>'}
      ${d.state==='por_archivar'&&can('archivar')?'<button class="btn block" id="ar" type="button">Marcar como archivado</button>':''}
    </div>
    <div class="card"><h2>Texto del documento (OCR)</h2><div id="ob"></div></div>
    <p class="muted sm">Una huella SHA-256 prueba que el archivo no cambió. No convierte el documento en evidencia legal.</p>`});
  const dl=$('#dl');
  if(dl)dl.addEventListener('click',()=>download(d.pdf,d.name.replace(/[^\w.\- ]+/g,'_')+'.pdf'));
  const ar=$('#ar');
  if(ar)ar.addEventListener('click',async()=>{
    d.state='archivado';await put('docs',d);
    await ev('DOCUMENT_ARCHIVED',{resourceType:'document',resourceId:d.id,note:'Marcado a mano',kind:'ok'});
    toast('Archivado');go('#/d/'+d.id);
  });
  const paint=()=>{
    const o=d.ocr||{state:'none'};
    const box=$('#ob');if(!box)return;
    box.innerHTML=o.state==='done'
      ? `<p class="sm" style="margin:0;white-space:pre-wrap;max-height:280px;overflow:auto">${esc((o.text||'').trim()||'(No se detectó texto)')}</p>
         <div class="muted sm">${o.ms?`Procesado en ${Math.round(o.ms/1000)} s.`:'Texto de ejemplo.'} La búsqueda por contenido ya encuentra este documento.</div>
         ${d.pageBlobs&&d.pageBlobs.length?'<button class="btn s" id="go" type="button">Repetir OCR</button>':''}`
      : o.state==='running' ? '<div class="spin"></div><p class="muted sm" id="op" style="margin:0;text-align:center">Procesando…</p>'
      : `${o.state==='error'?`<div class="banner bad">El OCR falló: ${esc(o.err||'error')}. El documento sigue guardado y se puede reintentar.</div>`
          :'<p class="muted sm" style="margin:0">La primera vez descarga el motor y el idioma español, varios MB. Necesita conexión.</p>'}
         ${d.pageBlobs&&d.pageBlobs.length?'<button class="btn pri block" id="go" type="button">Extraer texto</button>'
           :'<div class="banner info">Sin imágenes guardadas: este documento de ejemplo ya trae su texto cargado.</div>'}`;
    const g=$('#go');
    if(g)g.addEventListener('click',run);
  };
  const run=async()=>{
    d.ocr={state:'running',text:''};paint();
    const t0=performance.now();
    try{
      const text=await ocrBlobs(d.pageBlobs,p=>{const e=$('#op');if(e)e.textContent=p});
      d.ocr={state:'done',text,ms:performance.now()-t0};
      const {touchDoc}=await import('./core.js');touchDoc(d);
      await put('docs',d);
      await ev('OCR_DONE',{resourceType:'document',resourceId:d.id,ms:d.ocr.ms,
        note:`${d.pages} pág. · ${text.trim().split(/\s+/).filter(Boolean).length} palabras`,kind:'ok'});
    }catch(e){
      d.ocr={state:'error',err:e.message||String(e),text:''};await put('docs',d);
      await ev('OCR_FAILED',{resourceType:'document',resourceId:d.id,note:'El documento se conserva · '+(e.message||''),kind:'bad'});
    }
    paint();
  };
  paint();
}

/* ---------- búsqueda ---------- */
export function vBuscar(params){
  const st=Object.assign({q:'',familyId:'',fileId:'',docTypeId:'',state:'',from:'',to:'',dateBy:'cap',labels:[]},S.meta.search||{});
  if(params){
    if(params.has('q'))st.q=params.get('q');
    if(params.has('file')){st.fileId=params.get('file');const f=fileById(st.fileId);if(f)st.familyId=f.familyId}
    if(params.has('fam'))st.familyId=params.get('fam');
    if(params.has('tipo'))st.docTypeId=params.get('tipo');
    if(params.has('estado'))st.state=params.get('estado');
  }
  const famFiles=st.familyId?filesOfFamily(st.familyId):S.files.slice().sort((a,b)=>a.code.localeCompare(b.code,'es'));
  const famTypes=st.familyId?typesOfFamily(st.familyId):S.docTypes;
  render({title:'Búsqueda',nav:'buscar',body:`
    <form class="card" id="sf">
      <div class="field"><label for="q">Texto</label>
        <input id="q" type="search" value="${esc(st.q)}" placeholder="factura cemento, &quot;guía de remisión&quot;, SCTR" autocapitalize="none">
        <span class="hint">Ignora mayúsculas y acentos, acepta partes de palabra y exige todos los términos. Entre comillas busca la frase completa.</span></div>
      <div class="fgrid">
        <div class="field"><label for="fa">Familia</label><select id="fa"><option value="">Todas</option>${S.families.map(f=>`<option value="${f.id}" ${st.familyId===f.id?'selected':''}>${esc(f.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="fi">File</label><select id="fi"><option value="">Todos</option>${famFiles.map(f=>`<option value="${f.id}" ${st.fileId===f.id?'selected':''}>${esc(f.code)} · ${esc(f.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="ty">Tipo documental</label><select id="ty"><option value="">Todos</option>${famTypes.map(t=>`<option value="${t.id}" ${st.docTypeId===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="es">Estado</label><select id="es"><option value="">Todos</option><option value="archivado" ${st.state==='archivado'?'selected':''}>Archivados</option><option value="por_archivar" ${st.state==='por_archivar'?'selected':''}>Por archivar</option></select></div>
      </div>
      <div class="fgrid">
        <div class="field"><label for="db">Las fechas se refieren a</label><select id="db"><option value="cap" ${st.dateBy==='cap'?'selected':''}>Fecha de captura</option><option value="doc" ${st.dateBy==='doc'?'selected':''}>Fecha del documento</option></select></div>
        <div class="field"><label for="d1">Desde</label><input id="d1" type="date" value="${esc(st.from)}"></div>
        <div class="field"><label for="d2">Hasta</label><input id="d2" type="date" value="${esc(st.to)}"></div>
      </div>
      <div class="field"><label>Etiquetas</label><div class="chips" id="lb">${S.labels.map(l=>`<button type="button" data-l="${l.id}" aria-pressed="${st.labels.includes(l.id)}">${esc(l.name)}</button>`).join('')}</div></div>
      <div class="row"><button class="btn pri" type="submit">Buscar</button><button class="btn" type="button" id="cl">Limpiar</button></div>
    </form>
    <div id="rs"></div>`});
  const read=()=>({q:$('#q').value,familyId:$('#fa').value,fileId:$('#fi').value,docTypeId:$('#ty').value,
    state:$('#es').value,dateBy:$('#db').value,from:$('#d1').value,to:$('#d2').value,
    labels:$$('#lb button[aria-pressed="true"]').map(b=>b.dataset.l)});
  const run=async record=>{
    const f=read();setMeta('search',f);
    const res=searchDocs(f.q,f);
    const toks=queryTokens(f.q);
    if(record&&toks.length){
      await ev(res.length?'SEARCH':'SEARCH_EMPTY',{resourceType:'search',resourceId:f.q.trim(),
        note:`${res.length} resultado${res.length===1?'':'s'}`,kind:res.length?'ok':'bad'});
    }
    $('#rs').innerHTML=res.length
      ? `<div class="card pad0"><div class="item flat"><span class="t">${res.length} resultado${res.length===1?'':'s'}</span>
          <span class="m">${toks.length?`términos: ${toks.map(t=>`<span class="chip">${esc(t)}</span>`).join(' ')}`:'sin texto, solo filtros'}</span></div>
         ${res.map(r=>docRow(r.doc,{showFile:true,by:r.by,
           snip:r.snip?`${esc(r.snip.before)}<mark>${esc(r.snip.hit)}</mark>${esc(r.snip.after)}`:null})).join('')}</div>`
      : `<div class="banner warn"><b>Sin resultados${toks.length?` para “${esc(f.q)}”`:''}.</b>
         ${S.docs.some(d=>!d.ocr||d.ocr.state!=='done')?'Hay documentos cuyo texto aún no está indexado: esos solo se encuentran por nombre, tipo o etiqueta. Abre el documento y extrae su texto.':'Prueba con menos términos o quita algún filtro.'}
         ${toks.length?'<span class="sm">Esta búsqueda queda registrada; la lista de búsquedas sin resultado está en el dashboard.</span>':''}</div>`;
  };
  $('#sf').addEventListener('submit',e=>{e.preventDefault();run(true)});
  $('#fa').addEventListener('change',()=>{const f=read();setMeta('search',Object.assign(f,{fileId:'',docTypeId:''}));go('#/buscar')});
  $$('#lb button').forEach(b=>b.addEventListener('click',()=>{b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'))}));
  $('#cl').addEventListener('click',()=>{setMeta('search',null);go('#/buscar')});
  if(st.q||st.familyId||st.fileId||st.docTypeId||st.state||st.from||st.to||st.labels.length)run(false);
}

/* ---------- bandeja por archivar ---------- */
export function vBandeja(){
  const pend=pending();
  const sel=new Set();
  render({title:'Por archivar',nav:'bandeja',body:`
    <div class="card"><h2>${pend.length} documento${pend.length===1?'':'s'} por archivar</h2>
      <p class="muted sm" style="margin:0">Nacen así cuando se capturan sin tocar el tag del file. Ya se pueden consultar y enviar; al guardar el papel en su file, escanea el tag y confirma.</p>
      ${pend.length?`<div class="row">${can('archivar')?'<button class="btn pri" id="cf" type="button" disabled>Confirmar seleccionados (0)</button><button class="btn" id="al" type="button">Seleccionar todos</button>':''}
        <a class="btn" href="#/escanear">Escanear un tag</a></div>`:''}
      ${needs('archivar','confirmar el archivado')||''}</div>
    ${pend.length?`<div class="list" id="ls">${pend.map(d=>{
      const a=daysSince(d.created),f=fileById(d.fileId);
      return `<label class="item flat" style="flex-direction:row;align-items:flex-start;gap:10px">
        ${can('archivar')?`<input type="checkbox" data-d="${d.id}" style="width:20px;height:20px;margin-top:3px;accent-color:var(--accent)">`:''}
        <span style="display:flex;flex-direction:column;gap:4px;min-width:0;flex:1">
          <span class="t">${esc(d.name)}</span>
          <span class="m">${f?`<a class="code" href="#/f/${f.id}">${esc(f.code)}</a>`:''}<span>${esc(typeById(d.docTypeId)?typeById(d.docTypeId).name:'')} · ${d.pages} pág.</span>
            <span class="chip ${a>7?'bad':'warn'}">${a} día${a===1?'':'s'}</span><a href="#/d/${d.id}">abrir</a></span></span></label>`}).join('')}</div>`
      :'<div class="card"><div class="empty">Nada pendiente. Todo lo capturado está archivado.</div></div>'}`});
  const btn=$('#cf');
  if(!btn)return;
  const upd=()=>{btn.disabled=sel.size===0;btn.textContent=`Confirmar seleccionados (${sel.size})`};
  $$('input[data-d]').forEach(i=>i.addEventListener('change',()=>{i.checked?sel.add(i.dataset.d):sel.delete(i.dataset.d);upd()}));
  $('#al').addEventListener('click',()=>{$$('input[data-d]').forEach(i=>{i.checked=true;sel.add(i.dataset.d)});upd()});
  btn.addEventListener('click',async()=>{
    for(const id of sel){const d=docById(id);if(!d)continue;d.state='archivado';await put('docs',d);
      await ev('DOCUMENT_ARCHIVED',{resourceType:'document',resourceId:d.id,note:'Confirmado en lote desde la bandeja',kind:'ok'})}
    toast(`${sel.size} archivado${sel.size===1?'':'s'}`);go('#/bandeja');
  });
}
