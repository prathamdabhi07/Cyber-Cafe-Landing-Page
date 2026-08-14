/* =========================================================
   auth.js — login.html + register.html logic
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  // if already logged in, bounce to dashboard
  if (KWO.currentUser() && (document.getElementById("loginForm") || document.getElementById("registerForm"))){
    window.location.href = "dashboard.html";
    return;
  }

  const loginForm = document.getElementById("loginForm");
  if (loginForm){
    loginForm.addEventListener("submit", async (e)=>{
      e.preventDefault();
      const msg = document.getElementById("loginMsg");
      const mobile = loginForm.mobile.value.trim();
      const password = loginForm.password.value;

      if (!KWO.validMobile(mobile)){
        show(msg, "Enter a valid 10-digit mobile number.", "err"); return;
      }

      const btn = loginForm.querySelector("button[type=submit]");
      if (btn){ btn.disabled = true; btn.textContent = "Signing in…"; }

      const res = await KWO.loginUser({ mobile, password });

      if (btn){ btn.disabled = false; btn.textContent = "Login"; }

      if (!res.ok){ show(msg, res.error, "err"); return; }

      show(msg, "Login successful — redirecting…", "ok");
      setTimeout(()=> window.location.href = "dashboard.html", 500);
    });
  }

  const registerForm = document.getElementById("registerForm");
  if (registerForm){
    registerForm.addEventListener("submit", async (e)=>{
      e.preventDefault();
      const msg = document.getElementById("registerMsg");
      const name = registerForm.name.value.trim();
      const mobile = registerForm.mobile.value.trim();
      const email = registerForm.email.value.trim();
      const password = registerForm.password.value;
      const confirm = registerForm.confirm.value;

      if (name.length < 3){ show(msg, "Please enter your full name.", "err"); return; }
      if (!KWO.validMobile(mobile)){ show(msg, "Enter a valid 10-digit mobile number.", "err"); return; }
      if (email && !KWO.validEmail(email)){ show(msg, "Enter a valid email address.", "err"); return; }
      if (password.length < 6){ show(msg, "Password must be at least 6 characters.", "err"); return; }
      if (password !== confirm){ show(msg, "Passwords do not match.", "err"); return; }

      const btn = registerForm.querySelector("button[type=submit]");
      if (btn){ btn.disabled = true; btn.textContent = "Creating account…"; }

      const res = await KWO.registerUser({ name, mobile, email, password });
      if (!res.ok){
        if (btn){ btn.disabled = false; btn.textContent = "Create account"; }
        show(msg, res.error, "err"); return;
      }

      await KWO.loginUser({ mobile, password });
      if (btn){ btn.disabled = false; btn.textContent = "Create account"; }
      show(msg, "Account created — redirecting to your dashboard…", "ok");
      setTimeout(()=> window.location.href = "dashboard.html", 600);
    });
  }

  function show(el, text, type){
    el.textContent = text;
    el.className = `form-msg show ${type}`;
  }
});
