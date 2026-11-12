// Zerly : s'ouvre depuis le cache (sans internet) et se met à jour en arrière-plan
const V="zerly-v9.2.4";
const FILES=["./","./index.html","./manifest.webmanifest","./icon-180.png","./icon-192.png","./icon-512.png","./confidentialite.html","./cookies.html","./conditions.html","./mentions-legales.html","./accessibilite.html"];
// seuls les fichiers de ce site passent par le cache ; le compte (Supabase) va directement sur le réseau
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES).then(()=>c.addAll(["./lib/supabase/supabase.js","./lib/pdfjs/pdf.min.js","./lib/pdfjs/pdf.worker.min.js"]).catch(()=>{}))).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!=="zerly-notif").map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const req=e.request;if(req.method!=="GET")return;const u=new URL(req.url);if(u.origin!==location.origin)return;
  const key=req.mode==="navigate"&&/\/$|index\.html$/.test(u.pathname)?"./index.html":req;
  e.respondWith(caches.open(V).then(async c=>{
    const hit=await c.match(key,{ignoreSearch:true});
    const net=fetch(req).then(r=>{if(r&&(r.ok||r.type==="opaque"))c.put(key,r.clone());return r}).catch(()=>hit);
    return hit||net;
  }));
});
// notifications : envoyées par le serveur (push) ou préparées par l'appli (Android : vérification régulière)
const NOTIF="./__notif.json",OPT={icon:"icon-192.png",badge:"icon-192.png",lang:"fr",data:{url:"./?rappels=1"}};
self.addEventListener("push",e=>{let m={};try{m=e.data.json()}catch(_){m={title:"Zerly",body:e.data?e.data.text():""}}
  e.waitUntil(self.registration.showNotification(m.title||"Zerly",Object.assign({body:m.body||"",tag:m.tag||"fin"},OPT)))});
self.addEventListener("periodicsync",e=>{if(e.tag!=="zerly-rappels")return;e.waitUntil((async()=>{
  const c=await caches.open("zerly-notif"),r=await c.match(NOTIF);if(!r)return;const st=await r.json();st.sent=st.sent||{};
  const d=new Date(),t=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const hr=d.getHours(),due=(st.queue||[]).filter(n=>n.date===t&&hr>=(n.hour==null?9:n.hour)&&!st.sent[n.tag+"|"+t]);if(!due.length)return;
  if(due.length>3)await self.registration.showNotification("Zerly : "+due.length+" rappels",Object.assign({body:due.slice(0,3).map(n=>n.title).join(" · ")+"…",tag:"fin-sum"},OPT));
  else for(const n of due)await self.registration.showNotification(n.title,Object.assign({body:n.body,tag:n.tag},OPT));
  for(const n of due)st.sent[n.tag+"|"+t]=t;await c.put(NOTIF,new Response(JSON.stringify(st),{headers:{"Content-Type":"application/json"}}));
})())});
self.addEventListener("notificationclick",e=>{e.notification.close();const url=(e.notification.data&&e.notification.data.url)||"./";
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(L=>{for(const w of L){if("focus" in w){w.postMessage({open:"rappels"});return w.focus()}}return self.clients.openWindow(url)}))});
