/* Loads every service config before homepage/admin editors start. */
window.KWO_SERVICES = window.KWO_SERVICES || [];
window.KWO_SERVICE_FORMS = window.KWO_SERVICE_FORMS || {};
window.KWO_SERVICE_MANIFEST = window.KWO_SERVICE_MANIFEST || [];
window.kwoServicesReady = (async()=>{
  await Promise.all(window.KWO_SERVICE_MANIFEST.map(item=>new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src=item.config;
    s.onload=resolve;
    s.onerror=()=>reject(new Error("Could not load service config: "+item.config));
    document.head.appendChild(s);
  })));
  return window.KWO_SERVICES;
})();
