/**
 * FidoConnect - Auth Page Controller (Login, Register, Forgot Password)
 */

let selectedRegisterRole = "client";

document.addEventListener("DOMContentLoaded", () => {
  setupAuthTabs();
  setupRoleSelector();
  setupFormSubmissions();

  // Check URL param mode
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("mode");
  const initialRole = urlParams.get("role");

  if (mode === "register") {
    document.getElementById("btn-tab-register").click();
  }

  if (initialRole === "freelancer") {
    selectRoleOption("freelancer");
  }
});

function setupAuthTabs() {
  const loginTabBtn = document.getElementById("btn-tab-login");
  const registerTabBtn = document.getElementById("btn-tab-register");
  const loginPane = document.getElementById("login-form-pane");
  const registerPane = document.getElementById("register-form-pane");

  loginTabBtn.addEventListener("click", () => {
    loginTabBtn.classList.add("active");
    registerTabBtn.classList.remove("active");
    loginPane.style.display = "block";
    registerPane.style.display = "none";
  });

  registerTabBtn.addEventListener("click", () => {
    registerTabBtn.classList.add("active");
    loginTabBtn.classList.remove("active");
    registerPane.style.display = "block";
    loginPane.style.display = "none";
  });
}

function setupRoleSelector() {
  const clientCard = document.getElementById("role-card-client");
  const freelancerCard = document.getElementById("role-card-freelancer");

  clientCard.addEventListener("click", () => selectRoleOption("client"));
  freelancerCard.addEventListener("click", () => selectRoleOption("freelancer"));
}

function selectRoleOption(role) {
  selectedRegisterRole = role;
  const clientCard = document.getElementById("role-card-client");
  const freelancerCard = document.getElementById("role-card-freelancer");
  const clientFields = document.getElementById("client-extra-fields");
  const freelancerFields = document.getElementById("freelancer-extra-fields");

  if (role === "client") {
    clientCard.classList.add("selected");
    freelancerCard.classList.remove("selected");
    if (clientFields) clientFields.style.display = "block";
    if (freelancerFields) freelancerFields.style.display = "none";
  } else {
    freelancerCard.classList.add("selected");
    clientCard.classList.remove("selected");
    if (clientFields) clientFields.style.display = "none";
    if (freelancerFields) freelancerFields.style.display = "block";
  }
}

function setupFormSubmissions() {
  // 1. Login Form
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;
      const submitBtn = document.getElementById("login-submit-btn");

      submitBtn.disabled = true;
      submitBtn.textContent = "Signing In...";

      try {
        await window.FidoAuth.login(email, password);
        showToast("Signed in successfully!", "success");

        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get("redirect") || "account.html";
        setTimeout(() => window.location.href = redirect, 400);

      } catch (err) {
        showToast(err.message || "Failed to sign in.", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign In";
      }
    });
  }

  // 2. Register Form
  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("regName").value.trim();
      const email = document.getElementById("regEmail").value.trim();
      const password = document.getElementById("regPassword").value;
      const phone = document.getElementById("regPhone").value.trim();
      const businessName = document.getElementById("regBusiness") ? document.getElementById("regBusiness").value.trim() : "";
      const portfolio = document.getElementById("regPortfolio") ? document.getElementById("regPortfolio").value.trim() : "";
      const skillsRaw = document.getElementById("regSkills") ? document.getElementById("regSkills").value.trim() : "";
      
      const skills = skillsRaw ? skillsRaw.split(",").map(s => s.trim()).filter(Boolean) : [];
      const submitBtn = document.getElementById("register-submit-btn");

      submitBtn.disabled = true;
      submitBtn.textContent = "Creating Account...";

      try {
        await window.FidoAuth.register({
          name,
          email,
          password,
          role: selectedRegisterRole,
          phone,
          businessName,
          portfolio,
          skills
        });

        showToast("Account created successfully!", "success");
        setTimeout(() => window.location.href = "account.html", 400);

      } catch (err) {
        showToast(err.message || "Registration failed.", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Create Account";
      }
    });
  }

  // 3. Forgot Password Form
  const forgotForm = document.getElementById("forgot-password-form");
  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("resetEmail").value.trim();
      try {
        await window.FidoAuth.resetPassword(email);
        closeModal("forgot-password-modal");
        showToast("Password reset instructions sent to your email.", "success");
      } catch (err) {
        showToast(err.message || "Error sending reset link.", "error");
      }
    });
  }
}
