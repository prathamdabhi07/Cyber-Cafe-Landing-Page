/* =========================================================
   admin.js — admin-login.html + admin-dashboard.html logic
   ========================================================= */

const STATUS_BADGE_A = {
  "Pending":   "badge-pending",
  "In Progress": "badge-progress",
  "Ready":     "badge-ready",
  "Collected": "badge-collected",
  "Cancelled": "badge-cancelled"
};
const STATUS_OPTIONS = ["Pending","In Progress","Ready","Collected","Cancelled"];

document.addEventListener("DOMContentLoaded", () => {

  /* ---------- admin-login.html ---------- */
  const form = document.getElementById("adminLoginForm");
  if (form){
    if (KWO.isAdmin()){ window.location.href = "admin-dashboard.html"; return; }
    form.addEventListener("submit", (e)=>{
      e.preventDefault();
      const msg = document.getElementById("adminMsg");
      const res = KWO.loginAdmin({ username: form.username.value, password: form.password.value });
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
    });
  });

  document.getElementById("statusFilter").addEventListener("change", renderRequests);
  document.getElementById("searchReq").addEventListener("input", renderRequests);
  document.getElementById("searchUser").addEventListener("input", renderUsers);

  renderStats();
  renderRequests();
  renderUsers();
});

function renderStats(){
  const users = KWO.getUsers();
  const requests = KWO.getRequests();
  document.getElementById("aStUsers").textContent = users.length;
  document.getElementById("aStPending").textContent = requests.filter(r=>r.status==="Pending").length;
  document.getElementById("aStReady").textContent = requests.filter(r=>r.status==="Ready").length;
  document.getElementById("aStTotal").textContent = requests.length;
}

function renderRequests(){
  const wrap = document.getElementById("reqTableWrap");
  const statusVal = document.getElementById("statusFilter").value;
  const q = document.getElementById("searchReq").value.trim().toLowerCase();

  let requests = KWO.getRequests();
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
      if (!blob){ KWO.toast("File not found on this device.", "err"); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = btn.dataset.name;
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  wrap.querySelectorAll("select[data-id]").forEach(sel=>{
    sel.addEventListener("change", ()=>{
      KWO.updateRequestStatus(sel.dataset.id, sel.value);
      KWO.toast(`Status updated to "${sel.value}"`, "ok");
      renderStats();
    });
  });

  wrap.querySelectorAll("[data-delete]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if (!confirm("Delete this request and its uploaded file? This cannot be undone.")) return;
      KWO.deleteRequest(btn.dataset.delete);
      KWO.toast("Request deleted", "ok");
      renderRequests();
      renderStats();
    });
  });
}

function renderUsers(){
  const wrap = document.getElementById("userTableWrap");
  const q = document.getElementById("searchUser").value.trim().toLowerCase();
  let users = KWO.getUsers();
  if (q) users = users.filter(u => u.name.toLowerCase().includes(q) || u.mobile.includes(q));

  if (!users.length){
    wrap.innerHTML = `<div class="empty-state"><div class="u-icon">👥</div><p><strong>No customers found.</strong></p></div>`;
    return;
  }

  const allRequests = KWO.getRequests();

  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Name</th><th>Mobile</th><th>Email</th><th>Registered on</th><th>Requests</th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td><strong>${escHtml(u.name)}</strong></td>
              <td>${escHtml(u.mobile)}</td>
              <td>${escHtml(u.email) || "—"}</td>
              <td>${KWO.fmtDate(u.createdAt)}</td>
              <td>${allRequests.filter(r=>r.userId===u.id).length}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function truncate(s,n){ return s.length > n ? s.slice(0,n-1)+"…" : s; }
function escAttr(s){ return (s||"").replace(/"/g,"&quot;"); }
function escHtml(s){ return (s||"").replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
