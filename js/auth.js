/**
 * FidoConnect - Firebase Authentication Service
 * 
 * Direct Firebase Auth integration: Email/Password, Google Sign-In,
 * Password Reset, Session Listener, and Administrator identity checks.
 */

import { auth, db, googleProvider } from "./firebase-config.js";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  onAuthStateChanged,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, 
  getDoc, 
  setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_EMAIL = "thecard.primary@gmail.com";

class AuthService {
  constructor() {
    this._currentUser = null;
    this._authReady = false;
    this._listeners = [];
    this._initAuth();
    this._setupProtectedNavigation();
  }

  // Check if an email matches the designated administrator
  isAdminEmail(email) {
    if (!email) return false;
    return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
  }

  isAdmin() {
    return this._currentUser && this.isAdminEmail(this._currentUser.email);
  }

  getCurrentUser() {
    return this._currentUser;
  }

  // Promise that resolves once Firebase Auth verifies initial session
  async waitForAuth() {
    if (this._authReady) return this._currentUser;
    return new Promise((resolve) => {
      const unbind = this.onAuthChange((user) => {
        unbind();
        resolve(user);
      });
    });
  }

  onAuthChange(callback) {
    if (typeof callback === "function") {
      this._listeners.push(callback);
      if (this._authReady) {
        callback(this._currentUser);
      }
      return () => {
        this._listeners = this._listeners.filter(cb => cb !== callback);
      };
    }
    return () => {};
  }

  _initAuth() {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const isUserAdmin = this.isAdminEmail(firebaseUser.email);
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const snap = await getDoc(userDocRef);

          if (snap.exists()) {
            const data = snap.data();
            this._currentUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL || data.photoURL || null,
              ...data,
              role: isUserAdmin ? "admin" : (data.role || "client"),
              isAdmin: isUserAdmin
            };
          } else {
            // First time sign-in (e.g. via Google), create profile
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
            await setDoc(userDocRef, newUserData);
            this._currentUser = {
              ...newUserData,
              isAdmin: isUserAdmin
            };
          }
        } catch (err) {
          console.error("Error fetching Firestore user profile:", err);
          this._currentUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || "User",
            role: isUserAdmin ? "admin" : "client",
            isAdmin: isUserAdmin
          };
        }
      } else {
        this._currentUser = null;
      }

      this._authReady = true;
      this.updateNavUI();

      this._listeners.forEach(cb => {
        try { cb(this._currentUser); } catch (e) { console.error(e); }
      });
    });
  }

  // Intercept clicks on protected links for logged-out visitors
  _setupProtectedNavigation() {
    document.addEventListener("click", (e) => {
      const link = e.target.closest("a");
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      const protectedPages = ["post-work.html", "find-work.html", "project-details.html", "account.html", "admin.html"];
      const isProtected = protectedPages.some(page => href.split("?")[0].endsWith(page) || href.startsWith(page));

      if (isProtected) {
        const user = this.getCurrentUser();
        if (this._authReady && !user) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof showToast === "function") {
            showToast("Please log in first", "info");
          }
          setTimeout(() => {
            window.location.href = `auth.html?redirect=${encodeURIComponent(href)}`;
          }, 300);
        }
      }
    }, true);
  }

  // 1. Google Sign-In
  async loginWithGoogle(intendedRole = "client") {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;
    const isUserAdmin = this.isAdminEmail(firebaseUser.email);

    const userDocRef = doc(db, "users", firebaseUser.uid);
    const snap = await getDoc(userDocRef);

    if (snap.exists()) {
      const data = snap.data();
      this._currentUser = {
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

      await setDoc(userDocRef, newUserData);
      this._currentUser = {
        ...newUserData,
        isAdmin: isUserAdmin
      };
    }

    this.updateNavUI();
    return this._currentUser;
  }

  // 2. Email / Password Registration
  async register({ email, password, name, role = "client", phone = "", businessName = "", skills = [], portfolio = "" }) {
    if (!email || !password || !name) {
      throw new Error("Please enter your name, email, and password.");
    }

    const isUserAdmin = this.isAdminEmail(email);

    if (!isUserAdmin && role !== "client" && role !== "freelancer") {
      throw new Error("Invalid account type selected.");
    }

    const finalRole = isUserAdmin ? "admin" : role;
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const uid = cred.user.uid;

    const newUserData = {
      uid: uid,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      photoURL: null,
      phone: phone ? phone.trim() : "",
      role: finalRole,
      accountType: finalRole,
      businessName: finalRole === "client" ? (businessName ? businessName.trim() : name.trim()) : null,
      skills: finalRole === "freelancer" ? skills : [],
      portfolio: finalRole === "freelancer" ? portfolio.trim() : null,
      membershipStatus: finalRole === "freelancer" ? "inactive" : null,
      membershipPlan: finalRole === "freelancer" ? "None" : null,
      membershipStart: null,
      membershipExpiry: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const userDocRef = doc(db, "users", uid);
    await setDoc(userDocRef, newUserData);

    this._currentUser = {
      ...newUserData,
      isAdmin: isUserAdmin
    };
    this.updateNavUI();
    return this._currentUser;
  }

  // 3. Email / Password Login
  async login(email, password) {
    if (!email || !password) {
      throw new Error("Please enter your email and password.");
    }

    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const uid = cred.user.uid;
    const isUserAdmin = this.isAdminEmail(cred.user.email);

    const userDocRef = doc(db, "users", uid);
    const snap = await getDoc(userDocRef);

    if (snap.exists()) {
      const data = snap.data();
      this._currentUser = {
        uid: uid,
        email: cred.user.email,
        photoURL: cred.user.photoURL || data.photoURL || null,
        ...data,
        role: isUserAdmin ? "admin" : (data.role || "client"),
        isAdmin: isUserAdmin
      };
    } else {
      this._currentUser = {
        uid: uid,
        email: cred.user.email,
        name: cred.user.displayName || "User",
        role: isUserAdmin ? "admin" : "client",
        isAdmin: isUserAdmin
      };
    }

    this.updateNavUI();
    return this._currentUser;
  }

  // 4. Logout
  async logout() {
    await signOut(auth);
    this._currentUser = null;
    this.updateNavUI();
    window.location.href = "index.html";
  }

  // 5. Password Reset
  async resetPassword(email) {
    if (!email) throw new Error("Please enter your email address.");
    await sendPasswordResetEmail(auth, email.trim());
    return true;
  }

  // Header Nav State Update
  updateNavUI() {
    const user = this.getCurrentUser();
    const container = document.getElementById("header-auth-actions");
    if (!container) return;

    if (user) {
      let roleLabel = user.role;
      if (user.role === "freelancer") {
        roleLabel = user.membershipStatus === "active" ? "Member" : "Freelancer";
      } else if (user.role === "admin") {
        roleLabel = "Admin";
      }

      container.innerHTML = `
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
      container.innerHTML = `
        <a href="auth.html" class="btn btn-secondary btn-sm">Log in</a>
        <a href="auth.html?mode=register" class="btn btn-primary btn-sm">Join</a>
      `;
    }
  }

  // Page Access Guard
  async requireAuth(allowedRoles = []) {
    const user = await this.waitForAuth();
    if (!user) {
      const currentTarget = window.location.pathname.split("/").pop() + window.location.search;
      const targetUrl = currentTarget || "account.html";
      window.location.href = `auth.html?redirect=${encodeURIComponent(targetUrl)}`;
      return false;
    }

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
        showToast("Access not permitted.", "error");
      }
      window.location.href = "index.html";
      return false;
    }

    return true;
  }
}

export const FidoAuth = new AuthService();
window.FidoAuth = FidoAuth;
export default FidoAuth;
