/**
 * FidoConnect - Authentication & Session Service
 */

const FidoAuth = {
  // Get Current Authenticated User from session/local storage
  getCurrentUser() {
    try {
      const data = localStorage.getItem(window.FidoFirebase.storageKeys.CURRENT_USER);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem(window.FidoFirebase.storageKeys.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(window.FidoFirebase.storageKeys.CURRENT_USER);
    }
    this.updateNavUI();
  },

  // Register New User (Client or Freelancer only)
  async register({ email, password, name, role, phone, businessName, skills, portfolio }) {
    if (!email || !password || !name) {
      throw new Error("Please provide your name, email, and password.");
    }

    // Security check: Never allow normal registration as admin
    if (role !== "client" && role !== "freelancer") {
      throw new Error("Invalid account role selected.");
    }

    const users = window.FidoDB._getCollection(window.FidoFirebase.storageKeys.USERS);
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new Error("An account with this email already exists. Please log in.");
    }

    const newUid = `usr_${Date.now()}`;
    const newUser = {
      uid: newUid,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      phone: phone || "",
      role: role, // 'client' or 'freelancer'
      businessName: role === "client" ? (businessName || name) : null,
      skills: role === "freelancer" ? (skills || []) : [],
      portfolio: role === "freelancer" ? (portfolio || "") : null,
      membershipStatus: role === "freelancer" ? "inactive" : null,
      membershipPlan: role === "freelancer" ? "None" : null,
      membershipStart: null,
      membershipExpiry: null,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    window.FidoDB._setCollection(window.FidoFirebase.storageKeys.USERS, users);
    this.setCurrentUser(newUser);

    return newUser;
  },

  // Login with Email & Password
  async login(email, password) {
    if (!email || !password) {
      throw new Error("Please enter your email and password.");
    }

    const users = window.FidoDB._getCollection(window.FidoFirebase.storageKeys.USERS);
    const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

    if (!user) {
      throw new Error("No account found with this email address.");
    }

    this.setCurrentUser(user);
    return user;
  },

  // Logout
  async logout() {
    this.setCurrentUser(null);
    window.location.href = "index.html";
  },

  // Password Reset
  async resetPassword(email) {
    if (!email) throw new Error("Please enter your email address.");
    return true;
  },

  // Dynamic Navigation Bar Updater
  updateNavUI() {
    const user = this.getCurrentUser();
    const authActionsContainer = document.getElementById("header-auth-actions");
    const adminNavLink = document.getElementById("nav-admin-link");

    // Show/hide admin link
    if (adminNavLink) {
      adminNavLink.style.display = (user && user.role === "admin") ? "block" : "none";
    }

    if (!authActionsContainer) return;

    if (user) {
      let roleLabel = user.role;
      if (user.role === "freelancer") {
        roleLabel = user.membershipStatus === "active" ? "Member" : "Freelancer";
      }

      authActionsContainer.innerHTML = `
        <a href="account.html" class="btn btn-secondary btn-sm" title="My Account">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          <span>${user.name.split(" ")[0]}</span>
          <span class="brand-badge">${roleLabel}</span>
        </a>
        <button id="logout-btn" class="btn btn-secondary btn-sm" title="Sign Out">
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
        </button>
      `;

      const logoutBtn = document.getElementById("logout-btn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", () => this.logout());
      }
    } else {
      authActionsContainer.innerHTML = `
        <a href="auth.html" class="btn btn-secondary btn-sm">Log in</a>
        <a href="auth.html?mode=register" class="btn btn-primary btn-sm">Join</a>
      `;
    }
  },

  // Guard page access
  requireAuth(allowedRoles = []) {
    const user = this.getCurrentUser();
    if (!user) {
      window.location.href = `auth.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      return false;
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      showToast("You do not have permission to view this section.", "error");
      window.location.href = "index.html";
      return false;
    }
    return true;
  }
};

window.FidoAuth = FidoAuth;

// Auto-run UI sync on DOM load
document.addEventListener("DOMContentLoaded", () => {
  FidoAuth.updateNavUI();
});
