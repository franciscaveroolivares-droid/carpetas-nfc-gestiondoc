/* lib.js — QR, PDF, cámara, NFC y OCR. */
import {rid} from './core.js';

/* ---------- carga diferida de librerías, con respaldo de CDN ---------- */
function loadScript(urls,test){
  return new Promise((res,rej)=>{
    let i=0;
    const next=()=>{
      if(test())return res();
      if(i>=urls.length)return rej(new Error('No se pudo cargar la librería'));
      const s=document.createElement('script');s.src=urls[i++];
      s.onload=()=>test()?res():next();s.onerror=next;document.head.appendChild(s);
    };
    next();
  });
}
const CACHE={};
const lib=(k,urls,test)=>CACHE[k]||(CACHE[k]=loadScript(urls,test).catch(e=>{delete CACHE[k];throw e}));
export const needQR=()=>lib('qr',['https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'],()=>typeof window.qrcode==='function');
export const needJsQR=()=>lib('jsqr',['https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js'],()=>typeof window.jsQR==='function');
export const needOCR=()=>lib('ocr',['https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js'],()=>typeof window.Tesseract==='object');

/* ---------- QR ---------- */
export async function qrSVG(text){
  await needQR();
  const q=window.qrcode(0,'M');q.addData(text);q.make();
  const n=q.getModuleCount(),m=2;let d='';
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(q.isDark(r,c))d+=`M${c+m} ${r+m}h1v1h-1z`;
  const sz=n+m*2;
  return `<svg viewBox="0 0 ${sz} ${sz}" shape-rendering="crispEdges" role="img" aria-label="Código QR"><rect width="${sz}" height="${sz}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/* ---------- URL del tag ---------- */
export const parseTag=s=>{
  const m=String(s==null?'':s).match(/(?:#\/t\/|[#?&]t=|\/t\/)([A-Za-z0-9]{6,12})\b/);
  if(m)return m[1].toUpperCase();
  const t=String(s==null?'':s).trim();
  return /^[A-Za-z0-9]{6,12}$/.test(t)?t.toUpperCase():null;
};

/* ---------- PDF multipágina a partir de JPEG, sin librerías ---------- */
export function buildPDF(pages){
  const enc=s=>new TextEncoder().encode(s);
  const chunks=[];let len=0;const offs=[];
  const add=b=>{const u=typeof b==='string'?enc(b):b;chunks.push(u);len+=u.length};
  add('%PDF-1.4\n');add(new Uint8Array([0x25,0xE2,0xE3,0xCF,0xD3,0x0A]));
  const n=pages.length;
  offs[1]=len;add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  offs[2]=len;add(`2 0 obj\n<< /Type /Pages /Kids [${pages.map((p,i)=>`${5+3*i} 0 R`).join(' ')}] /Count ${n} >>\nendobj\n`);
  pages.forEach((p,i)=>{
    const img=3+3*i,con=4+3*i,pg=5+3*i,W=595.28,H=+(W*p.h/p.w).toFixed(2);
    offs[img]=len;
    add(`${img} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`);
    add(p.bytes);add('\nendstream\nendobj\n');
    const cs=`q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    offs[con]=len;add(`${con} 0 obj\n<< /Length ${cs.length} >>\nstream\n${cs}\nendstream\nendobj\n`);
    offs[pg]=len;add(`${pg} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${con} 0 R /Resources << /XObject << /Im0 ${img} 0 R >> >> >>\nendobj\n`);
  });
  const total=3+3*n,xr=len;
  let x=`xref\n0 ${total}\n0000000000 65535 f \n`;
  for(let i=1;i<total;i++)x+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
  add(x+`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF\n`);
  const out=new Uint8Array(len);let o=0;
  for(const c of chunks){out.set(c,o);o+=c.length}
  return out;
}

/* ---------- cámara ---------- */
export async function startCam(video){
  const stream=await navigator.mediaDevices.getUserMedia({
    video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
  video.srcObject=stream;video.setAttribute('playsinline','');video.muted=true;
  await video.play();
  return stream;
}
export const stopCam=st=>{if(st)st.getTracks().forEach(t=>t.stop())};
export async function frameToPage(src,w0,h0,enhance){
  const max=1800,k=Math.min(1,max/Math.max(w0,h0));
  const w=Math.round(w0*k),h=Math.round(h0*k);
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const x=c.getContext('2d');
  if(enhance&&'filter' in x)x.filter='contrast(1.25) brightness(1.05) saturate(.9)';
  x.drawImage(src,0,0,w,h);
  const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.85));
  return {blob,w,h,url:URL.createObjectURL(blob)};
}

/* ---------- NFC ---------- */
export const hasNFC=typeof window!=='undefined'&&'NDEFReader' in window;
export async function nfcScan(onRead,onError){
  const ctl=new AbortController(),r=new window.NDEFReader();
  await r.scan({signal:ctl.signal});
  r.onreading=e=>{
    let txt='';
    for(const rec of e.message.records){
      if(['url','absolute-url','text'].includes(rec.recordType)){
        try{txt=new TextDecoder(rec.encoding||'utf-8').decode(rec.data)}catch(x){}
        break;
      }
    }
    onRead(txt,e.serialNumber||'');
  };
  r.onreadingerror=()=>onError('El tag se detectó pero no se pudo leer. Acércalo de nuevo.');
  return ctl;
}
export async function nfcWrite(url){
  const ctl=new AbortController(),r=new window.NDEFReader();
  await r.write({records:[{recordType:'url',data:url}]},{signal:ctl.signal});
  return ctl;
}

/* ---------- OCR ---------- */
export async function ocrBlobs(blobs,onProg){
  await needOCR();
  onProg&&onProg('Cargando el motor de OCR…');
  const w=await window.Tesseract.createWorker('spa');
  let text='';
  try{
    for(let i=0;i<blobs.length;i++){
      onProg&&onProg(`Página ${i+1} de ${blobs.length}…`);
      const r=await w.recognize(blobs[i]);
      text+=r.data.text+'\n';
    }
  }finally{try{await w.terminate()}catch(e){}}
  return text;
}

/* ---------- varios ---------- */
export const idemKey=()=>'idem-'+rid(10).toLowerCase();
export function download(blob,name){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
