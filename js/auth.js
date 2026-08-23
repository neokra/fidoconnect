/**
 * FidoConnect - Firebase Authentication Service
 * 
 * Direct Firebase Auth integration: Email/Password, Google Sign-In,
 * Password Reset, Session Listener, Required Profile Validation,
 * Freelancer Invite Verification, and Administrator identity checks.
 */

import { auth, db, googleProvider } from "./firebase-config.js";
import { FidoDB } from "./db.js";
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
  setDoc,
  updateDoc
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

  // Required profile fields: Full Name, Email, Phone, Business / Organization Name, and Role
  isProfileComplete(user) {
    if (!user) return false;
    if (this.isAdminEmail(user.email)) return true;
    const hasName = Boolean(user.name && user.name.trim().length > 0);
    const hasEmail = Boolean(user.email && user.email.trim().length > 0);
    const hasPhone = Boolean(user.phone && user.phone.trim().length > 0);
    const hasBusiness = Boolean(user.businessName && user.businessName.trim().length > 0);
    const hasValidRole = Boolean(user.role && (user.role === "client" || (user.role === "freelancer" && user.inviteVerified === true)));
    return hasName && hasEmail && hasPhone && hasBusiness && hasValidRole;
  }

  // Check if freelancer has verified invite access
  isFreelancerVerified(user) {
    if (!user) return false;
    if (this.isAdminEmail(user.email)) return true;
    if (user.role !== "freelancer") return true;
    return user.inviteVerified === true;
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
              inviteVerified: isUserAdmin ? true : (data.inviteVerified === true),
              inviteCodeId: data.inviteCodeId || null,
              ...data,
              role: isUserAdmin ? "admin" : (data.role || null),
              isAdmin: isUserAdmin
            };
          } else {
            // Registration and Google sign-in own first-time profile creation.
            // Do not write here: this listener can run concurrently with those
            // flows and turn an initial create into a conflicting update.
            this._currentUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName || "",
              photoURL: firebaseUser.photoURL || null,
              role: isUserAdmin ? "admin" : null,
              inviteVerified: isUserAdmin,
              inviteCodeId: null,
              isAdmin: isUserAdmin
            };
          }
        } catch (err) {
          console.error("Error fetching Firestore user profile:", err);
          this._currentUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || "",
            role: isUserAdmin ? "admin" : null,
            inviteVerified: isUserAdmin ? true : false,
            inviteCodeId: null,
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

  // Intercept clicks on protected links for logged-out or incomplete-profile visitors
  _setupProtectedNavigation() {
    document.addEventListener("click", async (e) => {
      const link = e.target.closest("a, button[data-href]");
      if (!link) return;

      const href = link.getAttribute("href") || link.getAttribute("data-href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      const protectedPages = ["post-work.html", "find-work.html", "project-details.html", "account.html", "admin.html"];
      const isProtected = protectedPages.some(page => href.split("?")[0].endsWith(page) || href.startsWith(page));

      if (isProtected) {
        if (this._authReady && this._currentUser && this.isProfileComplete(this._currentUser)) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        const user = await this.waitForAuth();
        if (!user) {
          if (typeof showToast === "function") {
            showToast("Please log in first", "info");
          }
          setTimeout(() => {
            window.location.href = `auth.html?redirect=${encodeURIComponent(href)}`;
          }, 300);
        } else if (!this.isProfileComplete(user)) {
          if (typeof showToast === "function") {
            showToast("Please complete your profile to continue", "info");
          }
          setTimeout(() => {
            window.location.href = `auth.html?redirect=${encodeURIComponent(href)}&complete_profile=true`;
          }, 300);
        } else {
          window.location.href = href;
        }
      }
    }, true);
  }

  // 1. Google Sign-In
  async loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;
    await firebaseUser.getIdToken();
    const isUserAdmin = this.isAdminEmail(firebaseUser.email);

    const userDocRef = doc(db, "users", firebaseUser.uid);
    const snap = await getDoc(userDocRef);

    if (snap.exists()) {
      const data = snap.data();
      this._currentUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL || data.photoURL || null,
        inviteVerified: isUserAdmin ? true : (data.inviteVerified === true),
        inviteCodeId: data.inviteCodeId || null,
        ...data,
        role: isUserAdmin ? "admin" : (data.role || null),
        isAdmin: isUserAdmin
      };
    } else {
      const newUserData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email.toLowerCase(),
        name: firebaseUser.displayName || "",
        photoURL: firebaseUser.photoURL || null,
        role: isUserAdmin ? "admin" : null,
        accountType: isUserAdmin ? "admin" : null,
        phone: "",
        businessName: "",
        inviteVerified: isUserAdmin ? true : false,
        inviteCodeId: null,
        skills: [],
        portfolio: null,
        membershipStatus: null,
        membershipPlan: null,
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
  async register({ email, password, name, phone = "", businessName = "" }) {
    if (!email || !password || !name) {
      throw new Error("Please enter your name, email, and password.");
    }
    if (!phone || !phone.trim()) {
      throw new Error("Please enter your WhatsApp / phone number.");
    }

    const isUserAdmin = this.isAdminEmail(email);
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await cred.user.getIdToken();
    const uid = cred.user.uid;

    const newUserData = {
      uid: uid,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      photoURL: null,
      phone: phone.trim(),
      role: isUserAdmin ? "admin" : null,
      accountType: isUserAdmin ? "admin" : null,
      businessName: businessName ? businessName.trim() : "",
      inviteVerified: isUserAdmin ? true : false,
      inviteCodeId: null,
      skills: [],
      portfolio: null,
      membershipStatus: null,
      membershipPlan: null,
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
        inviteVerified: isUserAdmin ? true : (data.inviteVerified === true),
        inviteCodeId: data.inviteCodeId || null,
        ...data,
        role: isUserAdmin ? "admin" : (data.role || "client"),
        isAdmin: isUserAdmin
      };
    } else {
      this._currentUser = {
        uid: uid,
        email: cred.user.email,
        name: cred.user.displayName || "",
        role: isUserAdmin ? "admin" : "client",
        inviteVerified: isUserAdmin ? true : false,
        inviteCodeId: null,
        isAdmin: isUserAdmin
      };
    }

    this.updateNavUI();
    return this._currentUser;
  }

  // 4. Update User Profile (Mandatory profile completion or updates)
  async updateUserProfile(uid, profileData) {
    if (!uid) throw new Error("User ID is required.");
    const userDocRef = doc(db, "users", uid);
    
    const updatePayload = {
      ...profileData,
      updatedAt: new Date().toISOString()
    };

    await setDoc(userDocRef, updatePayload, { merge: true });

    if (this._currentUser && this._currentUser.uid === uid) {
      this._currentUser = {
        ...this._currentUser,
        ...updatePayload
      };
    }

    this.updateNavUI();
    this._listeners.forEach(cb => {
      try { cb(this._currentUser); } catch (e) { console.error(e); }
    });

    return this._currentUser;
  }

  // 5. Verify and Redeem Freelancer Invite Code
  async verifyFreelancerInvite(codeStr) {
    if (!this._currentUser) {
      throw new Error("You must be logged in to verify an invite code.");
    }
    const cleanCode = (codeStr || "").trim().toUpperCase();
    if (!cleanCode) {
      throw new Error("Please enter an invite code.");
    }

    const validCodeDoc = await FidoDB.validateInviteCode(cleanCode);
    await FidoDB.claimInviteCode(validCodeDoc.code, this._currentUser.uid, this._currentUser.email);

    const userDocRef = doc(db, "users", this._currentUser.uid);
    await updateDoc(userDocRef, {
      inviteVerified: true,
      inviteCodeId: validCodeDoc.id,
      updatedAt: new Date().toISOString()
    });

    this._currentUser.inviteVerified = true;
    this._currentUser.inviteCodeId = validCodeDoc.id;

    this.updateNavUI();
    this._listeners.forEach(cb => {
      try { cb(this._currentUser); } catch (e) { console.error(e); }
    });

    return validCodeDoc;
  }

  // 6. Logout
  async logout() {
    await signOut(auth);
    this._currentUser = null;
    this.updateNavUI();
    window.location.href = "index.html";
  }

  // 7. Password Reset
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
        roleLabel = user.inviteVerified ? "Verified Freelancer" : (user.membershipStatus === "active" ? "Member" : "Freelancer");
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

    // Check mandatory profile completion
    if (!this.isProfileComplete(user)) {
      const currentTarget = window.location.pathname.split("/").pop() + window.location.search;
      const targetUrl = currentTarget || "account.html";
      window.location.href = `auth.html?redirect=${encodeURIComponent(targetUrl)}&complete_profile=true`;
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
