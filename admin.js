/* =========================================================
   admin.js — admin-login.html + admin-dashboard.html logic
   (Requests / Customers / Services / Links manager)
   ========================================================= */

const STATUS_BADGE_A = {
  "Pending":   "badge-pending",
  "In Progress": "badge-progress",
  "Ready":     "badge-ready",
  "Collected": "badge-collected",
  "Cancelled": "badge-cancelled"
};
const STATUS_OPTIONS = ["Pending","In Progress","Ready","Collected","Cancelled"];

document.addEventListener("DOMContentLoaded", async () => {

  /* ---------- admin-login.html ---------- */
  const form = document.getElementById("adminLoginForm");
  if (form){
    if (KWO.isAdmin()){ window.location.href = "admin-dashboard.html"; return; }
    form.addEventListener("submit", async (e)=>{
      e.preventDefault();
      const msg = document.getElementById("adminMsg");
      const btn = form.querySelector("button[type=submit]");
      if (btn){ btn.disabled = true; btn.textContent = "Signing in…"; }

      const res = await KWO.loginAdmin({ username: form.username.value, password: form.password.value });

      if (btn){ btn.disabled = false; btn.textContent = "Login"; }

      if (!res.ok){
        msg.textContent = res.error; msg.className = "form-msg show err"; return;
      }
      msg.textContent = "Login successful — redirecting…"; msg.className = "form-msg show ok";
      setTimeout(()=> window.location.href = "admin-dashboard.html", 400);
    });
    return;
  }

  /* ---------- admin-dashboard.html ---------- */
  const shell = document.getElementById("dashShell");
  if (!shell) return;

  if (!KWO.isAdmin()){
    document.getElementById("loginGate").style.display = "block";
    shell.style.display = "none";
    return;
  }
  shell.style.display = "grid";

  document.getElementById("adminLogoutBtn").addEventListener("click", (e)=>{
    e.preventDefault();
    KWO.logoutAdmin();
    window.location.href = "admin-login.html";
  });

  // tabs
  document.querySelectorAll(".side-link[data-tab]").forEach(link=>{
    link.addEventListener("click", (e)=>{
      e.preventDefault();
      document.querySelectorAll(".side-link[data-tab]").forEach(l=>l.classList.remove("active"));
      link.classList.add("active");
      const tab = link.dataset.tab;
      document.getElementById("tab-requests").style.display = tab === "requests" ? "block" : "none";
      document.getElementById("tab-customers").style.display = tab === "customers" ? "block" : "none";
      document.getElementById("tab-site-editor").style.display = tab === "site-editor" ? "block" : "none";
      document.getElementById("tab-tools-editor").style.display = tab === "tools-editor" ? "block" : "none";
      if (tab === "site-editor") renderServiceManager();
      if (tab === "tools-editor") renderToolsManager();
    });
  });

  document.getElementById("statusFilter").addEventListener("change", renderRequests);
  document.getElementById("searchReq").addEventListener("input", renderRequests);
  document.getElementById("searchUser").addEventListener("input", renderUsers);

  let allRequestsCache = [];

  // site-editor state must exist before initSiteEditor() runs below
  let siteEditorState = null;
  let editingServiceSlug = null;   // slug currently open in the service modal (null = adding new)
  let editingToolIndex = null;     // index currently open in the link modal (null = adding new)

  const FOOTER_LINKS = [
    ['all_services','All services'],['print','Print & Xerox'],['about','About centre'],
    ['contact','Contact'],['register','Create account'],['login','Customer login'],
    ['dashboard','My dashboard'],['admin','Admin login']
  ];
  const CARD_COLORS = ['navy','saffron','teal'];

  try { await renderStats(); } catch(e){ console.error("renderStats failed", e); }
  try { await renderRequests(); } catch(e){ console.error("renderRequests failed", e); }
  try { await renderUsers(); } catch(e){ console.error("renderUsers failed", e); }
  try { await window.kwoServicesReady; } catch(e){ console.error("Service configs failed to load", e); }
  try { await KWO.syncSiteConfig(); } catch(e){ console.error("syncSiteConfig failed", e); }
  initSiteEditor();

  /* ================= Requests tab ================= */
  async function renderStats(){
    const users = await KWO.getUsers();
    const requests = await KWO.getRequests();
    document.getElementById("aStUsers").textContent = users.length;
    document.getElementById("aStPending").textContent = requests.filter(r=>r.status==="Pending").length;
    document.getElementById("aStReady").textContent = requests.filter(r=>r.status==="Ready").length;
    document.getElementById("aStTotal").textContent = requests.length;
  }

  async function renderRequests(){
    const wrap = document.getElementById("reqTableWrap");
    const statusVal = document.getElementById("statusFilter").value;
    const q = document.getElementById("searchReq").value.trim().toLowerCase();

    let requests = await KWO.getRequests();
    allRequestsCache = requests;
    if (statusVal !== "All") requests = requests.filter(r => r.status === statusVal);
    if (q) requests = requests.filter(r =>
      r.name.toLowerCase().includes(q) || r.mobile.includes(q) || r.token.toLowerCase().includes(q)
    );

    if (!requests.length){
      wrap.innerHTML = `<div class="empty-state"><div class="u-icon">📭</div><p><strong>No matching requests.</strong></p></div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Token</th><th>Customer</th><th>Mobile</th><th>Service</th><th>Files</th><th>Submitted</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${requests.map(r => `
              <tr>
                <td><strong style="font-family:var(--font-mono)">${r.token}</strong></td>
                <td>${escHtml(r.name)}${r.userId? ' <span style="color:var(--teal-deep);font-size:11px">● registered</span>' : ' <span style="color:var(--ink-soft);font-size:11px">guest</span>'}</td>
                <td>${escHtml(r.mobile)}</td>
                <td>${escHtml(r.service)}${r.printType? ` <span style="color:var(--ink-soft)">· ${escHtml(r.printType)}</span>`:""}${r.copies? ` <span style="color:var(--ink-soft)">· ${escHtml(String(r.copies))} copies</span>`:""}</td>
                <td>${(r.files||[]).map(f=>`<button class="icon-btn" data-file="${f.key}" data-name="${escAttr(f.name)}" title="Download">⬇ ${truncate(f.name,14)}</button>`).join(" ") || "—"}</td>
                <td>${KWO.fmtDate(r.createdAt)}</td>
                <td>
                  <select class="select-status" data-id="${r.id}">
                    ${STATUS_OPTIONS.map(s=>`<option ${s===r.status?"selected":""}>${s}</option>`).join("")}
                  </select>
                </td>
                <td><button class="icon-btn" data-delete="${r.id}" title="Delete request">🗑</button></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;

    wrap.querySelectorAll("[data-file]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const blob = await KWO.getFile(btn.dataset.file);
        if (!blob){ KWO.toast("File not found.", "err"); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = btn.dataset.name;
        a.click();
        URL.revokeObjectURL(url);
      });
    });

    wrap.querySelectorAll("select[data-id]").forEach(sel=>{
      sel.addEventListener("change", async ()=>{
        await KWO.updateRequestStatus(sel.dataset.id, sel.value);
        KWO.toast(`Status updated to "${sel.value}"`, "ok");
        await renderStats();
      });
    });

    wrap.querySelectorAll("[data-delete]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        if (!confirm("Delete this request and its uploaded file? This cannot be undone.")) return;
        await KWO.deleteRequest(btn.dataset.delete);
        KWO.toast("Request deleted", "ok");
        await renderRequests();
        await renderStats();
      });
    });
  }

  /* ================= Customers tab ================= */
  async function renderUsers(){
    const wrap = document.getElementById("userTableWrap");
    const q = document.getElementById("searchUser").value.trim().toLowerCase();
    let users = await KWO.getUsers();
    if (q) users = users.filter(u => u.name.toLowerCase().includes(q) || u.mobile.includes(q));

    if (!users.length){
      wrap.innerHTML = `<div class="empty-state"><div class="u-icon">👥</div><p><strong>No customers found.</strong></p></div>`;
      return;
    }

    const allRequests = allRequestsCache.length ? allRequestsCache : await KWO.getRequests();

    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Name</th><th>Mobile</th><th>Email</th><th>Registered on</th><th>Services used</th></tr></thead>
          <tbody>
            ${users.map(u => {
              const theirs = allRequests.filter(r=>r.userId===u.id);
              const services = [...new Set(theirs.map(r=>r.service).filter(Boolean))];
              let svcCell;
              if (!services.length){
                svcCell = `<span style="color:var(--ink-soft);font-size:12px">No requests yet</span>`;
              } else {
                const shown = services.slice(0,3).map(s=>`<span class="customer-svc-chip">${escHtml(s)}</span>`).join("");
                const more = services.length > 3 ? `<span class="customer-svc-more" data-more="${u.id}">+${services.length-3} more</span>` : "";
                svcCell = `<div>${shown}${more}</div><div style="margin-top:4px;font-size:11px;color:var(--ink-soft)">${theirs.length} request${theirs.length===1?"":"s"} total</div>`;
              }
              return `
                <tr>
                  <td><strong>${escHtml(u.name)}</strong></td>
                  <td>${escHtml(u.mobile)}</td>
                  <td>${escHtml(u.email) || "—"}</td>
                  <td>${KWO.fmtDate(u.createdAt)}</td>
                  <td>${svcCell}</td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;

    wrap.querySelectorAll("[data-more]").forEach(el=>{
      el.addEventListener("click", ()=>{
        const u = users.find(x=>x.id===el.dataset.more);
        const services = [...new Set(allRequests.filter(r=>r.userId===u.id).map(r=>r.service).filter(Boolean))];
        alert(`${u.name} — services used:\n\n` + services.map(s=>"• "+s).join("\n"));
      });
    });
  }

  function truncate(s,n){ return s.length > n ? s.slice(0,n-1)+"…" : s; }
  function escAttr(s){ return (s||"").replace(/"/g,"&quot;"); }
  function escHtml(s){ return (s||"").replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  /* =========================================================
     Site editor — Services & Links manager (card + modal UI)
     ========================================================= */
  function cloneCfg(){ return JSON.parse(JSON.stringify(KWO.getSiteConfig())); }
  function eA(v){ return String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function slugify(v){ return String(v||'service').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || ('service-'+Date.now()); }

  function initSiteEditor(){
    siteEditorState = cloneCfg();

    document.getElementById('addServiceBtn')?.addEventListener('click', () => openServiceModal(null));
    document.getElementById('addToolBtn')?.addEventListener('click', () => openLinkModal(null));
    document.getElementById('saveAllSiteChanges')?.addEventListener('click', saveSiteChanges);
    document.getElementById('resetAllSiteChanges')?.addEventListener('click', () => {
      if (!confirm('Reset all service, form, document and link edits back to default? This cannot be undone.')) return;
      KWO.resetSiteConfig();
      siteEditorState = cloneCfg();
      renderServiceManager();
      renderToolsManager();
      KWO.toast('Editor reset to defaults.', 'ok');
    });

    document.getElementById('svcSearch')?.addEventListener('input', renderServiceManager);
    document.getElementById('svcCatFilter')?.addEventListener('change', renderServiceManager);
    document.getElementById('svcStatusFilter')?.addEventListener('change', renderServiceManager);

    // modal chrome
    bindModalClose('svcEditModalOverlay', 'svcEditModalClose');
    bindModalClose('linkEditModalOverlay', 'linkEditModalClose');
    bindColorPicker('se-color-picker');
    bindColorPicker('le-color-picker');

    document.getElementById('addFieldBtn')?.addEventListener('click', () => {
      document.getElementById('fieldRows').insertAdjacentHTML('beforeend', fieldRowHtml(['New field','text','new_field',false,[]]));
      bindDynRowDelete();
      toggleEmpty('fieldRows','fieldRowsEmpty');
    });
    document.getElementById('addDocBtn')?.addEventListener('click', () => {
      document.getElementById('docRows').insertAdjacentHTML('beforeend', docRowHtml({key:'new_document',label:'New document',hint:'PDF/JPG/PNG',required:false,choices:[]}));
      bindDynRowDelete();
      toggleEmpty('docRows','docRowsEmpty');
    });
    document.getElementById('applySvcBtn')?.addEventListener('click', applyServiceModal);
    document.getElementById('applyLinkBtn')?.addEventListener('click', applyLinkModal);
  }

  function bindModalClose(overlayId, closeBtnId){
    const overlay = document.getElementById(overlayId);
    const btn = document.getElementById(closeBtnId);
    if (!overlay) return;
    const close = () => overlay.classList.remove('show');
    btn?.addEventListener('click', close);
    overlay.addEventListener('click', (e)=>{ if (e.target === overlay) close(); });
  }
  function bindColorPicker(wrapId){
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    wrap.querySelectorAll('.mform-color-opt').forEach(opt=>{
      opt.addEventListener('click', ()=>{
        wrap.querySelectorAll('.mform-color-opt').forEach(o=>o.classList.remove('picked'));
        opt.classList.add('picked');
      });
    });
  }
  function pickColor(wrapId, color){
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    wrap.querySelectorAll('.mform-color-opt').forEach(o=> o.classList.toggle('picked', o.dataset.color === (color||'teal')));
  }
  function getPickedColor(wrapId){
    return document.querySelector(`#${wrapId} .mform-color-opt.picked`)?.dataset.color || 'teal';
  }
  function toggleEmpty(rowsId, emptyId){
    const rows = document.getElementById(rowsId);
    const empty = document.getElementById(emptyId);
    if (rows && empty) empty.style.display = rows.children.length ? 'none' : 'block';
  }
  function bindDynRowDelete(){
    document.querySelectorAll('[data-del-row]').forEach(b=>{
      b.onclick = () => {
        const row = b.closest('.dyn-row');
        const parent = row.parentElement;
        row.remove();
        if (parent.id === 'fieldRows') toggleEmpty('fieldRows','fieldRowsEmpty');
        if (parent.id === 'docRows') toggleEmpty('docRows','docRowsEmpty');
      };
    });
  }

  function editorServices(){
    const base = (window.KWO_SERVICES||[]).map(s => ({
      ...s, ...(siteEditorState.serviceOverrides[s.slug]||{}),
      slug: s.slug, base: true, removed: siteEditorState.removedServices.includes(s.slug)
    }));
    return [...base, ...siteEditorState.addedServices.map(s => ({...s, base:false, removed:false}))];
  }

  /* ---------- Services grid ---------- */
  function renderServiceManager(){
    const w = document.getElementById('serviceManagerWrap');
    if (!w) return;
    let list = editorServices();

    // populate category filter once per render (keeps current selection)
    const catFilter = document.getElementById('svcCatFilter');
    if (catFilter){
      const cats = [...new Set(list.map(s=>s.cat).filter(Boolean))].sort();
      const current = catFilter.value;
      catFilter.innerHTML = `<option value="">All categories</option>` + cats.map(c=>`<option ${c===current?'selected':''}>${eA(c)}</option>`).join('');
    }

    const q = (document.getElementById('svcSearch')?.value||'').trim().toLowerCase();
    const cat = document.getElementById('svcCatFilter')?.value||'';
    const statusVal = document.getElementById('svcStatusFilter')?.value||'';

    let filtered = list;
    if (q) filtered = filtered.filter(s => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q));
    if (cat) filtered = filtered.filter(s => s.cat === cat);
    if (statusVal === 'active') filtered = filtered.filter(s => !s.removed);
    if (statusVal === 'removed') filtered = filtered.filter(s => s.removed);

    document.getElementById('svcCount').textContent = `${filtered.length} of ${list.length} services`;

    const cards = filtered.map(s => `
      <div class="mgr-card ${s.removed?'is-removed':''}">
        <div class="mgr-card-top">
          <div class="mgr-token" style="background:var(--${s.color||'navy'})">${eA((s.name||'?').slice(0,2).toUpperCase())}</div>
          <div class="mgr-card-title"><strong>${eA(s.name)}</strong><span>${eA(s.cat||'Uncategorised')}</span></div>
        </div>
        <div class="mgr-card-desc">${eA(s.desc || 'No description yet.')}</div>
        <div class="mgr-card-meta">
          <span class="mgr-pill ${s.removed?'off':'on'}">${s.removed?'Removed':'Active'}</span>
          <span class="mgr-pill">${(s.fields||[]).length} field${(s.fields||[]).length===1?'':'s'}</span>
          <span class="mgr-pill">${(s.docs||[]).length} doc${(s.docs||[]).length===1?'':'s'}</span>
        </div>
        <div class="mgr-card-actions">
          <button class="icon-btn" data-edit="${eA(s.slug)}">✏️ Edit</button>
          ${s.removed
            ? `<button class="icon-btn" data-restore="${eA(s.slug)}">↩ Restore</button>`
            : `<button class="icon-btn danger" data-remove="${eA(s.slug)}">🗑 Remove</button>`}
        </div>
      </div>`).join('');

    w.innerHTML = cards + `<div class="mgr-add-card" id="svcAddCard"><span class="plus">＋</span> Add new service</div>`;

    w.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openServiceModal(b.dataset.edit));
    w.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => removeService(b.dataset.remove));
    w.querySelectorAll('[data-restore]').forEach(b => b.onclick = () => {
      siteEditorState.removedServices = siteEditorState.removedServices.filter(x => x !== b.dataset.restore);
      renderServiceManager();
      KWO.toast('Service restored. Remember to save & publish.', 'ok');
    });
    document.getElementById('svcAddCard').onclick = () => openServiceModal(null);
  }

  function removeService(slug){
    if (!confirm('Puri service remove karni hai? Customer side par service aur uska form nahi dikhega.')) return;
    const i = siteEditorState.addedServices.findIndex(x => x.slug === slug);
    if (i >= 0) siteEditorState.addedServices.splice(i,1);
    else if (!siteEditorState.removedServices.includes(slug)) siteEditorState.removedServices.push(slug);
    renderServiceManager();
  }

  /* ---------- Service modal ---------- */
  function fieldRowHtml(f){
    // f = [label, type, key, required, choices]
    const [label,type,key,req,choices] = f;
    return `<div class="dyn-row field-row">
      <input class="f-label" value="${eA(label)}" placeholder="Field label">
      <select class="f-type">${['text','tel','email','date','number','select'].map(t=>`<option ${t===type?'selected':''}>${t}</option>`).join('')}</select>
      <input class="f-key" value="${eA(key)}" placeholder="field_key">
      <label><input type="checkbox" class="f-req" ${req?'checked':''}> Required</label>
      <button type="button" class="icon-btn danger" data-del-row title="Remove field">🗑</button>
      <input class="f-choices" style="grid-column:1/-1;margin-top:4px" value="${eA(Array.isArray(choices)?choices.join(', '):'')}" placeholder="Only for 'select' type — choices comma separated">
    </div>`;
  }
  function docRowHtml(d){
    return `<div class="dyn-row doc-row doc">
      <input class="d-key" value="${eA(d.key)}" placeholder="document_key">
      <input class="d-label" value="${eA(d.label)}" placeholder="Document name">
      <input class="d-hint" value="${eA(d.hint||'PDF/JPG/PNG')}" placeholder="Hint">
      <label><input type="checkbox" class="d-req" ${d.required?'checked':''}> Required</label>
      <button type="button" class="icon-btn danger" data-del-row title="Remove document">🗑</button>
      <input class="d-choices" style="grid-column:1/-1;margin-top:4px" value="${eA((d.choices||[]).join(', '))}" placeholder="Choices (optional, comma separated)">
    </div>`;
  }

  function openServiceModal(slug){
    editingServiceSlug = slug;
    const isNew = !slug;
    const s = isNew
      ? { name:'', cat:'', desc:'', color:'teal', enabled:true, fields:[['Applicant full name','text','applicant_name',true,[]]], docs:[] }
      : editorServices().find(x => x.slug === slug);
    if (!isNew && !s){ KWO.toast('Service not found.', 'err'); return; }

    document.getElementById('svcEditModalTitle').textContent = isNew ? 'Add new service' : 'Edit service';
    document.getElementById('svcEditModalTag').textContent = isNew ? 'New' : s.slug;
    document.getElementById('se-name').value = s.name || '';
    document.getElementById('se-cat').value = s.cat || '';
    document.getElementById('se-desc').value = s.desc || '';
    document.getElementById('se-enabled').checked = s.enabled !== false;
    pickColor('se-color-picker', s.color || 'navy');

    document.getElementById('fieldRows').innerHTML = (s.fields||[]).map(f => fieldRowHtml(Array.isArray(f) ? f : [f.label,f.type,f.key,f.required,f.choices])).join('');
    document.getElementById('docRows').innerHTML = (s.docs||[]).map(docRowHtml).join('');
    bindDynRowDelete();
    toggleEmpty('fieldRows','fieldRowsEmpty');
    toggleEmpty('docRows','docRowsEmpty');

    document.getElementById('svcEditMsg').className = 'form-msg';
    document.getElementById('svcEditModalOverlay').classList.add('show');
  }

  function applyServiceModal(){
    const name = document.getElementById('se-name').value.trim();
    const msgEl = document.getElementById('svcEditMsg');
    if (!name){
      msgEl.textContent = 'Service name is required.'; msgEl.className = 'form-msg show err';
      return;
    }

    const fields = [...document.querySelectorAll('#fieldRows .field-row')].map(r => {
      const f = [
        r.querySelector('.f-label').value.trim(),
        r.querySelector('.f-type').value,
        r.querySelector('.f-key').value.trim() || slugify(r.querySelector('.f-label').value),
        r.querySelector('.f-req').checked
      ];
      const choices = r.querySelector('.f-choices').value.split(',').map(x=>x.trim()).filter(Boolean);
      if (f[1] === 'select') f.push(choices);
      return f;
    });

    const docs = [...document.querySelectorAll('#docRows .doc-row')].map(r => ({
      key: r.querySelector('.d-key').value.trim() || slugify(r.querySelector('.d-label').value),
      label: r.querySelector('.d-label').value.trim() || 'Document',
      hint: r.querySelector('.d-hint').value.trim(),
      required: r.querySelector('.d-req').checked,
      choices: r.querySelector('.d-choices').value.split(',').map(x=>x.trim()).filter(Boolean)
    }));

    const isNew = !editingServiceSlug;
    let slug = editingServiceSlug;
    if (isNew){
      slug = slugify(name);
      let i = 1;
      while (editorServices().some(x => x.slug === slug)) slug = slugify(name) + '-' + (++i);
    }

    const updated = {
      slug, name,
      cat: document.getElementById('se-cat').value.trim(),
      desc: document.getElementById('se-desc').value.trim(),
      color: getPickedColor('se-color-picker'),
      enabled: document.getElementById('se-enabled').checked,
      fields, docs
    };

    const existing = isNew ? null : editorServices().find(x => x.slug === slug);
    if (isNew){
      siteEditorState.addedServices.push(updated);
    } else if (existing && existing.base){
      siteEditorState.serviceOverrides[slug] = updated;
    } else {
      const i = siteEditorState.addedServices.findIndex(x => x.slug === slug);
      if (i >= 0) siteEditorState.addedServices[i] = updated;
    }

    document.getElementById('svcEditModalOverlay').classList.remove('show');
    KWO.toast(isNew ? 'Service added. Remember to save & publish.' : 'Service updated. Remember to save & publish.', 'ok');
    renderServiceManager();
  }

  /* ---------- Tools / links grid ---------- */
  function renderToolsManager(){
    const w = document.getElementById('toolsManagerWrap');
    if (!w) return;
    const tools = siteEditorState.tools || [];
    document.getElementById('toolCount').textContent = `${tools.length} link${tools.length===1?'':'s'}`;

    const cards = tools.map((t,i) => `
      <div class="mgr-card ${t.enabled===false?'is-off':''}">
        <div class="mgr-card-top">
          <div class="mgr-token" style="background:var(--${t.color||'teal'})">${eA((t.initials||'LNK').slice(0,4))}</div>
          <div class="mgr-card-title"><strong>${eA(t.title||'Untitled link')}</strong><span>${eA(t.url||'')}</span></div>
        </div>
        <div class="mgr-card-desc">${eA(t.description || 'No description yet.')}</div>
        <div class="mgr-card-meta"><span class="mgr-pill ${t.enabled===false?'off':'on'}">${t.enabled===false?'Hidden':'Visible'}</span></div>
        <div class="mgr-card-actions">
          <button class="icon-btn" data-edit-tool="${i}">✏️ Edit</button>
          <button class="icon-btn danger" data-del-tool="${i}">🗑 Delete</button>
        </div>
      </div>`).join('');

    w.innerHTML = cards + `<div class="mgr-add-card" id="toolAddCard"><span class="plus">＋</span> Add new link</div>`;

    w.querySelectorAll('[data-edit-tool]').forEach(b => b.onclick = () => openLinkModal(Number(b.dataset.editTool)));
    w.querySelectorAll('[data-del-tool]').forEach(b => b.onclick = () => {
      if (!confirm('Delete this link? It will disappear from the homepage once you save & publish.')) return;
      siteEditorState.tools.splice(Number(b.dataset.delTool), 1);
      renderToolsManager();
    });
    document.getElementById('toolAddCard').onclick = () => openLinkModal(null);

    renderFooterLinks();
  }

  function openLinkModal(index){
    editingToolIndex = index;
    const isNew = index === null;
    const t = isNew ? { title:'', description:'', url:'https://', initials:'LNK', color:'teal', enabled:true } : siteEditorState.tools[index];
    if (!isNew && !t){ KWO.toast('Link not found.', 'err'); return; }

    document.getElementById('linkEditModalTitle').textContent = isNew ? 'Add new link' : 'Edit link';
    document.getElementById('le-title').value = t.title || '';
    document.getElementById('le-desc').value = t.description || '';
    document.getElementById('le-url').value = t.url || '';
    document.getElementById('le-init').value = t.initials || 'LNK';
    document.getElementById('le-enabled').checked = t.enabled !== false;
    pickColor('le-color-picker', t.color || 'teal');

    document.getElementById('linkEditMsg').className = 'form-msg';
    document.getElementById('linkEditModalOverlay').classList.add('show');
  }

  function applyLinkModal(){
    const title = document.getElementById('le-title').value.trim();
    const url = document.getElementById('le-url').value.trim();
    const msgEl = document.getElementById('linkEditMsg');
    if (!title || !url){
      msgEl.textContent = 'Title and URL are both required.'; msgEl.className = 'form-msg show err';
      return;
    }

    const updated = {
      id: (editingToolIndex !== null && siteEditorState.tools[editingToolIndex]?.id) || ('tool-' + Date.now()),
      title,
      description: document.getElementById('le-desc').value.trim(),
      url,
      initials: document.getElementById('le-init').value.trim() || 'LNK',
      color: getPickedColor('le-color-picker'),
      enabled: document.getElementById('le-enabled').checked
    };

    if (editingToolIndex === null) siteEditorState.tools.push(updated);
    else siteEditorState.tools[editingToolIndex] = updated;

    document.getElementById('linkEditModalOverlay').classList.remove('show');
    KWO.toast(editingToolIndex === null ? 'Link added. Remember to save & publish.' : 'Link updated. Remember to save & publish.', 'ok');
    renderToolsManager();
  }

  function renderFooterLinks(){
    const w = document.getElementById('footerLinksManager');
    if (!w) return;
    w.innerHTML = FOOTER_LINKS.map(([k,d]) => {
      const l = siteEditorState.links[k] || {};
      return `<div class="dyn-row footer-row" style="grid-template-columns:1fr 1fr 2fr">
        <strong>${eA(d)}</strong>
        <input class="l-label" data-key="${eA(k)}" value="${eA(l.label||d)}" placeholder="Label">
        <input class="l-href" data-key="${eA(k)}" value="${eA(l.href||'')}" placeholder="URL / page">
      </div>`;
    }).join('');
  }

  async function saveSiteChanges(){
    document.querySelectorAll('#footerLinksManager .footer-row').forEach(row => {
      const key = row.querySelector('.l-label').dataset.key;
      siteEditorState.links[key] = {
        label: row.querySelector('.l-label').value.trim(),
        href: row.querySelector('.l-href').value.trim()
      };
    });

    const msg = document.getElementById('siteEditorMsg');
    msg.textContent = 'Saving…'; msg.className = 'form-msg show';

    const result = await KWO.publishSiteConfig(siteEditorState);
    if (result.ok){
      msg.textContent = 'Saved — the customer homepage will show these changes after a refresh.';
      msg.className = 'form-msg show ok';
      KWO.toast('Changes published to the live website.', 'ok');
    } else {
      msg.textContent = 'Saved locally, but publishing to the shared website failed: ' + result.error;
      msg.className = 'form-msg show err';
      KWO.toast('Publish failed — check your internet connection and try again.', 'err');
    }
  }

});
