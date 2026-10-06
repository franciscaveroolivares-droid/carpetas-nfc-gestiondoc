/* views-auth.js — primer arranque, login, perfil y salida. */
import {S,$,esc,ROLES,login,logout,createUser,setPassword,bootstrapCompany,seedDemo,me,put,ev,
        fmtDate,MAX_FAILS} from './core.js';
import {renderAuth,render,toast,go,confirmBtn} from './ui.js';

/** Destino pendiente cuando alguien escanea un tag sin sesión. */
export const Pending={hash:null,at:0,src:null};

export function vBootstrap(){
  renderAuth(`<div class="brand"><b>Carpetas NFC</b><span>Gestión documental física-digital</span></div>
    <form class="card" id="bf">
      <h2>Primer arranque</h2>
      <p class="muted sm" style="margin:0">Crea la empresa y la cuenta de administrador. Desde esa cuenta se dan de alta los demás usuarios con su contraseña.</p>
      <div class="field"><label for="rz">Razón social</label><input id="rz" required placeholder="Distribuidora Andina SAC"></div>
      <div class="field"><label for="ruc">RUC (opcional)</label><input id="ruc" inputmode="numeric" placeholder="20512345678"></div>
      <div class="field"><label for="nm">Tu nombre</label><input id="nm" required placeholder="Francis Cavero"></div>
      <div class="field"><label for="em">Correo</label><input id="em" type="email" required autocomplete="username" placeholder="admin@empresa.pe"></div>
      <div class="field"><label for="pw">Contraseña <span class="chip">mínimo 8 caracteres</span></label><input id="pw" type="password" required minlength="8" autocomplete="new-password"></div>
      <div class="field"><label for="pw2">Repite la contraseña</label><input id="pw2" type="password" required minlength="8" autocomplete="new-password"></div>
      <label class="sm" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="dm" checked> Cargar files y documentos de ejemplo</label>
      <div id="be"></div>
      <button class="btn pri block" type="submit" id="bs">Crear empresa y entrar</button>
    </form>
    <p class="muted sm">Esta maqueta guarda todo en el navegador de este equipo. No hay servidor: la contraseña se guarda como hash PBKDF2 aquí mismo, y el control de roles es de interfaz, no de seguridad real.</p>`);
  $('#bf').addEventListener('submit',async e=>{
    e.preventDefault();
    const pw=$('#pw').value,pw2=$('#pw2').value;
    if(pw!==pw2){$('#be').innerHTML='<div class="banner bad">Las dos contraseñas no coinciden.</div>';return}
    $('#bs').disabled=true;$('#bs').textContent='Creando…';
    try{
      await bootstrapCompany({razon:$('#rz').value,ruc:$('#ruc').value});
      await createUser({name:$('#nm').value,email:$('#em').value,role:'admin',password:pw});
      if($('#dm').checked)await seedDemo();
      const r=await login($('#em').value,pw,true);
      if(!r.ok)throw new Error(r.error);
      toast('Empresa creada');
      go('#/');
    }catch(err){
      $('#be').innerHTML=`<div class="banner bad">No se pudo crear: ${esc(err.message)}</div>`;
      $('#bs').disabled=false;$('#bs').textContent='Crear empresa y entrar';
    }
  });
}

export function vLogin(){
  const p=Pending.hash&&Date.now()-Pending.at<10*60000?Pending:null;
  renderAuth(`<div class="brand"><b>${esc(S.company?S.company.razon:'Carpetas NFC')}</b><span>Gestión documental física-digital</span></div>
    ${p?`<div class="banner info"><b>Escaneaste un tag.</b> Inicia sesión y te llevamos al file que escaneaste. El tag identifica el file; no da acceso por sí solo.</div>`:''}
    <form class="card" id="lf">
      <h2>Inicia sesión</h2>
      <div class="field"><label for="em">Correo</label><input id="em" type="email" required autocomplete="username" autocapitalize="none" value="${esc(S.meta.lastEmail||'')}"></div>
      <div class="field"><label for="pw">Contraseña</label><input id="pw" type="password" required autocomplete="current-password"></div>
      <label class="sm" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="kp" ${S.meta.keep?'checked':''}> Mantener la sesión en este equipo</label>
      <div id="le"></div>
      <button class="btn pri block" type="submit" id="ls">Entrar</button>
    </form>
    <p class="muted sm">Tras ${MAX_FAILS} intentos fallidos la cuenta se bloquea un minuto. Si olvidaste la contraseña, un administrador la restablece desde Administración → Usuarios.</p>`);
  $('#lf').addEventListener('submit',async e=>{
    e.preventDefault();
    const b=$('#ls');b.disabled=true;b.textContent='Comprobando…';
    const keep=$('#kp').checked;
    const r=await login($('#em').value,$('#pw').value,keep);
    if(r.ok){
      S.meta.lastEmail=$('#em').value.trim();S.meta.keep=keep;
      put('meta',{k:'lastEmail',v:S.meta.lastEmail});put('meta',{k:'keep',v:keep});
      const dest=p?p.hash:'#/';
      Pending.hash=null;
      go(dest);
    }else{
      $('#le').innerHTML=`<div class="banner bad">${esc(r.error)}</div>`;
      b.disabled=false;b.textContent='Entrar';$('#pw').value='';$('#pw').focus();
    }
  });
}

export function vPerfil(){
  const u=me();
  render({title:'Mi cuenta',nav:'mas',back:'#/mas',body:`
    <div class="card"><h2>${esc(u.name)}</h2>
      <div class="m sm muted">${esc(u.email)}</div>
      <div class="chips"><span class="chip acc">${esc(ROLES[u.role])}</span>${u.lastLogin?`<span class="chip">última entrada ${esc(fmtDate(u.lastLogin))}</span>`:''}</div></div>
    <form class="card" id="pf"><h2>Cambiar mi contraseña</h2>
      <div class="field"><label for="a">Contraseña actual</label><input id="a" type="password" required autocomplete="current-password"></div>
      <div class="field"><label for="b">Nueva contraseña</label><input id="b" type="password" required minlength="8" autocomplete="new-password"></div>
      <div id="pe"></div><button class="btn pri block" type="submit">Guardar</button></form>
    <button class="btn bad block" id="so" type="button">Cerrar sesión</button>`});
  $('#pf').addEventListener('submit',async e=>{
    e.preventDefault();
    const {hashPw}=await import('./core.js');
    if(await hashPw($('#a').value,u.salt)!==u.hash){$('#pe').innerHTML='<div class="banner bad">La contraseña actual no es correcta.</div>';return}
    await setPassword(u,$('#b').value);toast('Contraseña actualizada');go('#/perfil');
  });
  confirmBtn($('#so'),'Toca de nuevo para salir',()=>go('#/salir'));
}

export async function vSalir(){
  await logout();
  go('#/');
}
