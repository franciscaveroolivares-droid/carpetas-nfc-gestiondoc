/* app.js — arranque y enrutador. */
import {S,$,loadAll,restoreSession,SESSION,me,famById,fileById,docById,typeById} from './core.js';
import {render,renderAuth,runCleanup,layoutMode,toast,Nav} from './ui.js';
import {vBootstrap,vLogin,vPerfil,vSalir,Pending} from './views-auth.js';
import {vHome,vDash,vEstructura,vFamilia,vNuevoFile,vFile,vDoc,vBuscar,vBandeja} from './views-browse.js';
import {vEscanear,vResolver,vTag,vCaptura,vEtiquetas} from './views-capture.js';
import {vAdmin,vUsuarios,vAdminEstructura,vAdminTags,vEmpresa,vDatos,vEventos,vDiag,vPruebas,vMas} from './views-admin.js';

const notFound=(what,back)=>render({title:'No encontrado',nav:'estructura',back:back||'#/',
  body:`<div class="banner warn"><b>${what} no existe.</b> Puede que se haya borrado, o que el enlace venga de otro equipo: los documentos viven en el navegador donde se capturaron.</div>
    <a class="btn block" href="#/estructura">Ir a las fichas madre</a>`});

async function route(){
  runCleanup();
  const raw=location.hash.replace(/^#/,'')||'/';
  const [path,qs]=raw.split('?');
  const params=new URLSearchParams(qs||'');
  const p=path.split('/').filter(Boolean);

  if(!S.company)return vBootstrap();

  if(!SESSION){
    if(p[0]==='t'&&p[1]){Pending.hash='#/t/'+p[1].toUpperCase();Pending.at=Date.now();Pending.viaLogin=true}
    else if(path!=='/'&&p[0]!=='salir'){Pending.hash='#'+raw;Pending.at=Date.now();Pending.viaLogin=false}
    return vLogin();
  }

  switch(p[0]){
    case undefined: return layoutMode()==='escritorio'?vDash():vHome();
    case 'dash': return vDash();
    case 'estructura': return vEstructura();
    case 'fam': {
      const fam=famById(p[1]);
      if(!fam)return notFound('Esa familia','#/estructura');
      return p[2]==='nuevo'?vNuevoFile(fam):vFamilia(fam);
    }
    case 'f': {
      const f=fileById(p[1]);
      if(!f)return notFound('Ese file','#/estructura');
      if(p[2]==='tag')return vTag(f);
      if(p[2]==='escanear')return vCaptura(f);
      return vFile(f);
    }
    case 'd': {
      const d=docById(p[1]);
      return d?vDoc(d):notFound('Ese documento','#/buscar');
    }
    case 't': {
      const via=Pending.viaLogin;Pending.viaLogin=false;
      return vResolver((p[1]||'').toUpperCase(),via);
    }
    case 'escanear': return vEscanear();
    case 'buscar': return vBuscar(params);
    case 'bandeja': return vBandeja();
    case 'etiquetas': return vEtiquetas();
    case 'admin':
      if(p[1]==='usuarios')return vUsuarios();
      if(p[1]==='estructura')return vAdminEstructura();
      if(p[1]==='tags')return vAdminTags();
      if(p[1]==='empresa')return vEmpresa();
      if(p[1]==='datos')return vDatos();
      return vAdmin();
    case 'eventos': return vEventos();
    case 'diag': return vDiag();
    case 'pruebas': return vPruebas();
    case 'mas': return vMas();
    case 'perfil': return vPerfil();
    case 'salir': return vSalir();
    default: return layoutMode()==='escritorio'?vDash():vHome();
  }
}

window.addEventListener('hashchange',()=>{route().catch(err)});
let lastLayout=null,rt=null;
window.addEventListener('resize',()=>{
  clearTimeout(rt);
  rt=setTimeout(()=>{
    const l=layoutMode();
    if(l!==lastLayout){lastLayout=l;route().catch(err)}
  },250);
});
function err(e){
  console.error(e);
  const app=$('#app');
  if(app)app.innerHTML=`<main style="padding:24px"><div class="banner bad" style="max-width:600px;margin-inline:auto">
    <b>Algo falló al mostrar esta pantalla.</b><span class="mono">${String(e&&e.message||e)}</span>
    <a class="btn" href="#/">Volver al inicio</a></div></main>`;
}

(async()=>{
  try{
    await loadAll();
    restoreSession();
    lastLayout=layoutMode();
    await route();
  }catch(e){err(e)}
})();
