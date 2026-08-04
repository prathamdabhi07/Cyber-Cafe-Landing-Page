/* =========================================================
   KNOWLEDGE WORLD ONLINE
   app.js — shared storage, auth & utility layer
   -----------------------------------------------------------
   Data model (demo / front-end only, no server):
     localStorage "kwo_users"    -> array of customer accounts
     localStorage "kwo_requests" -> array of print/xerox + service requests
     localStorage "kwo_session"  -> { userId }            (customer login)
     localStorage "kwo_admin"    -> true/false             (admin login)
     IndexedDB   "kwo_files"     -> uploaded file blobs, keyed by fileKey

   NOTE: Because this runs entirely in the browser with no backend,
   data lives only on this device/browser. For a real multi-counter
   deployment, swap KWO.db.* calls for real API calls to a server.
   ========================================================= */

const KWO = (() => {

  const LS_USERS    = "kwo_users";
  const LS_REQUESTS = "kwo_requests";
  const LS_SESSION  = "kwo_session";
  const LS_ADMIN    = "kwo_admin_session";
  const ADMIN_USER  = "admin";
  const ADMIN_PASS  = "Knowledge@2006";

  /* ---------- tiny helpers ---------- */
  const read  = (key, fallback) => {
    try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }
    catch(e){ return fallback; }
  };
  const write = (key, val) => localStorage.setItem(key, JSON.stringify(val));

  function uid(prefix){
    return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  }

  function tokenNumber(seq){
    const y = new Date().getFullYear();
    return `KWO-${y}-${String(seq).padStart(4,"0")}`;
  }

  // very small non-cryptographic hash — fine for a local demo, NOT for production auth
  function hash(str){
    let h = 0;
    for (let i=0;i<str.length;i++){ h = (Math.imul(31,h) + str.charCodeAt(i)) | 0; }
    return String(h);
  }

  function validMobile(m){ return /^[6-9]\d{9}$/.test(m.trim()); }
  function validEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()); }

  function fmtDate(iso){
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) +
           " · " + d.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });
  }

  function fmtBytes(n){
    if (n < 1024) return n + " B";
    if (n < 1024*1024) return (n/1024).toFixed(1) + " KB";
    return (n/(1024*1024)).toFixed(2) + " MB";
  }

  /* ---------- IndexedDB file store ---------- */
  const DB_NAME = "kwo_files_db", STORE = "files";
  function openDB(){
    return new Promise((resolve,reject)=>{
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function saveFile(key, blob){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
  async function getFile(key){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(STORE,"readonly");
      const r = tx.objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  }
  async function deleteFile(key){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ---------- users ---------- */
  function getUsers(){ return read(LS_USERS, []); }
  function saveUsers(u){ write(LS_USERS, u); }

  function registerUser({name, mobile, email, password}){
    const users = getUsers();
    if (users.some(u => u.mobile === mobile)){
      return { ok:false, error:"An account with this mobile number already exists." };
    }
    if (email && users.some(u => u.email && u.email.toLowerCase() === email.toLowerCase())){
      return { ok:false, error:"An account with this email already exists." };
    }
    const user = {
      id: uid("usr"),
      name: name.trim(),
      mobile: mobile.trim(),
      email: (email||"").trim(),
      passHash: hash(password),
      createdAt: new Date().toISOString()
    };
    users.push(user);
    saveUsers(users);
    return { ok:true, user };
  }

  function loginUser({mobile, password}){
    const users = getUsers();
    const user = users.find(u => u.mobile === mobile.trim());
    if (!user) return { ok:false, error:"No account found with this mobile number." };
    if (user.passHash !== hash(password)) return { ok:false, error:"Incorrect password. Please try again." };
    write(LS_SESSION, { userId: user.id });
    return { ok:true, user };
  }

  function currentUser(){
    const s = read(LS_SESSION, null);
    if (!s) return null;
    return getUsers().find(u => u.id === s.userId) || null;
  }

  function logoutUser(){ localStorage.removeItem(LS_SESSION); }

  /* ---------- admin ---------- */
  function loginAdmin({username, password}){
    if (username.trim() === ADMIN_USER && password === ADMIN_PASS){
      write(LS_ADMIN, true);
      return { ok:true };
    }
    return { ok:false, error:"Invalid admin username or password." };
  }
  function isAdmin(){ return read(LS_ADMIN, false) === true; }
  function logoutAdmin(){ localStorage.removeItem(LS_ADMIN); }

  /* ---------- requests (services + print/xerox) ---------- */
  function getRequests(){ return read(LS_REQUESTS, []); }
  function saveRequests(r){ write(LS_REQUESTS, r); }

  function nextSeq(){
    const all = getRequests();
    return all.length + 1;
  }

  async function createRequest(data, files){
    const requests = getRequests();
    const seq = nextSeq();
    const token = tokenNumber(seq);
    const fileMetas = [];

    if (files && files.length){
      for (const f of files){
        const key = uid("file");
        await saveFile(key, f);
        fileMetas.push({ key, name: f.name, size: f.size, type: f.type });
      }
    }

    const record = {
      id: uid("req"),
      token,
      userId: data.userId || null,
      name: data.name.trim(),
      mobile: data.mobile.trim(),
      service: data.service || "Print & Xerox",
      copies: data.copies || null,
      printType: data.printType || null,
      notes: (data.notes||"").trim(),
      files: fileMetas,
      status: "Pending",
      createdAt: new Date().toISOString()
    };
    requests.unshift(record);
    saveRequests(requests);
    return record;
  }

  function updateRequestStatus(id, status){
    const requests = getRequests();
    const r = requests.find(x => x.id === id);
    if (r){ r.status = status; saveRequests(requests); }
    return r;
  }

  function deleteRequest(id){
    const requests = getRequests();
    const idx = requests.findIndex(x => x.id === id);
    if (idx > -1){
      const [removed] = requests.splice(idx,1);
      saveRequests(requests);
      (removed.files||[]).forEach(f => deleteFile(f.key).catch(()=>{}));
    }
  }

  function requestsForUser(userId){
    return getRequests().filter(r => r.userId === userId);
  }

  /* ---------- toast ---------- */
  function toast(msg, type="ok"){
    let el = document.querySelector(".toast");
    if (!el){
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = `toast show ${type}`;
    clearTimeout(el._t);
    el._t = setTimeout(()=> el.classList.remove("show"), 3400);
  }

  /* ---------- success celebration (checkmark + confetti) ---------- */
  const CONFETTI_COLORS = ["#EE8A2B","#0E7C6B","#14213D","#C79A3E","#D06A0F","#0A5C4F"];

  function ensureCelebrateOverlay(){
    let el = document.getElementById("kwoCelebrateOverlay");
    if (el) return el;
    el = document.createElement("div");
    el.className = "kwo-celebrate-overlay";
    el.id = "kwoCelebrateOverlay";
    el.innerHTML = `
      <div class="kwo-confetti-field" id="kwoConfettiField"></div>
      <div class="kwo-celebrate-card">
        <div class="kwo-check-wrap">
          <svg viewBox="0 0 80 80" class="kwo-check-svg">
            <circle cx="40" cy="40" r="38" class="kwo-check-ring"/>
            <circle cx="40" cy="40" r="36" class="kwo-check-circle"/>
            <path d="M24 41 L35 52 L57 28" class="kwo-check-path"/>
          </svg>
        </div>
        <span class="kwo-celebrate-eyebrow">Request submitted</span>
        <h3 class="kwo-celebrate-service" id="kwoCelebrateService">Service</h3>
        <div class="kwo-celebrate-token" id="kwoCelebrateToken">KWO-2026-0000</div>
        <p class="kwo-celebrate-sub">Save this token — show it at the counter or track it anytime from your dashboard.</p>
        <div class="kwo-celebrate-actions">
          <a href="dashboard.html" class="btn btn-navy btn-sm">Go to my dashboard</a>
          <button type="button" class="btn btn-ghost btn-sm" id="kwoCelebrateClose">Done</button>
        </div>
      </div>`;
    document.body.appendChild(el);

    const close = () => el.classList.remove("show");
    el.querySelector("#kwoCelebrateClose").addEventListener("click", close);
    el.addEventListener("click", (e)=>{ if (e.target === el) close(); });
    document.addEventListener("keydown", (e)=>{ if (e.key === "Escape") close(); });
    return el;
  }

  function spawnConfetti(field, count=46){
    field.innerHTML = "";
    for (let i=0;i<count;i++){
      const p = document.createElement("span");
      p.className = "kwo-confetti-piece";
      const size = 6 + Math.random()*7;
      const isCircle = Math.random() > 0.55;
      p.style.left = (Math.random()*100) + "%";
      p.style.width = size + "px";
      p.style.height = (isCircle ? size : size*0.4) + "px";
      p.style.background = CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)];
      p.style.borderRadius = isCircle ? "50%" : "2px";
      p.style.animationDuration = (2 + Math.random()*1.6) + "s";
      p.style.animationDelay = (Math.random()*0.5) + "s";
      p.style.transform = `rotate(${Math.random()*360}deg)`;
      field.appendChild(p);
    }
  }

  function celebrate({ service = "Your request", token = "" } = {}){
    const el = ensureCelebrateOverlay();
    document.getElementById("kwoCelebrateService").textContent = service;
    document.getElementById("kwoCelebrateToken").textContent = token;
    spawnConfetti(document.getElementById("kwoConfettiField"));
    // restart CSS animations on the card by forcing reflow
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  }

  /* ---------- nav auth-state sync (runs on every page) ---------- */
  function syncNav(){
    const chipSlot = document.querySelector("[data-nav-auth-slot]");
    if (!chipSlot) return;
    const user = currentUser();
    if (user){
      chipSlot.innerHTML = `
        <a href="dashboard.html" class="nav-user-chip">
          <span class="avatar">${initials(user.name)}</span> ${user.name.split(" ")[0]}
        </a>`;
    }
  }
  function initials(name){
    return name.trim().split(/\s+/).slice(0,2).map(w=>w[0].toUpperCase()).join("");
  }

  /* ---------- scroll reveal ---------- */
  function initReveal(){
    const items = document.querySelectorAll(".reveal, .service-card");
    if (!items.length) return;
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if (e.isIntersecting){
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    items.forEach(i=> io.observe(i));
  }

  /* ---------- mobile nav toggle ---------- */
  function initNavToggle(){
    const btn = document.querySelector(".nav-toggle");
    const links = document.querySelector(".nav-links");
    if (!btn || !links) return;
    btn.addEventListener("click", ()=>{
      const open = links.style.display === "flex";
      links.style.display = open ? "none" : "flex";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    syncNav();
    initReveal();
    initNavToggle();
  });

  return {
    read, write, uid, tokenNumber, hash, validMobile, validEmail, fmtDate, fmtBytes,
    saveFile, getFile, deleteFile,
    getUsers, registerUser, loginUser, currentUser, logoutUser,
    loginAdmin, isAdmin, logoutAdmin,
    getRequests, createRequest, updateRequestStatus, deleteRequest, requestsForUser,
    toast, initials, initReveal, celebrate
  };
})();
