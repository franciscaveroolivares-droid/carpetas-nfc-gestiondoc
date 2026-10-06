/* views-capture.js — escanear tags, resolver, capturar documentos, tag del file y etiquetas. */
import {S,$,$$,esc,fmtDate,fmtMB,isoLocal,uid,sha256,put,ev,setMeta,can,me,
        famById,typeById,fileById,activeTag,tagsOfFile,typesOfFamily,docsOfFile,newTag,revokeTag,
        touchDoc,labelById} from './core.js';
import {render,toast,go,Nav,cameFromTag,setCleanup,needs,famChip,estChip,crumbs,confirmBtn} from './ui.js';
import {qrSVG,parseTag,buildPDF,startCam,stopCam,frameToPage,hasNFC,nfcScan,nfcWrite,ocrBlobs,idemKey,download} from './lib.js';

export const baseUrl=()=>S.meta.baseUrl||(location.origin&&location.origin!=='null'
  ? location.origin+location.pathname : location.href.split('#')[0]);
export const tagUrl=p=>baseUrl()+'#/t/'+p;

/* ---------- escanear un tag ---------- */
export function vEscanear(){
  let mode=S.meta.scanMode||'qr',stream=null,ctl=null,run=false;
  render({title:'Escanear tag',nav:'escanear',body:`
    <div class="seg" role="group" aria-label="Método de lectura">
      <button type="button" id="mq" aria-pressed="${mode==='qr'}">Cámara (QR)</button>
      <button type="button" id="mn" aria-pressed="${mode==='nfc'}">NFC</button></div>
    <div id="pane"></div>
    <form class="card" id="mf"><div class="field"><label for="mc">O escribe el código del tag</label>
      <input id="mc" placeholder="8F29QK3T" autocomplete="off" autocapitalize="characters" spellcheck="false"></div>
      <button class="btn block" type="submit">Abrir</button></form>
    <p class="muted sm">El tag solo dice a qué file apunta. Si no hay sesión, primero pide la contraseña y después abre la carpeta.</p>`});
  const stop=()=>{run=false;stopCam(stream);stream=null;if(ctl){try{ctl.abort()}catch(e){}ctl=null}};
  setCleanup(stop);
  const open=(txt,src)=>{
    const p=parseTag(txt);
    if(!p){toast('Ese código no corresponde a un tag de este sistema');return}
    stop();Nav.t0=performance.now();Nav.src=src;go('#/t/'+p);
  };
  const pane=()=>{
    stop();setMeta('scanMode',mode);
    $('#mq').setAttribute('aria-pressed',String(mode==='qr'));
    $('#mn').setAttribute('aria-pressed',String(mode==='nfc'));
    if(mode==='qr'){
      $('#pane').innerHTML=`<div class="cam"><video id="v" playsinline muted></video>
        <div class="guide qr" hidden id="gd"></div>
        <div class="msg" id="cm"><span>Apunta al QR de la etiqueta.</span>
          <button class="btn pri" id="st" type="button">Activar cámara</button></div></div>
        <div id="qs" class="sm muted"></div>`;
      $('#st').addEventListener('click',async()=>{
        try{stream=await startCam($('#v'))}
        catch(e){$('#cm').innerHTML=`<span>No se pudo abrir la cámara: ${esc(e.name==='NotAllowedError'?'permiso denegado':e.message)}</span>`;return}
        $('#cm').hidden=true;$('#gd').hidden=false;run=true;
        let det=null;
        if('BarcodeDetector' in window){try{det=new window.BarcodeDetector({formats:['qr_code']})}catch(e){}}
        if(!det){
          const {needJsQR}=await import('./lib.js');
          try{await needJsQR()}catch(e){$('#qs').textContent='No se pudo cargar el lector de QR. Revisa la conexión.';return}
        }
        $('#qs').textContent=det?'Lector: BarcodeDetector del navegador.':'Lector: jsQR.';
        const cv=document.createElement('canvas'),cx=cv.getContext('2d',{willReadFrequently:true});
        const tick=async()=>{
          if(!run)return;
          const v=$('#v');
          try{
            if(v&&v.videoWidth){
              if(det){const r=await det.detect(v);if(r.length){open(r[0].rawValue,'qr-app');return}}
              else{
                const k=Math.min(1,640/v.videoWidth);
                cv.width=Math.round(v.videoWidth*k);cv.height=Math.round(v.videoHeight*k);
                cx.drawImage(v,0,0,cv.width,cv.height);
                const im=cx.getImageData(0,0,cv.width,cv.height);
                const r=window.jsQR(im.data,cv.width,cv.height,{inversionAttempts:'dontInvert'});
                if(r&&r.data){open(r.data,'qr-app');return}
              }
            }
          }catch(e){}
          setTimeout(tick,det?120:200);
        };
        tick();
      });
    }else{
      $('#pane').innerHTML=hasNFC
        ? `<div class="card"><h2>Lectura NFC</h2><p class="muted sm" style="margin:0">Activa la lectura y acerca el celular al tag.</p>
           <button class="btn pri block" id="na" type="button">Activar lectura NFC</button><div id="nst"></div></div>`
        : `<div class="banner warn"><b>Este navegador no lee NFC desde la página.</b>
           <span>En Android usa Chrome. En iPhone no hace falta esta pantalla: si el chip contiene la URL, basta acercar el celular y el sistema la abre solo.</span></div>`;
      const na=$('#na');
      if(na)na.addEventListener('click',async()=>{
        $('#nst').innerHTML='<div class="banner info">Acerca el tag al celular…</div>';
        try{ctl=await nfcScan(txt=>open(txt,'nfc-app'),m=>{$('#nst').innerHTML=`<div class="banner bad">${esc(m)}</div>`})}
        catch(e){$('#nst').innerHTML=`<div class="banner bad">No se pudo activar el NFC: ${esc(e.name==='NotAllowedError'?'permiso denegado o NFC apagado en el teléfono':e.message)}</div>`}
      });
    }
  };
  $('#mq').addEventListener('click',()=>{mode='qr';pane()});
  $('#mn').addEventListener('click',()=>{mode='nfc';pane()});
  $('#mf').addEventListener('submit',e=>{e.preventDefault();open($('#mc').value,'manual')});
  pane();
}

/* ---------- resolver un tag ---------- */
const SRC={'qr-app':'Leído por QR dentro de la app.','nfc-app':'Leído por NFC dentro de la app.',
  'manual':'Código escrito a mano.','url':'Abierto desde el enlace del tag: cámara del teléfono o NFC del sistema.'};
export async function vResolver(pub,viaLogin){
  const src=Nav.src||'url',t0=Nav.t0;
  Nav.t0=null;Nav.src=null;
  const t=S.tags.find(x=>x.public===pub);
  const f=t?fileById(t.fileId):null;
  if(!t||!f||t.state!=='activo'){
    await ev('TAG_DENIED',{resourceType:'tag',resourceId:pub,kind:'bad',
      note:'Motivo interno: '+(!t?'tag desconocido':t.state==='revocado'?'tag revocado':'file inexistente')});
    render({title:'Tag',nav:'escanear',body:`
      <div class="card" style="text-align:center"><h2>Este tag no está disponible</h2>
        <p class="muted" style="margin:0">Si crees que es un error, contacta al administrador de tu empresa.</p>
        <a class="btn block" href="#/escanear">Volver a escanear</a></div>
      <p class="muted sm">El mensaje es el mismo para un tag revocado, uno de otra empresa y uno inexistente: no revela qué file era. El motivo real queda en el registro de eventos.</p>`});
    return;
  }
  Nav.viaFileId=f.id;Nav.viaAt=Date.now();
  const ms=Math.round(t0!=null?performance.now()-t0:performance.now());
  history.replaceState(null,'','#/f/'+f.id);
  await ev('TAG_TAP',{resourceType:'tag',resourceId:pub,ms,kind:'ok',
    note:`${f.code} · ${src}${viaLogin?' · con login en medio':''}`});
  const {vFile}=await import('./views-browse.js');
  vFile(f,{ms,via:(SRC[src]||'')+(viaLogin?' Incluye el tiempo del login, así que no se compara con el objetivo de 2 s.':
    t0!=null?' Medido desde la lectura del tag.':' Medido desde que se abrió la página.')});
}

/* ---------- tag del file ---------- */
export async function vTag(f){
  const t=activeTag(f.id),hist=tagsOfFile(f.id);
  render({title:'Tag de '+f.code,nav:'estructura',back:'#/f/'+f.id,body:`
    ${crumbs([[f.code,'#/f/'+f.id],['Tag',null]])}
    <div id="tg">${t?'<div class="card"><div class="spin"></div></div>':`
      <div class="card"><h2>Este file no tiene tag activo</h2>
        <p class="muted sm" style="margin:0">Se genera un identificador aleatorio. El QR y el chip solo contienen una URL con ese identificador: no revelan la empresa ni el file.</p>
        <button class="btn pri block" id="mk" type="button" ${can('administrar')?'':'disabled'}>Crear tag</button>
        ${needs('administrar','crear tags')||''}</div>`}</div>
    ${hist.length>1?`<div class="card"><h2>Historial</h2>${hist.map(x=>`<div class="m sm"><span class="mono">${x.public}</span>
      <span class="chip ${x.state==='activo'?'ok':'bad'}">${x.state}</span>
      <span class="muted">${esc(fmtDate(x.assignedAt))}</span></div>`).join('')}</div>`:''}`});
  const mk=$('#mk');
  if(mk)mk.addEventListener('click',async()=>{await newTag(f.id);toast('Tag creado');go('#/f/'+f.id+'/tag')});
  if(!t)return;
  let svg='';
  try{svg=await qrSVG(tagUrl(t.public))}
  catch(e){svg='<p class="muted sm">No se pudo cargar el generador de QR. Revisa la conexión y vuelve a entrar.</p>'}
  if(!$('#tg'))return;
  $('#tg').innerHTML=`<div class="card"><div class="qrbox">${svg}</div>
      <div class="url" id="u">${esc(tagUrl(t.public))}</div>
      <div class="row"><button class="btn" id="cp" type="button">Copiar URL</button>
        <button class="btn" id="tt" type="button">Probar aquí</button>
        <a class="btn" href="#/etiquetas">Imprimir etiqueta</a></div></div>
    <div class="card"><h2>Chip NFC</h2>
      <p class="muted sm" style="margin:0">${hasNFC
        ?'Android con Chrome: graba la URL en un chip NDEF, como NTAG213 o NTAG215, y verifícalo.'
        :'Este navegador no graba NFC. En Android con Chrome sí. En iPhone, graba el chip con una app como NFC Tools: al acercarlo, el sistema abre la URL solo.'}</p>
      <div class="row"><button class="btn pri" id="nw" type="button" ${hasNFC&&can('administrar')?'':'disabled'}>Grabar en NFC</button>
        <button class="btn" id="nv" type="button" ${hasNFC?'':'disabled'}>Verificar chip</button></div>
      <div id="ns" class="sm"></div></div>
    ${can('administrar')?'<button class="btn bad block" id="rv" type="button">Revocar y reemplazar</button>':''}`;
  let ctl=null;setCleanup(()=>{if(ctl){try{ctl.abort()}catch(e){}}});
  const ns=m=>{$('#ns').innerHTML=m};
  $('#cp').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(tagUrl(t.public));toast('URL copiada')}
    catch(e){const r=document.createRange();r.selectNodeContents($('#u'));
      const s=getSelection();s.removeAllRanges();s.addRange(r);toast('Selecciona y copia la URL')}
  });
  $('#tt').addEventListener('click',()=>{Nav.t0=performance.now();Nav.src='manual';go('#/t/'+t.public)});
  $('#nw').addEventListener('click',async()=>{
    ns('<div class="banner info">Acerca el celular al chip y mantenlo quieto…</div>');
    try{ctl=await nfcWrite(tagUrl(t.public));
      await ev('NFC_WRITTEN',{resourceType:'tag',resourceId:t.public,note:f.code,kind:'ok'});
      ns('<div class="banner ok"><b>Chip grabado.</b> Toca “Verificar chip” para leerlo de nuevo.</div>')}
    catch(e){ns(`<div class="banner bad">No se pudo grabar: ${esc(e.name==='NotAllowedError'?'permiso denegado o NFC apagado':e.message)}</div>`)}
  });
  $('#nv').addEventListener('click',async()=>{
    ns('<div class="banner info">Acerca el chip para leerlo…</div>');
    try{
      ctl=await nfcScan((txt,sn)=>{
        try{ctl.abort()}catch(e){}
        const p=parseTag(txt);
        if(p===t.public){
          ns(`<div class="banner ok"><b>Coincide.</b> El chip contiene ${esc(p)}. Serie del chip: <span class="mono">${esc(sn||'no disponible')}</span></div>`);
          ev('NFC_VERIFIED',{resourceType:'tag',resourceId:p,note:'Serie '+(sn||'desconocida'),kind:'ok'});
        }else ns(`<div class="banner bad"><b>No coincide.</b> Leído: ${esc(txt||'(vacío)')}</div>`);
      },m=>ns(`<div class="banner bad">${esc(m)}</div>`));
    }catch(e){ns(`<div class="banner bad">No se pudo leer: ${esc(e.message)}</div>`)}
  });
  const rv=$('#rv');
  if(rv)confirmBtn(rv,'Toca de nuevo para revocar',async()=>{
    await revokeTag(t);await newTag(f.id);
    toast('Tag revocado y reemplazado');go('#/f/'+f.id+'/tag');
  });
}

/* ---------- captura ---------- */
export function vCaptura(f){
  if(!can('capturar')){
    render({title:'Escanear',nav:'estructura',back:'#/f/'+f.id,body:needs('capturar','capturar documentos')});
    return;
  }
  const C={pages:[],stream:null,t0:Date.now(),taps:0,enh:S.meta.enhance!==false,saved:false};
  setCleanup(()=>{stopCam(C.stream);if(!C.saved)C.pages.forEach(p=>URL.revokeObjectURL(p.url))});
  const addFiles=async list=>{
    for(const file of list){
      if(C.pages.length>=30){toast('Máximo 30 páginas por captura');break}
      try{
        const bm=await createImageBitmap(file);
        C.pages.push(await frameToPage(bm,bm.width,bm.height,C.enh));
        if(bm.close)bm.close();
      }catch(e){toast('No se pudo leer una de las imágenes')}
    }
    draw();
  };
  const draw=()=>{
    render({title:'Escanear en '+f.code,nav:'estructura',back:'#/f/'+f.id,body:`
      <div class="cam"><video id="v" playsinline muted></video><div class="guide" id="gd" hidden></div>
        <div class="msg" id="cm"><span>Coloca el documento sobre una superficie plana y con buena luz.</span>
          <button class="btn pri" id="oc" type="button">Abrir cámara</button></div></div>
      <div class="camctl">
        <label class="btn s" for="gal">Cámara del sistema</label>
        <input id="gal" type="file" accept="image/*" capture="environment" multiple hidden>
        <button class="shutter" id="sh" type="button" aria-label="Capturar página" ${C.stream?'':'disabled'}></button>
        <button class="btn pri s" id="fin" type="button" ${C.pages.length?'':'disabled'}>Terminar (${C.pages.length})</button></div>
      <label class="sm muted" style="display:flex;gap:8px;align-items:center">
        <input type="checkbox" id="en" ${C.enh?'checked':''}> Mejorar contraste al capturar</label>
      ${C.pages.length?`<div class="strip" id="strip">${C.pages.map((p,i)=>
        `<div class="th"><img src="${p.url}" alt="Página ${i+1}"><button data-i="${i}" aria-label="Quitar página ${i+1}">✕</button></div>`).join('')}</div>`:''}
      <p class="muted sm">Cada toma se agrega como una página. Al terminar se arma un solo PDF.</p>`});
    if(C.stream){const v=$('#v');v.srcObject=C.stream;v.play().catch(()=>{});$('#cm').hidden=true;$('#gd').hidden=false}
    $('#oc').addEventListener('click',async()=>{
      try{
        C.stream=await startCam($('#v'));
        $('#cm').hidden=true;$('#gd').hidden=false;$('#sh').disabled=false;
        if(!C.pages.length)C.t0=Date.now();
      }catch(e){
        $('#cm').innerHTML=`<span>No se pudo abrir la cámara: ${esc(e.name==='NotAllowedError'?'permiso denegado':e.message)}. Usa “Cámara del sistema”.</span>`;
      }
    });
    $('#gal').addEventListener('change',e=>{if(!C.pages.length)C.t0=Date.now();C.taps++;addFiles([...e.target.files])});
    $('#en').addEventListener('change',e=>{C.enh=e.target.checked;setMeta('enhance',C.enh)});
    $('#sh').addEventListener('click',async()=>{
      const v=$('#v');
      if(!v||!v.videoWidth)return;
      if(C.pages.length>=30){toast('Máximo 30 páginas por captura');return}
      C.taps++;v.style.filter='brightness(2)';setTimeout(()=>{v.style.filter=''},120);
      C.pages.push(await frameToPage(v,v.videoWidth,v.videoHeight,C.enh));
      draw();
    });
    $$('.th button').forEach(b=>b.addEventListener('click',()=>{
      const i=+b.dataset.i;URL.revokeObjectURL(C.pages[i].url);C.pages.splice(i,1);draw();
    }));
    $('#fin').addEventListener('click',()=>{stopCam(C.stream);C.stream=null;meta()});
  };
  const meta=()=>{
    const fam=famById(f.familyId),types=typesOfFamily(f.familyId);
    const def=typeById(f.defaultDocTypeId);
    const now=Date.now();
    const viaTag=cameFromTag(f.id);
    const pages=()=>C.pages.map((p,i)=>`<div class="pg"><img src="${p.url}" alt="">
      <span class="mono">Pág. ${i+1}</span><span class="sp"></span>
      <button class="btn s" data-a="l" data-i="${i}" ${i?'':'disabled'} aria-label="Subir">▲</button>
      <button class="btn s" data-a="r" data-i="${i}" ${i<C.pages.length-1?'':'disabled'} aria-label="Bajar">▼</button>
      <button class="btn s" data-a="x" data-i="${i}" aria-label="Quitar">✕</button></div>`).join('');
    render({title:'Antes de guardar',nav:'estructura',body:`
      <div class="card pad0" style="padding:10px;gap:8px" id="pgs">${pages()}</div>
      <form class="card" id="mf">
        <div class="field"><label for="ty">Tipo documental <span class="chip" id="th">heredado del file</span></label>
          <select id="ty">${types.map(t=>`<option value="${t.id}" ${def&&t.id===def.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="nm">Nombre (opcional)</label>
          <input id="nm" placeholder="${esc((def?def.name:'Documento')+' · '+fmtDate(now))}"></div>
        <div class="field"><label for="dt">Fecha del documento</label><input id="dt" type="datetime-local" value="${isoLocal(now)}"></div>
        <div class="field"><label>Etiquetas</label><div class="chips" id="lb">${S.labels.map(l=>
          `<button type="button" data-l="${l.id}" aria-pressed="false">${esc(l.name)}</button>`).join('')}</div></div>
        <div class="banner ${viaTag?'ok':'warn'}">${viaTag
          ?'Llegaste por el tag de este file, así que el documento queda <b>Archivado</b>.'
          :'No llegaste por el tag, así que queda <b>Por archivar</b> hasta que escanees el tag y lo confirmes.'}</div>
        <button class="btn pri block" type="submit">Guardar</button></form>`});
    const rebind=()=>$$('#pgs button').forEach(b=>b.addEventListener('click',()=>{
      const i=+b.dataset.i,a=b.dataset.a;
      if(a==='x'){URL.revokeObjectURL(C.pages[i].url);C.pages.splice(i,1)}
      if(a==='l'){const t=C.pages[i-1];C.pages[i-1]=C.pages[i];C.pages[i]=t}
      if(a==='r'){const t=C.pages[i+1];C.pages[i+1]=C.pages[i];C.pages[i]=t}
      if(!C.pages.length){draw();return}
      $('#pgs').innerHTML=pages();rebind();
    }));
    rebind();
    const sel=new Set();
    $$('#lb button').forEach(b=>b.addEventListener('click',()=>{
      const l=b.dataset.l;
      if(sel.has(l))sel.delete(l);else sel.add(l);
      b.setAttribute('aria-pressed',String(sel.has(l)));
    }));
    $('#ty').addEventListener('change',()=>{
      const ch=!def||$('#ty').value!==def.id;
      $('#th').textContent=ch?'corregido a mano':'heredado del file';
      $('#th').className='chip '+(ch?'warn':'');
    });
    $('#mf').addEventListener('submit',e=>{
      e.preventDefault();C.taps++;
      save({docTypeId:$('#ty').value,name:$('#nm').value.trim()||$('#nm').placeholder,
        docDate:$('#dt').value,labels:[...sel],viaTag,changed:!def||$('#ty').value!==def.id});
    });
  };
  const save=async m=>{
    const key=idemKey();
    render({title:'Guardando',nav:'estructura',body:`<div class="card" style="text-align:center">
      <div class="spin"></div><b id="sm">Generando el PDF…</b><div class="prog"><i id="sp" style="width:20%"></i></div>
      <span class="muted sm">Clave de idempotencia ${esc(key)}: si el envío se repite, no se crea un segundo documento.</span></div>`});
    try{
      const parts=[];
      for(const p of C.pages)parts.push({bytes:new Uint8Array(await p.blob.arrayBuffer()),w:p.w,h:p.h});
      const pdf=buildPDF(parts);
      $('#sp').style.width='60%';$('#sm').textContent='Calculando la huella…';
      const hash=await sha256(pdf);
      $('#sp').style.width='90%';
      const d={id:uid('d'),companyId:S.company.id,fileId:f.id,docTypeId:m.docTypeId,name:m.name,
        state:m.viaTag?'archivado':'por_archivar',docDate:m.docDate,pages:C.pages.length,bytes:pdf.length,hash,
        labels:m.labels,created:Date.now(),createdBy:me().id,idem:key,
        pdf:new Blob([pdf],{type:'application/pdf'}),pageBlobs:C.pages.map(p=>p.blob),
        ocr:{state:'none',text:''},demo:false};
      S.docs.push(d);await put('docs',d);
      for(const lid of m.labels){const l=labelById(lid);if(l){l.useCount=(l.useCount||0)+1;await put('labels',l)}}
      const total=Date.now()-C.t0;
      await ev('DOCUMENT_UPLOADED',{resourceType:'document',resourceId:d.id,ms:total,kind:'ok',
        note:`${f.code} · ${typeById(d.docTypeId)?typeById(d.docTypeId).name:''}${m.changed?' (tipo corregido)':''} · ${d.pages} pág. · ${fmtMB(d.bytes)} · ${d.state}`});
      C.saved=true;C.pages.forEach(p=>URL.revokeObjectURL(p.url));
      const per=Math.round(total/1000/d.pages);
      render({title:'Guardado',nav:'estructura',body:`
        <div class="card" style="text-align:center"><h2>Guardado en ${esc(f.code)}</h2>
          <p style="margin:0">${esc(d.name)}</p>
          <div class="chips" style="justify-content:center">${estChip(d)}<span class="chip">${d.pages} pág.</span><span class="chip">${esc(fmtMB(d.bytes))}</span></div>
          <div class="banner ${per<30?'ok':'bad'}">${d.pages} página${d.pages>1?'s':''} en ${Math.round(total/1000)} s, ${per} s por página y ${C.taps} toques. El objetivo del DEF es menos de 30 s por página.</div>
          ${d.state==='por_archivar'?'<p class="muted sm" style="margin:0">Cuando guardes el papel en su file, escanea el tag y confirma el archivado.</p>':''}</div>
        <div class="row"><a class="btn pri" href="#/d/${d.id}">Ver documento</a>
          <a class="btn" href="#/f/${f.id}/escanear">Escanear otro</a>
          <a class="btn" href="#/f/${f.id}">Volver al file</a></div>`});
      if(S.meta.autoOcr)runOCRQuiet(d);
    }catch(e){
      console.error(e);
      render({title:'No se guardó',nav:'estructura',body:`
        <div class="banner bad"><b>No se pudo guardar.</b> ${esc(e.message)}. Las páginas capturadas siguen en memoria.</div>
        <button class="btn block" id="rb" type="button">Volver a los metadatos</button>`});
      $('#rb').addEventListener('click',meta);
    }
  };
  draw();
}
async function runOCRQuiet(d){
  d.ocr={state:'running',text:''};
  const t0=performance.now();
  try{
    const text=await ocrBlobs(d.pageBlobs);
    d.ocr={state:'done',text,ms:performance.now()-t0};touchDoc(d);await put('docs',d);
    await ev('OCR_DONE',{resourceType:'document',resourceId:d.id,ms:d.ocr.ms,note:'Automático al guardar',kind:'ok'});
    toast('Texto indexado: ya se busca por contenido');
  }catch(e){
    d.ocr={state:'error',err:e.message||String(e),text:''};await put('docs',d);
    await ev('OCR_FAILED',{resourceType:'document',resourceId:d.id,note:'El documento se conserva',kind:'bad'});
  }
}

/* ---------- etiquetas imprimibles ---------- */
export async function vEtiquetas(){
  const withTag=S.files.filter(f=>activeTag(f.id)).sort((a,b)=>a.code.localeCompare(b.code,'es'));
  const st={sel:new Set(withTag.map(f=>f.id)),fmt:S.meta.lblFmt||'a4'};
  render({title:'Etiquetas',nav:'etiquetas',body:withTag.length?`
    <div class="card"><h2>Files con tag activo</h2>
      <div style="display:flex;flex-direction:column;gap:2px">${withTag.map(f=>`
        <label class="m sm" style="display:flex;gap:8px;align-items:center;min-height:36px">
          <input type="checkbox" data-f="${f.id}" checked style="width:18px;height:18px;accent-color:var(--accent)">
          <b class="mono">${esc(f.code)}</b> <span>${esc(f.name)}</span>
          <span class="chip ok">${activeTag(f.id).public}</span></label>`).join('')}</div>
      <div class="seg" role="group" aria-label="Formato">
        <button type="button" data-fm="a4" aria-pressed="${st.fmt==='a4'}">Hoja A4, 3 por fila</button>
        <button type="button" data-fm="roll" aria-pressed="${st.fmt==='roll'}">Rollo 50×30 mm</button></div>
      <button class="btn pri block" id="pr" type="button">Imprimir</button>
      <p class="muted sm" style="margin:0">Imprime al 100 % de escala, sin ajustar al papel. Después prueba la lectura a 20 y a 40 cm, y con poca luz.</p></div>
    <div class="printzone" id="pz"><div class="prev"><div class="spin"></div></div></div>`
    :`<div class="banner warn"><b>Todavía no hay tags activos.</b> Entra a un file y crea su tag para poder imprimir la etiqueta.</div>
      <a class="btn block" href="#/estructura">Ir a las fichas madre</a>`});
  if(!withTag.length)return;
  const paint=async()=>{
    const items=withTag.filter(f=>st.sel.has(f.id));
    let cells='';
    try{
      for(const f of items){
        const t=activeTag(f.id);
        cells+=`<div class="etq"><div class="q">${await qrSVG(tagUrl(t.public))}</div>
          <div class="tx"><b>${esc(f.code)}</b><span class="nm">${esc(f.name)}</span><code>${t.public}</code></div></div>`;
      }
    }catch(e){cells='<p class="muted sm">No se pudo cargar el generador de QR. Revisa la conexión.</p>'}
    const pz=$('#pz');
    if(pz)pz.innerHTML=`<div class="prev"><div class="sheet ${st.fmt}">${cells||'<p class="muted sm">Selecciona al menos un file.</p>'}</div></div>`;
  };
  $$('input[data-f]').forEach(i=>i.addEventListener('change',()=>{
    i.checked?st.sel.add(i.dataset.f):st.sel.delete(i.dataset.f);paint();
  }));
  $$('button[data-fm]').forEach(b=>b.addEventListener('click',()=>{
    st.fmt=b.dataset.fm;setMeta('lblFmt',st.fmt);
    $$('button[data-fm]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));paint();
  }));
  $('#pr').addEventListener('click',async()=>{
    await ev('LABELS_PRINTED',{note:`${st.sel.size} etiquetas · ${st.fmt==='a4'?'A4':'rollo'}`,kind:'ok'});
    window.print();
  });
  paint();
}
