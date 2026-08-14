/* =========================================================
   KNOWLEDGE WORLD ONLINE
   app.js — shared Supabase-backed data & utility layer
   -----------------------------------------------------------
   This file talks to a real Supabase project (Postgres +
   Auth-less RPC login + Storage for files), so data is now
   shared across every device/browser instead of living only
   in one browser's localStorage/IndexedDB.

   The public KWO.* API keeps the SAME function names as the
   original front-end-only version, so no other file (HTML/CSS,
   or the calling code's structure) had to change shape — only
   the page scripts now `await` the functions that hit the
   network (see auth.js / home.js / dashboard.js / admin.js).

   Supabase project used:
     URL: https://gzxemrjflbxrexenkofh.supabase.co
     Key: publishable ("anon") key — safe to ship in client JS.
   See /supabase/schema.sql and SETUP_SUPABASE.md for the
   one-time database setup this file depends on.
   ========================================================= */

// Load the Supabase JS SDK via document.write so NO HTML file
// needs to be touched — this executes synchronously before the
// next <script> tag (home.js/auth.js/...) runs, so window.supabase
// is guaranteed to exist by the time DOMContentLoaded fires.
document.write('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"><\/script>');

const KWO = (() => {

  const SUPABASE_URL = "https://gzxemrjflbxrexenkofh.supabase.co";
  const SUPABASE_KEY = "sb_publishable_zr6o4CYwaEtH6Hy6FfNvaA_6xm-T8S-";
  const BUCKET = "kwo-files";

  const LS_SESSION = "kwo_session";       // now stores the full customer object
  const LS_ADMIN   = "kwo_admin_session"; // simple client-side admin flag
  const LS_SITE_CONFIG = "kwo_site_config_v2";
  const DEFAULT_SITE_CONFIG = {
    serviceOverrides:{}, removedServices:[], addedServices:[],
    tools:[{id:"pdf-tools",title:"PDF Tools",description:"Open Knowledge World PDF Tools for PDF editing, conversion and other document utilities.",url:"https://knowldgepdftools.netlify.app/",initials:"PDF",color:"teal",enabled:true}],
    links:{all_services:{label:"All services",href:"index.html#services"},print:{label:"Print & Xerox",href:"index.html#print"},about:{label:"About centre",href:"index.html#about"},contact:{label:"Contact",href:"index.html#contact"},register:{label:"Create account",href:"register.html"},login:{label:"Customer login",href:"login.html"},dashboard:{label:"My dashboard",href:"dashboard.html"},admin:{label:"Admin login",href:"admin-login.html"}}
  };
  function normalizeSiteConfig(x){return {serviceOverrides:x?.serviceOverrides||{},removedServices:Array.isArray(x?.removedServices)?x.removedServices:[],addedServices:Array.isArray(x?.addedServices)?x.addedServices:[],tools:Array.isArray(x?.tools)?x.tools:DEFAULT_SITE_CONFIG.tools,links:{...DEFAULT_SITE_CONFIG.links,...(x?.links||{})}};}
  function getSiteConfig(){return normalizeSiteConfig(read(LS_SITE_CONFIG,{}));}
  function saveSiteConfig(c){const cfg=normalizeSiteConfig(c);write(LS_SITE_CONFIG,cfg);return cfg;}
  function resetSiteConfig(){localStorage.removeItem(LS_SITE_CONFIG);return getSiteConfig();}
  async function syncSiteConfig(){
    try{
      const {data,error}=await sb().from("site_config").select("config,updated_at").eq("id","main").maybeSingle();
      if(error) throw error;
      if(data?.config){const cfg=normalizeSiteConfig(data.config);write(LS_SITE_CONFIG,cfg);return cfg;}
    }catch(e){console.warn("Shared site config unavailable; using local config.",e.message||e);}
    return getSiteConfig();
  }
  async function publishSiteConfig(c){
    const cfg=normalizeSiteConfig(c);
    write(LS_SITE_CONFIG,cfg);
    try{
      const {error}=await sb().from("site_config").upsert({id:"main",config:cfg,updated_at:new Date().toISOString()},{onConflict:"id"});
      if(error) throw error;
      return {ok:true,config:cfg};
    }catch(e){
      console.error("Shared site config save failed",e);
      return {ok:false,config:cfg,error:e.message||String(e)};
    }
  }

  let _sb = null;
  function sb(){
    if (!_sb){
      if (!window.supabase){
        throw new Error("Supabase SDK not loaded yet.");
      }
      _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return _sb;
  }

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

  /* ---------- Supabase Storage file helpers ---------- */
  async function uploadFile(file){
    const path = `${uid("file")}/${file.name}`;
    const { error } = await sb().storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream"
    });
    if (error) throw error;
    return path;
  }

  async function getFile(path){
    const { data, error } = await sb().storage.from(BUCKET).download(path);
    if (error){ console.error(error); return null; }
    return data; // Blob
  }

  async function deleteFile(path){
    const { error } = await sb().storage.from(BUCKET).remove([path]);
    if (error) console.error(error);
    return !error;
  }

  /* ---------- customers ---------- */
  async function getUsers(){
    const { data, error } = await sb().rpc("list_customers");
    if (error){ console.error(error); return []; }
    return (data || []).map(u => ({
      id: u.id, name: u.name, mobile: u.mobile, email: u.email, createdAt: u.created_at
    }));
  }

  async function registerUser({name, mobile, email, password}){
    const { data, error } = await sb().rpc("register_customer", {
      p_name: name.trim(), p_mobile: mobile.trim(),
      p_email: (email||"").trim(), p_password: password
    });
    if (error){ console.error(error); return { ok:false, error:"Something went wrong. Please try again." }; }
    return data;
  }

  async function loginUser({mobile, password}){
    const { data, error } = await sb().rpc("login_customer", {
      p_mobile: mobile.trim(), p_password: password
    });
    if (error){ console.error(error); return { ok:false, error:"Something went wrong. Please try again." }; }
    if (data.ok) write(LS_SESSION, data.user);
    return data;
  }

  function currentUser(){
    return read(LS_SESSION, null);
  }

  function logoutUser(){ localStorage.removeItem(LS_SESSION); }

  /* ---------- admin ---------- */
  async function loginAdmin({username, password}){
    const { data, error } = await sb().rpc("login_admin", {
      p_username: username.trim(), p_password: password
    });
    if (error){ console.error(error); return { ok:false, error:"Something went wrong. Please try again." }; }
    if (data.ok) write(LS_ADMIN, true);
    return data;
  }
  function isAdmin(){ return read(LS_ADMIN, false) === true; }
  function logoutAdmin(){ localStorage.removeItem(LS_ADMIN); }

  /* ---------- requests (services + print/xerox) ---------- */
  function mapRequestRow(r){
    return {
      id: r.id,
      token: r.token,
      userId: r.user_id,
      name: r.name,
      mobile: r.mobile,
      service: r.service,
      copies: r.copies,
      printType: r.print_type,
      notes: r.notes,
      files: (r.request_files || []).map(f => ({
        key: f.storage_path, name: f.file_name, size: f.file_size, type: f.file_type
      })),
      status: r.status,
      createdAt: r.created_at
    };
  }

  async function getRequests(){
    const { data, error } = await sb()
      .from("requests")
      .select("*, request_files(*)")
      .order("created_at", { ascending:false });
    if (error){ console.error(error); return []; }
    return (data || []).map(mapRequestRow);
  }

  async function requestsForUser(userId){
    const { data, error } = await sb()
      .from("requests")
      .select("*, request_files(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending:false });
    if (error){ console.error(error); return []; }
    return (data || []).map(mapRequestRow);
  }

  async function createRequest(data, files){
    const { data: reqRow, error } = await sb()
      .from("requests")
      .insert({
        user_id: data.userId || null,
        name: data.name.trim(),
        mobile: data.mobile.trim(),
        service: data.service || "Print & Xerox",
        copies: data.copies ? Number(data.copies) : null,
        print_type: data.printType || null,
        notes: (data.notes || "").trim()
      })
      .select()
      .single();
    if (error) throw error;

    const fileMetas = [];
    if (files && files.length){
      for (const f of files){
        const path = await uploadFile(f);
        const { error: ferr } = await sb().from("request_files").insert({
          request_id: reqRow.id,
          storage_path: path,
          file_name: f.name,
          file_size: f.size,
          file_type: f.type
        });
        if (!ferr) fileMetas.push({ key: path, name: f.name, size: f.size, type: f.type });
      }
    }

    return {
      id: reqRow.id,
      token: reqRow.token,
      userId: reqRow.user_id,
      name: reqRow.name,
      mobile: reqRow.mobile,
      service: reqRow.service,
      copies: reqRow.copies,
      printType: reqRow.print_type,
      notes: reqRow.notes,
      files: fileMetas,
      status: reqRow.status,
      createdAt: reqRow.created_at
    };
  }

  async function updateRequestStatus(id, status){
    const { data, error } = await sb()
      .from("requests")
      .update({ status })
      .eq("id", id)
      .select("*, request_files(*)")
      .single();
    if (error){ console.error(error); return null; }
    return mapRequestRow(data);
  }

  async function deleteRequest(id){
    const { data: files } = await sb().from("request_files").select("storage_path").eq("request_id", id);
    if (files && files.length){
      await sb().storage.from(BUCKET).remove(files.map(f => f.storage_path));
    }
    const { error } = await sb().from("requests").delete().eq("id", id);
    if (error) console.error(error);
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

  /* ---------- mobile nav toggle (drawer + scrim) ---------- */
  function initNavToggle(){
    const btn = document.querySelector(".nav-toggle");
    const links = document.querySelector(".nav-links");
    if (!btn || !links) return;

    let scrim = document.querySelector(".nav-scrim");
    if (!scrim){
      scrim = document.createElement("div");
      scrim.className = "nav-scrim";
      document.body.appendChild(scrim);
    }

    function open(){
      links.classList.add("open");
      btn.classList.add("open");
      scrim.classList.add("show");
      document.body.style.overflow = "hidden";
    }
    function close(){
      links.classList.remove("open");
      btn.classList.remove("open");
      scrim.classList.remove("show");
      document.body.style.overflow = "";
    }
    btn.addEventListener("click", ()=>{
      links.classList.contains("open") ? close() : open();
    });
    scrim.addEventListener("click", close);
    links.querySelectorAll("a").forEach(a=> a.addEventListener("click", close));
    document.addEventListener("keydown", (e)=>{ if (e.key === "Escape") close(); });
    window.addEventListener("resize", ()=>{ if (window.innerWidth > 860) close(); });
  }

  /* ---------- sticky nav shadow on scroll ---------- */
  function initNavScrollShadow(){
    const nav = document.querySelector(".nav");
    if (!nav) return;
    const onScroll = ()=>{
      nav.classList.toggle("scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive:true });
  }

  /* ---------- scroll-to-top button ---------- */
  function initScrollTop(){
    let btn = document.querySelector(".scrollTopBtn");
    if (!btn){
      btn = document.createElement("button");
      btn.className = "scrollTopBtn";
      btn.type = "button";
      btn.setAttribute("aria-label", "Scroll to top");
      btn.innerHTML = "↑";
      document.body.appendChild(btn);
    }
    btn.addEventListener("click", ()=> window.scrollTo({ top:0, behavior:"smooth" }));
    window.addEventListener("scroll", ()=>{
      btn.classList.toggle("show", window.scrollY > 480);
    }, { passive:true });
  }

  document.addEventListener("DOMContentLoaded", () => {
    syncNav();
    initReveal();
    initNavToggle();
    initNavScrollShadow();
    initScrollTop();
  });

  return {
    read, write, uid, tokenNumber, validMobile, validEmail, fmtDate, fmtBytes,
    getFile, deleteFile,
    getUsers, registerUser, loginUser, currentUser, logoutUser,
    loginAdmin, isAdmin, logoutAdmin,
    getRequests, createRequest, updateRequestStatus, deleteRequest, requestsForUser,
    getSiteConfig, saveSiteConfig, resetSiteConfig, syncSiteConfig, publishSiteConfig,
    toast, initials, initReveal, celebrate
  };
})();
