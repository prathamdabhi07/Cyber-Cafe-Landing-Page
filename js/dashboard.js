/* =========================================================
   dashboard.js — dashboard.html logic
   ========================================================= */

const STATUS_BADGE = {
  "Pending":   "badge-pending",
  "In Progress": "badge-progress",
  "Ready":     "badge-ready",
  "Collected": "badge-collected",
  "Cancelled": "badge-cancelled"
};

document.addEventListener("DOMContentLoaded", () => {
  const user = KWO.currentUser();

  if (!user){
    document.getElementById("loginGate").style.display = "block";
    document.getElementById("dashShell").style.display = "none";
    return;
  }

  document.getElementById("dashShell").style.display = "grid";

  document.getElementById("sideAvatar").textContent = KWO.initials(user.name);
  document.getElementById("sideName").textContent = user.name;
  document.getElementById("sideMobile").textContent = user.mobile;
  document.getElementById("welcomeName").textContent = user.name.split(" ")[0];

  document.getElementById("logoutBtn").addEventListener("click", (e)=>{
    e.preventDefault();
    KWO.logoutUser();
    window.location.href = "index.html";
  });

  renderRequests();
});

function renderRequests(){
  const user = KWO.currentUser();
  const requests = KWO.requestsForUser(user.id);

  document.getElementById("stTotal").textContent = requests.length;
  document.getElementById("stPending").textContent = requests.filter(r=>r.status==="Pending").length;
  document.getElementById("stReady").textContent = requests.filter(r=>r.status==="Ready").length;
  document.getElementById("stDone").textContent = requests.filter(r=>r.status==="Collected").length;

  const wrap = document.getElementById("reqTableWrap");

  if (!requests.length){
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="u-icon">📭</div>
        <p><strong>No requests yet.</strong><br>Submit a print/xerox file or a service request to see it here.</p>
      </div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Token</th><th>Service</th><th>Files</th><th>Submitted</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${requests.map(r => `
            <tr>
              <td><strong style="font-family:var(--font-mono)">${r.token}</strong></td>
              <td>${r.service}${r.printType? ` <span style="color:var(--ink-soft)">· ${r.printType}</span>`:""}</td>
              <td>${(r.files||[]).map(f=>`<button class="icon-btn" data-file="${f.key}" data-name="${escAttr(f.name)}" title="Download ${escAttr(f.name)}">⬇ ${truncate(f.name,16)}</button>`).join(" ") || "—"}</td>
              <td>${KWO.fmtDate(r.createdAt)}</td>
              <td><span class="badge ${STATUS_BADGE[r.status]||''}">${r.status}</span></td>
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
}

function truncate(s,n){ return s.length > n ? s.slice(0,n-1)+"…" : s; }
function escAttr(s){ return s.replace(/"/g,"&quot;"); }
