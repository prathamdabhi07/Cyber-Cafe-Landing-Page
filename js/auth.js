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
    loginForm.addEventListener("submit", (e)=>{
      e.preventDefault();
      const msg = document.getElementById("loginMsg");
      const mobile = loginForm.mobile.value.trim();
      const password = loginForm.password.value;

      if (!KWO.validMobile(mobile)){
        show(msg, "Enter a valid 10-digit mobile number.", "err"); return;
      }
      const res = KWO.loginUser({ mobile, password });
      if (!res.ok){ show(msg, res.error, "err"); return; }

      show(msg, "Login successful — redirecting…", "ok");
      setTimeout(()=> window.location.href = "dashboard.html", 500);
    });
  }

  const registerForm = document.getElementById("registerForm");
  if (registerForm){
    registerForm.addEventListener("submit", (e)=>{
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

      const res = KWO.registerUser({ name, mobile, email, password });
      if (!res.ok){ show(msg, res.error, "err"); return; }

      KWO.loginUser({ mobile, password });
      show(msg, "Account created — redirecting to your dashboard…", "ok");
      setTimeout(()=> window.location.href = "dashboard.html", 600);
    });
  }

  function show(el, text, type){
    el.textContent = text;
    el.className = `form-msg show ${type}`;
  }
});
