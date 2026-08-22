/**
 * FidoConnect - Firebase Authentication & Session Service
 * 
 * Direct integration with Firebase Authentication and Firestore User Profiles.
 */

// Helper to wait until Firebase is initialized
const getAuthServices = async () => {
  if (window.FidoFirebase && window.FidoFirebase.auth) {
    return {
      auth: window.FidoFirebase.auth,
      db: window.FidoFirebase.db,
      authMethods: window.FidoFirebase.authMethods,
      fs: window.FidoFirebase.firestore
    };
  }

  return new Promise((resolve) => {
    const handler = (e) => {
      window.removeEventListener("firebase-initialized", handler);
      resolve({
        auth: e.detail.auth,
        db: e.detail.db,
        authMethods: window.FidoFirebase.authMethods,
        fs: window.FidoFirebase.firestore
      });
    };
    window.addEventListener("firebase-initialized", handler);
  });
};

const FidoAuth = {
  _cachedUserProfile: null,
  _authInitialized: false,
  _authListeners: [],

  // Initialize Auth State Listener
  async init() {
    const { auth, db, authMethods, fs } = await getAuthServices();

    authMethods.onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch user profile from Firestore users/{uid}
          const userDocRef = fs.doc(db, "users", firebaseUser.uid);
          const userSnap = await fs.getDoc(userDocRef);

          if (userSnap.exists()) {
            this._cachedUserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              ...userSnap.data()
            };
          } else {
            // Profile fallback
            this._cachedUserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName || firebaseUser.email.split("@")[0],
              role: "client"
            };
          }
        } catch (err) {
          console.error("Error fetching user profile from Firestore:", err);
          this._cachedUserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || "User",
            role: "client"
          };
        }
      } else {
        this._cachedUserProfile = null;
      }

      this._authInitialized = true;
      this.updateNavUI();

      // Trigger all registered listeners
      this._authListeners.forEach(listener => {
        try { listener(this._cachedUserProfile); } catch (e) { console.error(e); }
      });
    });
  },

  // Wait until Firebase Auth has performed its initial state check
  async waitForAuth() {
    if (this._authInitialized) return this._cachedUserProfile;
    return new Promise((resolve) => {
      const listener = (user) => {
        this._authListeners = this._authListeners.filter(l => l !== listener);
        resolve(user);
      };
      this._authListeners.push(listener);
    });
  },

  onAuthChange(callback) {
    if (typeof callback === "function") {
      this._authListeners.push(callback);
      if (this._authInitialized) {
        callback(this._cachedUserProfile);
      }
    }
  },

  getCurrentUser() {
    return this._cachedUserProfile;
  },

  // Register New User (Client or Freelancer)
  async register({ email, password, name, role, phone, businessName, skills, portfolio }) {
    if (!email || !password || !name) {
      throw new Error("Please provide your name, email, and password.");
    }

    // Security: Never allow normal registration as admin
    if (role !== "client" && role !== "freelancer") {
      throw new Error("Invalid account role selected.");
    }

    const { auth, db, authMethods, fs } = await getAuthServices();

    // Create Firebase Auth user
    const userCredential = await authMethods.createUserWithEmailAndPassword(auth, email.trim(), password);
    const uid = userCredential.user.uid;

    // Create User Document in Firestore
    const newUserData = {
      uid: uid,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      phone: phone ? phone.trim() : "",
      role: role,
      businessName: role === "client" ? (businessName ? businessName.trim() : name.trim()) : null,
      skills: role === "freelancer" ? (skills || []) : [],
      portfolio: role === "freelancer" ? (portfolio ? portfolio.trim() : "") : null,
      membershipStatus: role === "freelancer" ? "inactive" : null,
      membershipPlan: role === "freelancer" ? "None" : null,
      membershipStart: null,
      membershipExpiry: null,
      createdAt: new Date().toISOString()
    };

    const userDocRef = fs.doc(db, "users", uid);
    await fs.setDoc(userDocRef, newUserData);

    this._cachedUserProfile = newUserData;
    this.updateNavUI();
    return newUserData;
  },

  // Login with Email & Password
  async login(email, password) {
    if (!email || !password) {
      throw new Error("Please enter your email and password.");
    }

    const { auth, db, authMethods, fs } = await getAuthServices();
    const userCredential = await authMethods.signInWithEmailAndPassword(auth, email.trim(), password);
    const uid = userCredential.user.uid;

    const userDocRef = fs.doc(db, "users", uid);
    const userSnap = await fs.getDoc(userDocRef);

    if (userSnap.exists()) {
      this._cachedUserProfile = {
        uid: uid,
        email: userCredential.user.email,
        ...userSnap.data()
      };
    } else {
      this._cachedUserProfile = {
        uid: uid,
        email: userCredential.user.email,
        name: userCredential.user.displayName || "User",
        role: "client"
      };
    }

    this.updateNavUI();
    return this._cachedUserProfile;
  },

  // Sign Out
  async logout() {
    const { auth, authMethods } = await getAuthServices();
    await authMethods.signOut(auth);
    this._cachedUserProfile = null;
    this.updateNavUI();
    window.location.href = "index.html";
  },

  // Send Password Reset Email
  async resetPassword(email) {
    if (!email) throw new Error("Please enter your email address.");
    const { auth, authMethods } = await getAuthServices();
    await authMethods.sendPasswordResetEmail(auth, email.trim());
    return true;
  },

  // Dynamic Header Navigation Updater
  updateNavUI() {
    const user = this.getCurrentUser();
    const authActionsContainer = document.getElementById("header-auth-actions");
    const adminNavLink = document.getElementById("nav-admin-link");

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
          <span>${(user.name || "Account").split(" ")[0]}</span>
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
  async requireAuth(allowedRoles = []) {
    const user = await this.waitForAuth();
    if (!user) {
      window.location.href = `auth.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      return false;
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      if (typeof showToast === "function") {
        showToast("You do not have permission to view this section.", "error");
      }
      window.location.href = "index.html";
      return false;
    }
    return true;
  }
};

window.FidoAuth = FidoAuth;

// Initialize on load
FidoAuth.init();

export default FidoAuth;
