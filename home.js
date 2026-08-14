let SERVICES = [];
const SERVICE_FORMS = window.KWO_SERVICE_FORMS || {};
let SITE_CONFIG = {serviceOverrides:{},removedServices:[],addedServices:[],tools:[],links:{}};
/* =========================================================
   home.js — homepage-only behaviour
   ========================================================= */

;

function refreshEditableSiteConfig(){
  SITE_CONFIG=KWO.getSiteConfig();
  const base=(window.KWO_SERVICES||[]).filter(s=>!SITE_CONFIG.removedServices.includes(s.slug)).map(s=>({...s,...(SITE_CONFIG.serviceOverrides[s.slug]||{}),slug:s.slug}));
  SERVICES=[...base,...(SITE_CONFIG.addedServices||[])].filter(s=>s.enabled!==false);
  Object.keys(SERVICE_FORMS).forEach(k=>delete SERVICE_FORMS[k]);
  SERVICES.forEach(s=>SERVICE_FORMS[s.name]=s);
  renderEditableTools();
}
function renderEditableTools(){
 const wrap=document.getElementById('digitalToolsGrid');if(!wrap)return;
 wrap.innerHTML=(SITE_CONFIG.tools||[]).filter(t=>t.enabled!==false).map(t=>`<a class="service-card in link-card" href="${escAttr(t.url)}" target="_blank" rel="noopener noreferrer"><div class="service-token" style="background:var(--${t.color||'teal'})">${escAttr(t.initials||'LINK')}</div><h4>${escAttr(t.title)}</h4><p>${escAttr(t.description||'Open this digital tool.')}</p><div class="s-meta"><span class="s-cat">Digital Tool</span><span>Open tool →</span></div></a>`).join('');
}

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

/* =========================================================
   SERVICE-SPECIFIC FORM CONFIGURATION
   ---------------------------------------------------------
   Backend is intentionally unchanged. Extra form values are
   stored inside the existing `notes` field, while each
   uploaded document is labelled in its existing file_name.
   ========================================================= */

;

;

function getServiceFormConfig(serviceName){
 const svc=SERVICES.find(x=>x.name===serviceName);
 return svc||SERVICE_FORMS[serviceName]||{fields:[["Applicant full name","text","applicant_name",true]],docs:[]};
}

function renderServiceSpecificForm(serviceName){
  const wrap = document.getElementById("srDynamicFields");
  if (!wrap) return;
  const cfg = getServiceFormConfig(serviceName);

  const fieldsHtml = cfg.fields.map(([label,type,key,required,choices])=>{
    const req = required ? " required" : "";
    const hint = required ? "" : `<span class="hint">optional</span>`;
    if (type === "select"){
      return `<div class="field"><label for="sr_${key}">${label} ${hint}</label>
        <select id="sr_${key}" name="dynamic_${key}" data-field-key="${key}"${req}>
          <option value="">Select</option>${choices.map(c=>`<option value="${escAttr(c)}">${c}</option>`).join("")}
        </select></div>`;
    }
    return `<div class="field"><label for="sr_${key}">${label} ${hint}</label>
      <input type="${type}" id="sr_${key}" name="dynamic_${key}" data-field-key="${key}"${req}></div>`;
  }).join("");

  const docsHtml = cfg.docs.length ? `
    <div class="service-doc-section">
      <div class="service-doc-head">
        <strong>Required / Supporting Documents</strong>
        <span>Each document has its own upload button</span>
      </div>
      <div class="service-doc-grid">
        ${cfg.docs.map((doc,i)=>{
          const choices = doc.choices || [];
          return `<div class="service-doc-card" data-doc-key="${doc.key}">
            <div class="service-doc-title">
              <strong>${doc.label}</strong>
              <span class="${doc.required ? "doc-required" : "doc-optional"}">${doc.required ? "Required" : "Optional"}</span>
            </div>
            ${choices.length ? `<select class="doc-choice" data-choice-for="${i}">
              <option value="">Select proof type</option>
              ${choices.map(c=>`<option value="${escAttr(c)}">${c}</option>`).join("")}
            </select>` : ""}
            <label class="doc-upload-btn">
              <input type="file" class="sr-specific-file" data-doc-index="${i}" accept=".pdf,.jpg,.jpeg,.png" ${doc.required ? "required" : ""}>
              <span>↑ Upload ${doc.label}</span>
            </label>
            <div class="doc-file-name" data-file-for="${i}">No file selected</div>
          </div>`;
        }).join("")}
      </div>
    </div>` : "";

  wrap.innerHTML = fieldsHtml + docsHtml;
}

function validateAndCollectSpecificFiles(){
  const cfg = getServiceFormConfig(srCurrentService ? srCurrentService.name : "");
  const files = [];
  const details = [];

  document.querySelectorAll("#srDynamicFields [data-field-key]").forEach(el=>{
    const value = String(el.value || "").trim();
    if (value) details.push(`${el.closest(".field").querySelector("label").textContent.replace("optional","").trim()}: ${value}`);
  });

  const docCards = document.querySelectorAll("#srDynamicFields .service-doc-card");
  for (const card of docCards){
    const input = card.querySelector(".sr-specific-file");
    const doc = cfg.docs[Number(input.dataset.docIndex)];
    const choice = card.querySelector(".doc-choice");
    const file = input.files && input.files[0];

    if (doc.required && !file){
      return { error:`Please upload: ${doc.label}.` };
    }
    if (doc.choices && !choice.value && file){
      return { error:`Please select the DOB/proof type for: ${doc.label}.` };
    }
    if (file){
      if (!["application/pdf","image/jpeg","image/jpg","image/png"].includes(file.type)){
        return { error:`Only PDF, JPG or PNG is accepted for ${doc.label}.` };
      }
      if (file.size > 15 * 1024 * 1024){
        return { error:`${doc.label} is larger than 15 MB.` };
      }
      const choiceText = choice && choice.value ? ` - ${choice.value}` : "";
      const labelledName = `KWO - ${srCurrentService.name} - ${doc.label}${choiceText} - ${file.name}`;
      files.push(new File([file], labelledName, {type:file.type, lastModified:file.lastModified}));
      details.push(`Document: ${doc.label}${choiceText} → ${file.name}`);
    }
  }
  return {files, details};
}

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
  renderServiceSpecificForm(srCurrentService.name);
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

  document.getElementById("srDynamicFields").addEventListener("change", (e)=>{
    if (!e.target.classList.contains("sr-specific-file")) return;
    const card = e.target.closest(".service-doc-card");
    const out = card && card.querySelector(".doc-file-name");
    const file = e.target.files && e.target.files[0];
    if (out) out.textContent = file ? `✓ ${file.name} (${KWO.fmtBytes(file.size)})` : "No file selected";
  });

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

    if (name.length < 3){ showSrMsg("Please enter the applicant/customer full name.", "err"); return; }
    if (!KWO.validMobile(mobile)){ showSrMsg("Enter a valid 10-digit mobile number.", "err"); return; }

    const collected = validateAndCollectSpecificFiles();
    if (collected.error){ showSrMsg(collected.error, "err"); return; }

    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Submitting…";

    try{
      const user = KWO.currentUser();
      const notesParts = [...collected.details];
      if (form.notes.value.trim()) notesParts.push(`Extra notes: ${form.notes.value.trim()}`);

      const record = await KWO.createRequest({
        userId: user ? user.id : null,
        name,
        mobile: mobile || (user ? user.mobile : ""),
        service: srCurrentService.name,
        copies: form.querySelector('[data-field-key="copies"]')?.value || null,
        printType: form.querySelector('[data-field-key="print_type"]')?.value || null,
        notes: notesParts.join("\n")
      }, [...collected.files, ...srSelectedFiles]);

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

async function initHeroToken(){
  const el = document.getElementById("heroTokenNum");
  if (!el) return;
  const requests = await KWO.getRequests();
  const base = requests.length + 128; // demo baseline so it never looks empty
  let n = base;
  el.textContent = KWO.tokenNumber(n);
  setInterval(()=>{
    n += 1;
    el.textContent = KWO.tokenNumber(n);
  }, 4500);
}

async function initHeroStats(){
  const [allUsers, allRequests] = await Promise.all([KWO.getUsers(), KWO.getRequests()]);
  const users = allUsers.length + 640;
  const reqs  = allRequests.length + 1280;
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

document.addEventListener("DOMContentLoaded", async ()=>{
  if (window.kwoServicesReady) await window.kwoServicesReady;
  await KWO.syncSiteConfig();
  refreshEditableSiteConfig();
  initServiceGrid();
  initServiceModal();
  initQuickPrint();
  await initHeroToken();
  await initHeroStats();
});
