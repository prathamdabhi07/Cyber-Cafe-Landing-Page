/* =========================================================
   home.js — homepage-only behaviour
   ========================================================= */

const SERVICES = [
  { cat:"Identity", name:"Aadhaar Enrolment & Update", desc:"New enrolment, address/mobile update, biometric correction.", color:"navy" },
  { cat:"Identity", name:"PAN Card Apply / Correction", desc:"New PAN application and name, DOB or photo correction.", color:"saffron" },
  { cat:"Identity", name:"Voter ID Registration", desc:"New voter enrolment, correction and address transfer (Form 6/8).", color:"teal" },
  { cat:"Identity", name:"Passport Application Assist", desc:"Online form filling, appointment booking & document checklist.", color:"navy" },
  { cat:"Identity", name:"Driving Licence Apply/Renew", desc:"Learner licence, renewal and duplicate DL applications.", color:"saffron" },
  { cat:"Identity", name:"PAN – Aadhaar Linking", desc:"Link PAN with Aadhaar and check linking status instantly.", color:"teal" },
  { cat:"Certificates", name:"Income Certificate", desc:"Digital income certificate for scholarships & government schemes.", color:"teal" },
  { cat:"Certificates", name:"Caste Certificate", desc:"SC/ST/OBC certificate application through e-Gram / Digital Gujarat.", color:"navy" },
  { cat:"Certificates", name:"Domicile / Residence Certificate", desc:"Proof of residence certificate for admissions & jobs.", color:"saffron" },
  
  
  { cat:"Certificates", name:"Marriage Certificate", desc:"Registration under Gujarat Marriage Registration scheme.", color:"saffron" },
  { cat:"Bills & Payments", name:"Electricity Bill Payment", desc:"UGVCL / PGVCL / MGVCL / DGVCL bill payment, same-day receipt.", color:"navy" },
  
  { cat:"Bills & Payments", name:"Mobile / DTH Recharge", desc:"All operators — prepaid, postpaid & DTH recharge counter.", color:"saffron" },
  
  { cat:"Finance", name:"Bank Account Opening", desc:"Jan Dhan & basic savings account opening assistance.", color:"teal" },

  { cat:"Finance", name:"Income Tax e-Filing (ITR)", desc:"Assisted ITR filing for salaried & small business owners.", color:"teal" },
  { cat:"Business", name:"Udyam / MSME Registration", desc:"Free Udyam registration for small & micro businesses.", color:"navy" },
  { cat:"Business", name:"GST Registration", desc:"New GST registration and application status tracking.", color:"saffron" },
  { cat:"Business", name:"Digital Signature (DSC)", desc:"Class-3 DSC application for e-tender & company filings.", color:"teal" },
  { cat:"Travel", name:"Railway Ticket Booking", desc:"IRCTC reserved & unreserved ticket booking counter.", color:"navy" },
  { cat:"Travel", name:"Bus Ticket Booking (GSRTC)", desc:"State transport ticket booking and reservation.", color:"saffron" },
  { cat:"Office", name:"Print & Xerox / Photocopy", desc:"B/W & colour printing, photocopy, scanning — same day.", color:"teal" },
  { cat:"Office", name:"Lamination & Spiral Binding", desc:"Document lamination, spiral & staple binding.", color:"navy" },
  { cat:"Office", name:"Passport Size Photo / Studio", desc:"Instant passport & document photographs, any background.", color:"saffron" },
  { cat:"Office", name:"Online Form Filling", desc:"Government job & exam form filling (Talati, Police, GPSC, etc).", color:"teal" },
  { cat:"Office", name:"Scholarship Application", desc:"Digital Gujarat / National Scholarship Portal applications.", color:"navy" },
];

function initServiceGrid(){
  const grid = document.getElementById("serviceGrid");
  if (!grid) return;
  const cats = ["All", ...new Set(SERVICES.map(s=>s.cat))];
  const toolbar = document.getElementById("serviceFilters");
  toolbar.innerHTML = cats.map((c,i)=>
    `<button class="chip-filter ${i===0?'active':''}" data-cat="${c}">${c}</button>`
  ).join("");

  function render(cat){
    const list = cat === "All" ? SERVICES : SERVICES.filter(s=>s.cat===cat);
    grid.innerHTML = list.map((s,i)=>{
      const initials = s.name.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();
      const colorVar = s.color === "navy" ? "var(--navy)" : s.color === "saffron" ? "var(--saffron)" : "var(--teal)";
      return `
      <div class="service-card" style="transition-delay:${(i%8)*40}ms" data-service="${escAttr(s.name)}" tabindex="0" role="button" aria-label="Request ${escAttr(s.name)}">
        <div class="service-token" style="background:${colorVar}">${initials}</div>
        <h4>${s.name}</h4>
        <p>${s.desc}</p>
        <div class="s-meta">
          <span class="s-cat">${s.cat}</span>
          <span>Token ready</span>
        </div>
        <div class="s-open">Request this service →</div>
      </div>`;
    }).join("");
    KWO.initReveal ? KWO.initReveal() : null;
    // fallback reveal (in case called before DOMContentLoaded reveal binds)
    requestAnimationFrame(()=>{
      document.querySelectorAll(".service-card").forEach(c=>{
        const io = new IntersectionObserver((entries)=>{
          entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target);} });
        }, { threshold: .1 });
        io.observe(c);
      });
    });
    grid.querySelectorAll(".service-card").forEach(card=>{
      const open = ()=> openServiceModal(card.dataset.service);
      card.addEventListener("click", open);
      card.addEventListener("keydown", (e)=>{ if(e.key==="Enter" || e.key===" "){ e.preventDefault(); open(); } });
    });
  }
  render("All");
  toolbar.addEventListener("click", (e)=>{
    const btn = e.target.closest(".chip-filter");
    if (!btn) return;
    toolbar.querySelectorAll(".chip-filter").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    render(btn.dataset.cat);
  });

  document.getElementById("serviceCount").textContent = SERVICES.length + "+";
}

function escAttr(s){ return String(s).replace(/"/g,"&quot;"); }

/* ---------- service request modal (works for ALL 30+ services) ---------- */
let srSelectedFiles = [];
let srCurrentService = null;

function openServiceModal(serviceName){
  const svc = SERVICES.find(s=>s.name===serviceName);
  srCurrentService = svc || { name: serviceName, cat:"Service", desc:"" };
  srSelectedFiles = [];

  document.getElementById("svcModalCat").textContent = srCurrentService.cat;
  document.getElementById("svcModalTitle").textContent = srCurrentService.name;
  document.getElementById("svcModalDesc").textContent = srCurrentService.desc || "Fill in your details and our counter will process this request.";

  const form = document.getElementById("serviceRequestForm");
  form.reset();
  document.getElementById("srFileList").innerHTML = "";
  document.getElementById("srMsg").className = "form-msg";

  const user = KWO.currentUser();
  if (user){
    form.name.value = user.name;
    form.mobile.value = user.mobile;
  }

  document.getElementById("svcModalForm").style.display = "block";
  document.getElementById("svcModalOverlay").classList.add("show");
  document.body.style.overflow = "hidden";
  setTimeout(()=> form.name.focus(), 50);
}

function closeServiceModal(){
  document.getElementById("svcModalOverlay").classList.remove("show");
  document.body.style.overflow = "";
}

function initServiceModal(){
  const overlay = document.getElementById("svcModalOverlay");
  if (!overlay) return;

  document.getElementById("svcModalClose").addEventListener("click", closeServiceModal);
  overlay.addEventListener("click", (e)=>{ if (e.target === overlay) closeServiceModal(); });
  document.addEventListener("keydown", (e)=>{ if (e.key === "Escape" && overlay.classList.contains("show")) closeServiceModal(); });

  const drop = document.getElementById("srDrop");
  const input = document.getElementById("srFile");
  const fileList = document.getElementById("srFileList");

  ["dragenter","dragover"].forEach(ev=>{
    drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("dragover"); });
  });
  ["dragleave","drop"].forEach(ev=>{
    drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("dragover"); });
  });
  drop.addEventListener("drop", e=> handleSrFiles(e.dataTransfer.files));
  input.addEventListener("change", ()=> handleSrFiles(input.files));

  function handleSrFiles(fileListRaw){
    const allowed = ["application/pdf","image/jpeg","image/jpg","image/png"];
    for (const f of fileListRaw){
      if (!allowed.includes(f.type)){ showSrMsg("Only PDF, JPG or PNG files are accepted.", "err"); continue; }
      if (f.size > 15 * 1024 * 1024){ showSrMsg(`${f.name} is larger than 15 MB.`, "err"); continue; }
      srSelectedFiles.push(f);
    }
    renderSrFileList();
  }
  function renderSrFileList(){
    fileList.innerHTML = srSelectedFiles.map((f,i)=>`
      <div class="upload-file-chip">
        <span>📎 ${f.name} <em style="opacity:.7">(${KWO.fmtBytes(f.size)})</em></span>
        <button type="button" data-i="${i}" aria-label="Remove file">✕</button>
      </div>`).join("");
    fileList.querySelectorAll("button").forEach(b=>{
      b.addEventListener("click", ()=>{ srSelectedFiles.splice(+b.dataset.i,1); renderSrFileList(); });
    });
  }
  function showSrMsg(text, type){
    const msg = document.getElementById("srMsg");
    msg.textContent = text;
    msg.className = `form-msg show ${type}`;
  }

  document.getElementById("serviceRequestForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim();
    const mobile = form.mobile.value.trim();
    if (name.length < 3){ showSrMsg("Please enter your full name.", "err"); return; }
    if (!KWO.validMobile(mobile)){ showSrMsg("Enter a valid 10-digit mobile number.", "err"); return; }

    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Submitting…";

    try{
      const user = KWO.currentUser();
      const record = await KWO.createRequest({
        userId: user ? user.id : null,
        name, mobile,
        service: srCurrentService.name,
        notes: form.notes.value
      }, srSelectedFiles);

      closeServiceModal();
      KWO.celebrate({ service: srCurrentService.name, token: record.token });
    }catch(err){
      console.error(err);
      showSrMsg("Something went wrong. Please try again.", "err");
    }finally{
      btn.disabled = false; btn.textContent = "Submit request & get token";
    }
  });
}

function initHeroToken(){
  const el = document.getElementById("heroTokenNum");
  if (!el) return;
  const base = KWO.getRequests().length + 128; // demo baseline so it never looks empty
  let n = base;
  el.textContent = KWO.tokenNumber(n);
  setInterval(()=>{
    n += 1;
    el.textContent = KWO.tokenNumber(n);
  }, 4500);
}

function initHeroStats(){
  const users = KWO.getUsers().length + 640;
  const reqs  = KWO.getRequests().length + 1280;
  animateCount("statUsers", users);
  animateCount("statRequests", reqs);
}
function animateCount(id, target){
  const el = document.getElementById(id);
  if (!el) return;
  let start = 0;
  const dur = 1200, t0 = performance.now();
  function tick(t){
    const p = Math.min(1, (t - t0)/dur);
    el.textContent = Math.floor(p * target).toLocaleString("en-IN");
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = target.toLocaleString("en-IN");
  }
  requestAnimationFrame(tick);
}

/* ---------- quick print widget (homepage, guest-friendly) ---------- */
function initQuickPrint(){
  const form = document.getElementById("quickPrintForm");
  if (!form) return;
  const drop = document.getElementById("qpDrop");
  const input = document.getElementById("qpFile");
  const fileList = document.getElementById("qpFileList");
  const msg = document.getElementById("qpMsg");
  let selectedFiles = [];

  const user = KWO.currentUser();
  if (user){
    form.name.value = user.name;
    form.mobile.value = user.mobile;
  }

  ["dragenter","dragover"].forEach(ev=>{
    drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("dragover"); });
  });
  ["dragleave","drop"].forEach(ev=>{
    drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("dragover"); });
  });
  drop.addEventListener("drop", e=>{
    handleFiles(e.dataTransfer.files);
  });
  input.addEventListener("change", ()=> handleFiles(input.files));

  function handleFiles(fileListRaw){
    const allowed = ["application/pdf","image/jpeg","image/jpg","image/png"];
    for (const f of fileListRaw){
      if (!allowed.includes(f.type)){
        showMsg("Only PDF, JPG or PNG files are accepted.", "err");
        continue;
      }
      if (f.size > 15 * 1024 * 1024){
        showMsg(`${f.name} is larger than 15 MB.`, "err");
        continue;
      }
      selectedFiles.push(f);
    }
    renderFileList();
  }
  function renderFileList(){
    fileList.innerHTML = selectedFiles.map((f,i)=>`
      <div class="upload-file-chip">
        <span>📎 ${f.name} <em style="opacity:.7">(${KWO.fmtBytes(f.size)})</em></span>
        <button type="button" data-i="${i}" aria-label="Remove file">✕</button>
      </div>`).join("");
    fileList.querySelectorAll("button").forEach(b=>{
      b.addEventListener("click", ()=>{
        selectedFiles.splice(+b.dataset.i,1);
        renderFileList();
      });
    });
  }
  function showMsg(text, type){
    msg.textContent = text;
    msg.className = `form-msg show ${type}`;
  }

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const name = form.name.value.trim();
    const mobile = form.mobile.value.trim();
    if (name.length < 3){ showMsg("Please enter your full name.", "err"); return; }
    if (!KWO.validMobile(mobile)){ showMsg("Enter a valid 10-digit mobile number.", "err"); return; }
    if (!selectedFiles.length){ showMsg("Please attach at least one PDF/JPG/PNG file.", "err"); return; }

    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Submitting…";

    try{
      const record = await KWO.createRequest({
        userId: user ? user.id : null,
        name, mobile,
        service: "Print & Xerox",
        copies: form.copies.value || 1,
        printType: form.printType.value,
        notes: form.notes.value
      }, selectedFiles);

      showMsg(`Request submitted! Your token is ${record.token}. Please save this for pickup.`, "ok");
      KWO.celebrate({ service: `Print & Xerox${form.printType.value ? " · " + form.printType.value : ""}`, token: record.token });
      form.reset();
      selectedFiles = [];
      renderFileList();
      if (user){ form.name.value = user.name; form.mobile.value = user.mobile; }
    }catch(err){
      console.error(err);
      showMsg("Something went wrong while saving your file. Please try again.", "err");
    }finally{
      btn.disabled = false; btn.textContent = "Submit print request";
    }
  });
}

document.addEventListener("DOMContentLoaded", ()=>{
  initServiceGrid();
  initServiceModal();
  initHeroToken();
  initHeroStats();
  initQuickPrint();
});
