// Single registration wrapper: never register app-shell workers in dev or preview.
const listeners=new Set<()=>void>();
let registration:ServiceWorkerRegistration|null=null;
export function waitingWorker(){return registration?.waiting??null;}
export function onWaitingWorker(cb:()=>void){listeners.add(cb);return()=>{listeners.delete(cb);};}
export function activateWaitingWorker(){waitingWorker()?.postMessage({type:'SKIP_WAITING'});}
export function registerServiceWorker(){
 if(typeof window==='undefined'||!('serviceWorker' in navigator))return;
 const h=location.hostname;
 const refuse=!import.meta.env.PROD||window.self!==window.top||h.startsWith('id-preview--')||h.startsWith('preview--')||h==='lovableproject.com'||h.endsWith('.lovableproject.com')||h==='lovableproject-dev.com'||h.endsWith('.lovableproject-dev.com')||h==='beta.lovable.dev'||h.endsWith('.beta.lovable.dev')||new URLSearchParams(location.search).get('sw')==='off';
 if(refuse){void navigator.serviceWorker.getRegistrations().then(regs=>Promise.all(regs.filter(r=>[r.active,r.waiting,r.installing].some(w=>w&&new URL(w.scriptURL).pathname==='/sw.js')).map(r=>r.unregister()))).catch(()=>{});return;}
 void navigator.serviceWorker.register('/sw.js',{scope:'/'}).then(r=>{
 registration=r;listeners.forEach(f=>f());
 r.addEventListener('updatefound',()=>{const worker=r.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')listeners.forEach(f=>f());});});
 let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloading){reloading=true;location.reload();}});
 // Check again on a foreground return, without reloading or interrupting a session.
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void r.update().catch(()=>{});});
 }).catch(()=>{});
}
