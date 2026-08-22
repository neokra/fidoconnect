/**
 * FidoConnect - Firebase Authentication & Session Service
 * 
 * Supports Email/Password, Google Sign-In, and strict Administrator verification for:
 * thecard.primary@gmail.com
 */

const ADMIN_EMAIL = "thecard.primary@gmail.com";

// Helper to wait until Firebase is initialized
const getAuthServices = async () => {
  if (window.FidoFirebase && window.FidoFirebase.auth) {
    return {
      auth: window.FidoFirebase.auth,
      db: window.FidoFirebase.db,
      googleProvider: window.FidoFirebase.googleProvider,
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
        googleProvider: window.FidoFirebase.googleProvider,
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

  // Check if an email is the designated FidoConnect Administrator
  isAdminEmail(email) {
    if (!email) return false;
    return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
  },

  isAdmin() {
    return this._cachedUserProfile && this.isAdminEmail(this._cachedUserProfile.email);
  },

  // Initialize Auth State Listener
  async init() {
    const { auth, db, authMethods, fs } = await getAuthServices();

    authMethods.onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch user profile from Firestore users/{uid}
          const userDocRef = fs.doc(db, "users", firebaseUser.uid);
          const userSnap = await fs.getDoc(userDocRef);

          const isUserAdmin = this.isAdminEmail(firebaseUser.email);

          if (userSnap.exists()) {
            const data = userSnap.data();
            this._cachedUserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL || data.photoURL || null,
              ...data,
              role: isUserAdmin ? "admin" : (data.role || "client"),
              isAdmin: isUserAdmin
            };
          } else {
            // If user signed in (e.g. via Google) and doc does not exist yet, provision profile
            const newUserData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email.toLowerCase(),
              name: firebaseUser.displayName || firebaseUser.email.split("@")[0],
              photoURL: firebaseUser.photoURL || null,
              role: isUserAdmin ? "admin" : "client",
              accountType: isUserAdmin ? "admin" : "client",
              phone: "",
              businessName: null,
              skills: [],
              portfolio: null,
              membershipStatus: "inactive",
              membershipPlan: "None",
              membershipStart: null,
              membershipExpiry: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            await fs.setDoc(userDocRef, newUserData);
            this._cachedUserProfile = {
              ...newUserData,
              isAdmin: isUserAdmin
            };
          }
        } catch (err) {
          console.error("Error syncing user profile from Firestore:", err);
          const isUserAdmin = this.isAdminEmail(firebaseUser.email);
          this._cachedUserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || "User",
            role: isUserAdmin ? "admin" : "client",
            isAdmin: isUserAdmin
          };
        }
      } else {
        this._cachedUserProfile = null;
      }

      this._authInitialized = true;
      this.updateNavUI();

      // Notify all registered listeners
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

  // 1. Google Sign-In
  async loginWithGoogle(intendedRole = "client") {
    const { auth, db, googleProvider, authMethods, fs } = await getAuthServices();

    const result = await authMethods.signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;
    const isUserAdmin = this.isAdminEmail(firebaseUser.email);

    // Check or create user profile in Firestore
    const userDocRef = fs.doc(db, "users", firebaseUser.uid);
    const userSnap = await fs.getDoc(userDocRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      this._cachedUserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL || data.photoURL || null,
        ...data,
        role: isUserAdmin ? "admin" : (data.role || "client"),
        isAdmin: isUserAdmin
      };
    } else {
      const selectedRole = isUserAdmin ? "admin" : (intendedRole === "freelancer" ? "freelancer" : "client");
      const newUserData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email.toLowerCase(),
        name: firebaseUser.displayName || firebaseUser.email.split("@")[0],
        photoURL: firebaseUser.photoURL || null,
        role: selectedRole,
        accountType: selectedRole,
        phone: "",
        businessName: selectedRole === "client" ? (firebaseUser.displayName || null) : null,
        skills: [],
        portfolio: null,
        membershipStatus: selectedRole === "freelancer" ? "inactive" : null,
        membershipPlan: selectedRole === "freelancer" ? "None" : null,
        membershipStart: null,
        membershipExpiry: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await fs.setDoc(userDocRef, newUserData);
      this._cachedUserProfile = {
        ...newUserData,
        isAdmin: isUserAdmin
      };
    }

    this.updateNavUI();
    return this._cachedUserProfile;
  },

  // 2. Email / Password Registration
  async register({ email, password, name, role, phone, businessName, skills, portfolio }) {
    if (!email || !password || !name) {
      throw new Error("Please provide your name, email, and password.");
    }

    const isUserAdmin = this.isAdminEmail(email);

    // Normal users can only register as client or freelancer
    if (!isUserAdmin && role !== "client" && role !== "freelancer") {
      throw new Error("Invalid account role selected.");
    }

    const finalRole = isUserAdmin ? "admin" : role;
    const { auth, db, authMethods, fs } = await getAuthServices();

    const userCredential = await authMethods.createUserWithEmailAndPassword(auth, email.trim(), password);
    const uid = userCredential.user.uid;

    const newUserData = {
      uid: uid,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      photoURL: null,
      phone: phone ? phone.trim() : "",
      role: finalRole,
      accountType: finalRole,
      businessName: finalRole === "client" ? (businessName ? businessName.trim() : name.trim()) : null,
      skills: finalRole === "freelancer" ? (skills || []) : [],
      portfolio: finalRole === "freelancer" ? (portfolio ? portfolio.trim() : "") : null,
      membershipStatus: finalRole === "freelancer" ? "inactive" : null,
      membershipPlan: finalRole === "freelancer" ? "None" : null,
      membershipStart: null,
      membershipExpiry: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const userDocRef = fs.doc(db, "users", uid);
    await fs.setDoc(userDocRef, newUserData);

    this._cachedUserProfile = {
      ...newUserData,
      isAdmin: isUserAdmin
    };
    this.updateNavUI();
    return this._cachedUserProfile;
  },

  // 3. Email / Password Login
  async login(email, password) {
    if (!email || !password) {
      throw new Error("Please enter your email and password.");
    }

    const { auth, db, authMethods, fs } = await getAuthServices();
    const userCredential = await authMethods.signInWithEmailAndPassword(auth, email.trim(), password);
    const uid = userCredential.user.uid;
    const isUserAdmin = this.isAdminEmail(userCredential.user.email);

    const userDocRef = fs.doc(db, "users", uid);
    const userSnap = await fs.getDoc(userDocRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      this._cachedUserProfile = {
        uid: uid,
        email: userCredential.user.email,
        photoURL: userCredential.user.photoURL || data.photoURL || null,
        ...data,
        role: isUserAdmin ? "admin" : (data.role || "client"),
        isAdmin: isUserAdmin
      };
    } else {
      this._cachedUserProfile = {
        uid: uid,
        email: userCredential.user.email,
        name: userCredential.user.displayName || "User",
        role: isUserAdmin ? "admin" : "client",
        isAdmin: isUserAdmin
      };
    }

    this.updateNavUI();
    return this._cachedUserProfile;
  },

  // 4. Sign Out
  async logout() {
    const { auth, authMethods } = await getAuthServices();
    await authMethods.signOut(auth);
    this._cachedUserProfile = null;
    this.updateNavUI();
    window.location.href = "index.html";
  },

  // 5. Password Reset
  async resetPassword(email) {
    if (!email) throw new Error("Please enter your email address.");
    const { auth, authMethods } = await getAuthServices();
    await authMethods.sendPasswordResetEmail(auth, email.trim());
    return true;
  },

  // Header UI Sync (Standard public navigation only - NO public admin buttons)
  updateNavUI() {
    const user = this.getCurrentUser();
    const authActionsContainer = document.getElementById("header-auth-actions");

    if (!authActionsContainer) return;

    if (user) {
      let roleLabel = user.role;
      if (user.role === "freelancer") {
        roleLabel = user.membershipStatus === "active" ? "Member" : "Freelancer";
      } else if (user.role === "admin") {
        roleLabel = "Admin";
      }

      authActionsContainer.innerHTML = `
        <a href="account.html" class="btn btn-secondary btn-sm" title="My Account">
          ${user.photoURL ? `<img src="${user.photoURL}" alt="" style="width:20px; height:20px; border-radius:50%; object-fit:cover;" />` : `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>`}
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
    
    // Strict admin guard: only thecard.primary@gmail.com
    if (allowedRoles.includes("admin")) {
      if (!this.isAdminEmail(user.email)) {
        if (typeof showToast === "function") {
          showToast("Access restricted.", "error");
        }
        window.location.href = "account.html";
        return false;
      }
      return true;
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
FidoAuth.init();

export default FidoAuth;
