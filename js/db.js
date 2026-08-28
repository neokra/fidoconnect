/**
 * FidoConnect - Firestore Database Service
 * 
 * Direct Cloud Firestore operations for projects, applications, users,
 * memberships, payments, reviews, messages, settings, and metrics.
 */

import { db } from "./firebase-config.js";
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  limit, 
  getDocs, 
  addDoc, 
  runTransaction 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const SKILL_TAXONOMY = {
  "Website": [
    "HTML/CSS",
    "JavaScript",
    "React",
    "WordPress",
    "Shopify",
    "Landing Pages",
    "Portfolio Websites",
    "Other"
  ],
  "Data Entry": [
    "Excel",
    "Google Sheets",
    "PDF to Excel",
    "Web Research",
    "Copy/Paste",
    "Data Cleaning",
    "Other"
  ],
  "Design": [
    "Logo Design",
    "Social Media Design",
    "UI Design",
    "Thumbnail Design",
    "Photoshop",
    "Canva",
    "Other"
  ],
  "Documents": [
    "Microsoft Word",
    "PowerPoint",
    "PDF Formatting",
    "Resume/CV",
    "Document Conversion",
    "Other"
  ],
  "Digital Marketing": [
    "Social Media",
    "SEO",
    "Content Writing",
    "Email Marketing",
    "Ads",
    "Other"
  ],
  "Other": [
    "Other"
  ]
};

export const DEFAULT_UPI_CONFIG = {
  upiId: "fidoconnect@okaxis",
  merchantName: "FidoConnect",
  qrAsset: "images/fido-upi-qr.svg"
};

export const MEMBERSHIP_PLANS = {
  basic: {
    id: "basic",
    name: "Selected Basic",
    price: 499,
    priceAmount: 499,
    priceDisplay: "₹499",
    duration: "1 Month",
    durationDays: 30,
    billingCycle: "/ month",
    badge: "Recommended for New Members",
    isRecommended: true,
    tagline: "Start here",
    description: "For freelancers starting with FidoConnect and looking for selected small projects that match their verified skills.",
    features: [
      "Access to selected FidoConnect project opportunities",
      "Apply to matching projects",
      "One active application at a time",
      "Up to 1–2 selected project opportunities during the membership period",
      "Verified freelancer profile",
      "Skill-matched project access",
      "FidoConnect project coordination",
      "Project performance record"
    ],
    qrImageUrl: "images/fido-upi-qr.svg",
    upiId: "fidoconnect@okaxis",
    merchantName: "FidoConnect",
    buttonText: "Choose Basic",
    published: true,
    sortOrder: 1
  },
  pro: {
    id: "pro",
    name: "Selected Pro",
    price: 1999,
    priceAmount: 1999,
    priceDisplay: "₹1,999",
    duration: "1 Month",
    durationDays: 30,
    billingCycle: "/ month",
    badge: "",
    isRecommended: false,
    tagline: "For active freelancers",
    description: "For freelancers ready to take on more selected opportunities through FidoConnect.",
    features: [
      "Everything in Basic",
      "Higher project access",
      "Up to 5 selected project opportunities",
      "Priority consideration for suitable projects",
      "Multiple project opportunities during the membership period, subject to availability",
      "Enhanced freelancer profile",
      "Performance history",
      "Priority agency review"
    ],
    qrImageUrl: "images/fido-upi-qr.svg",
    upiId: "fidoconnect@okaxis",
    merchantName: "FidoConnect",
    buttonText: "Choose Pro",
    published: true,
    sortOrder: 2
  },
  premium: {
    id: "premium",
    name: "Selected Premium",
    price: 4999,
    priceAmount: 4999,
    priceDisplay: "₹4,999",
    duration: "1 Month",
    durationDays: 30,
    billingCycle: "/ month",
    badge: "",
    isRecommended: false,
    tagline: "For experienced freelancers",
    description: "For experienced verified freelancers who are ready for higher-value opportunities.",
    features: [
      "Everything in Pro",
      "Higher-value project opportunities",
      "Up to 10 selected project opportunities",
      "Priority access to suitable projects",
      "Priority agency consideration",
      "Enhanced profile visibility",
      "Advanced performance record",
      "Priority support/coordination",
      "Consideration for larger or more specialized projects"
    ],
    qrImageUrl: "images/fido-upi-qr.svg",
    upiId: "fidoconnect@okaxis",
    merchantName: "FidoConnect",
    buttonText: "Choose Premium",
    published: true,
    sortOrder: 3
  }
};

export const FidoDB = {
  SKILL_TAXONOMY,
  MEMBERSHIP_PLANS,
  DEFAULT_UPI_CONFIG,

  // --- Skill Matching & Profile Helpers ---
  checkProjectSkillMatch(project, user) {
    if (!project || !user) return false;
    if (window.FidoAuth && window.FidoAuth.isAdminEmail(user.email)) return true;
    if (user.role !== "freelancer") return false;

    const userCategories = Array.isArray(user.categories) ? user.categories : [];
    const projCategory = (project.category || "").trim().toLowerCase();
    
    // 1. Direct Category Match
    const categoryMatched = userCategories.some(cat => cat.trim().toLowerCase() === projCategory);
    if (categoryMatched) return true;

    // 2. Subcategory or Required Skills Match
    const userSubcategories = Array.isArray(user.subcategories) ? user.subcategories : [];
    const userSkills = Array.isArray(user.skills) ? user.skills : [];
    const customSkills = user.customSkills ? user.customSkills.split(",").map(s => s.trim().toLowerCase()) : [];
    const allUserSkills = [...userCategories, ...userSubcategories, ...userSkills, ...customSkills].map(s => s.trim().toLowerCase());

    const projSkills = Array.isArray(project.requiredSkills) ? project.requiredSkills : [];
    const projSubcategory = project.subcategory ? [project.subcategory] : [];
    const allProjRequirements = [project.category, ...projSkills, ...projSubcategory].filter(Boolean).map(s => s.trim().toLowerCase());

    return allProjRequirements.some(req => allUserSkills.includes(req));
  },

  async saveSkillProfile(uid, { categories = [], subcategories = [], bio = "", customSkills = "" }) {
    if (!uid) throw new Error("User ID is required.");
    const currentUser = window.FidoAuth ? window.FidoAuth.getCurrentUser() : null;
    if (!currentUser || (currentUser.uid !== uid && !window.FidoAuth.isAdmin())) {
      throw new Error("Unauthorized to edit this user's profile.");
    }

    const cleanCategories = Array.from(new Set(categories.map(c => c.trim()).filter(Boolean)));
    const cleanSubcategories = Array.from(new Set(subcategories.map(s => s.trim()).filter(Boolean)));
    const cleanCustom = customSkills ? customSkills.trim() : "";
    const customList = cleanCustom ? cleanCustom.split(",").map(s => s.trim()).filter(Boolean) : [];
    const combinedSkills = Array.from(new Set([...cleanCategories, ...cleanSubcategories, ...customList]));

    const profileUpdates = {
      userId: uid,
      categories: cleanCategories,
      subcategories: cleanSubcategories,
      bio: bio ? bio.trim() : "",
      customSkills: cleanCustom,
      skills: combinedSkills,
      profileCompleted: true,
      updatedAt: new Date().toISOString()
    };

    return this.updateUser(uid, profileUpdates);
  },

  async getSkillProfile(uid) {
    const user = await this.getUserById(uid);
    if (!user) return null;
    return {
      categories: user.categories || [],
      subcategories: user.subcategories || [],
      bio: user.bio || "",
      customSkills: user.customSkills || "",
      profileCompleted: Boolean(user.profileCompleted)
    };
  },

  // --- 1. Projects ---
  async getPublicProjects(filter = {}) {
    const publicRef = collection(db, "publicProjects");
    const snapshot = await getDocs(publicRef);
    let projects = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const proj = { id: docSnap.id, ...data };

      if (filter.category && filter.category !== "all" && proj.category !== filter.category) {
        return;
      }

      if (filter.search) {
        const queryStr = filter.search.toLowerCase();
        const matchesTitle = (proj.title || "").toLowerCase().includes(queryStr);
        const matchesDesc = (proj.description || "").toLowerCase().includes(queryStr);
        const matchesCat = (proj.category || "").toLowerCase().includes(queryStr);
        const matchesId = (proj.projectId || "").toLowerCase().includes(queryStr);
        if (!matchesTitle && !matchesDesc && !matchesCat && !matchesId) return;
      }

      projects.push(proj);
    });

    projects.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return projects;
  },

  async getProjects(filter = {}) {
    const projectsRef = collection(db, "projects");
    let constraints = [];

    if (filter.status && filter.status !== "all") {
      constraints.push(where("status", "==", filter.status));
    }
    if (filter.clientId) {
      constraints.push(where("clientId", "==", filter.clientId));
    }
    if (filter.assignedFreelancerId) {
      constraints.push(where("assignedFreelancerId", "==", filter.assignedFreelancerId));
    }
    if (filter.visibility) {
      constraints.push(where("visibility", "==", filter.visibility));
    }

    const q = constraints.length > 0 ? query(projectsRef, ...constraints) : query(projectsRef);
    const snapshot = await getDocs(q);
    let projects = [];

    const currentUser = window.FidoAuth ? window.FidoAuth.getCurrentUser() : null;
    const isAdmin = window.FidoAuth ? window.FidoAuth.isAdmin() : false;

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const proj = { id: docSnap.id, ...data };

      if (filter.category && filter.category !== "all" && proj.category !== filter.category) {
        return;
      }

      if (filter.search) {
        const queryStr = filter.search.toLowerCase();
        const matchesTitle = (proj.title || "").toLowerCase().includes(queryStr);
        const matchesDesc = (proj.description || "").toLowerCase().includes(queryStr);
        const matchesCat = (proj.category || "").toLowerCase().includes(queryStr);
        const matchesId = (proj.projectId || "").toLowerCase().includes(queryStr);
        if (!matchesTitle && !matchesDesc && !matchesCat && !matchesId) return;
      }

      // Client Privacy Safeguard
      const isOwner = currentUser && proj.clientId === currentUser.uid;
      if (!isAdmin && !isOwner) {
        delete proj.clientEmail;
        delete proj.clientPhone;
        delete proj.clientAddress;
        delete proj.privateContactDetails;
      }

      projects.push(proj);
    });

    projects.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return projects;
  },

  async getProjectById(projectId) {
    try {
      const docRef = doc(db, "projects", projectId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const proj = { id: docSnap.id, ...docSnap.data() };
        const currentUser = window.FidoAuth ? window.FidoAuth.getCurrentUser() : null;
        const isAdmin = window.FidoAuth ? window.FidoAuth.isAdmin() : false;
        const isOwner = currentUser && proj.clientId === currentUser.uid;

        if (!isAdmin && !isOwner) {
          delete proj.clientEmail;
          delete proj.clientPhone;
          delete proj.clientAddress;
          delete proj.privateContactDetails;
        }
        return proj;
      }
    } catch (err) {
      console.warn("Protected project read restricted, trying publicProjects:", err);
    }

    try {
      const pubDocRef = doc(db, "publicProjects", projectId);
      const pubDocSnap = await getDoc(pubDocRef);
      if (pubDocSnap.exists()) {
        return { id: pubDocSnap.id, ...pubDocSnap.data() };
      }
    } catch (e) {}

    return null;
  },

  async syncPublicProject(projectId, projectData) {
    try {
      const publicRef = doc(db, "publicProjects", projectId);
      if (projectData.status === "Published" || projectData.visibility === "public") {
        const publicData = {
          id: projectId,
          projectId: projectId,
          title: projectData.title,
          category: projectData.category || "Other",
          description: projectData.description || "",
          budget: projectData.budget || "To be discussed",
          deadline: projectData.deadline || "Flexible",
          status: projectData.status,
          customFields: Array.isArray(projectData.customFields) ? projectData.customFields : [],
          createdAt: projectData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(publicRef, publicData, { merge: true });
      } else {
        await deleteDoc(publicRef).catch(() => {});
      }
    } catch (err) {
      console.warn("syncPublicProject error:", err);
    }
  },

  async createProject(projectData) {
    const currentYear = new Date().getFullYear();
    const counterRef = doc(db, "counters", "project_counter");
    let uniqueProjectId = "";

    try {
      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let nextNumber = 1;

        if (counterDoc.exists()) {
          const data = counterDoc.data();
          if (data.year === currentYear && typeof data.lastNumber === "number") {
            nextNumber = data.lastNumber + 1;
          }
        }

        uniqueProjectId = `FC-${currentYear}-${String(nextNumber).padStart(4, "0")}`;
        transaction.set(counterRef, { year: currentYear, lastNumber: nextNumber }, { merge: true });
      });
    } catch (err) {
      const randomSuffix = String(Math.floor(1000 + Math.random() * 9000));
      uniqueProjectId = `FC-${currentYear}-${randomSuffix}`;
    }

    const newProject = {
      projectId: uniqueProjectId,
      title: projectData.title,
      category: projectData.category || "Other",
      description: projectData.description,
      requirements: projectData.requirements || "",
      budget: projectData.budget || "To be discussed",
      deadline: projectData.deadline || "Flexible",
      clientId: projectData.clientId || "anonymous",
      clientName: projectData.clientName || "Client Request",
      clientBusiness: projectData.clientBusiness || "Private Business",
      clientEmail: projectData.clientEmail || "",
      clientPhone: projectData.clientPhone || "",
      requiredSkills: projectData.requiredSkills || [projectData.category],
      status: "Submitted",
      visibility: "admin_only",
      assignedFreelancerId: null,
      agencyNotes: "Received new client submission. Pending review.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const projectDocRef = doc(db, "projects", uniqueProjectId);
    await setDoc(projectDocRef, newProject);

    return { id: uniqueProjectId, ...newProject };
  },

  async updateProject(projectId, updates) {
    const docRef = doc(db, "projects", projectId);
    const cleanUpdates = {
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await updateDoc(docRef, cleanUpdates);

    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        await this.syncPublicProject(projectId, snap.data());
      }
    } catch (err) {
      console.warn("Public project sync error:", err);
    }

    return { id: projectId, ...cleanUpdates };
  },

  async assignProject(projectId, freelancerId, appId = null, customNotes = "") {
    if (!projectId || !freelancerId) throw new Error("Project and Freelancer IDs are required.");
    const nowIso = new Date().toISOString();
    const cleanUpdates = {
      assignedFreelancerId: freelancerId,
      status: "In Progress",
      visibility: "admin_only",
      updatedAt: nowIso,
      agencyNotes: customNotes || `Freelancer assigned by agency on ${nowIso.slice(0, 10)}. Work is in progress.`
    };
    await this.updateProject(projectId, cleanUpdates);

    if (appId) {
      await this.updateApplication(appId, { status: "Selected" });
    }
    return { projectId, freelancerId, success: true };
  },

  async deassignProject(projectId, appId = null, customNotes = "") {
    if (!projectId) throw new Error("Project ID is required.");
    const nowIso = new Date().toISOString();
    const cleanUpdates = {
      assignedFreelancerId: null,
      status: "Submitted",
      visibility: "admin_only",
      updatedAt: nowIso,
      agencyNotes: customNotes || `Freelancer assignment removed by agency on ${nowIso.slice(0, 10)}. Status reset to Submitted.`
    };
    await this.updateProject(projectId, cleanUpdates);

    if (appId) {
      await this.updateApplication(appId, { status: "Submitted" });
    } else {
      // Also reset any application for this project that was 'Selected'
      try {
        const appsRef = collection(db, "applications");
        const q = query(appsRef, where("projectId", "==", projectId), where("status", "==", "Selected"));
        const snap = await getDocs(q);
        const batch = [];
        snap.forEach(d => {
          batch.push(updateDoc(doc(db, "applications", d.id), { status: "Submitted", updatedAt: nowIso }));
        });
        await Promise.all(batch);
      } catch (e) {
        console.warn("Reset selected apps error:", e);
      }
    }
    return { projectId, success: true };
  },

  async deleteProject(projectId) {
    const docRef = doc(db, "projects", projectId);
    await deleteDoc(docRef);
    return true;
  },

  // --- 2. Applications ---
  async getApplications(filter = {}) {
    const appsRef = collection(db, "applications");
    let constraints = [];
    if (filter.projectId) constraints.push(where("projectId", "==", filter.projectId));
    if (filter.freelancerId) constraints.push(where("freelancerId", "==", filter.freelancerId));
    if (filter.status) constraints.push(where("status", "==", filter.status));

    const q = constraints.length > 0 ? query(appsRef, ...constraints) : query(appsRef);
    const snapshot = await getDocs(q);

    let applications = [];
    snapshot.forEach(docSnap => {
      applications.push({ id: docSnap.id, ...docSnap.data() });
    });

    applications.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    // Deduplicate applications by (projectId + freelancerId) to protect against duplicate entries
    const seen = new Set();
    const uniqueApplications = [];
    for (const app of applications) {
      const key = `${app.projectId}_${app.freelancerId}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueApplications.push(app);
      }
    }

    return uniqueApplications;
  },

  async createApplication(appData) {
    if (!appData.projectId || !appData.freelancerId) {
      throw new Error("Project ID and Freelancer ID are required.");
    }

    // Deterministic document ID guarantees exact-one record per project + freelancer
    const appId = `${appData.projectId}_${appData.freelancerId}`;
    const docRef = doc(db, "applications", appId);
    const existingDoc = await getDoc(docRef);

    if (existingDoc.exists()) {
      const existingData = existingDoc.data();
      if (existingData.status !== "Withdrawn" && existingData.status !== "Rejected" && existingData.status !== "Cancelled") {
        throw new Error("You have already submitted an application for this project.");
      }
    }

    // Also check for legacy auto-id docs if any exist
    const appsRef = collection(db, "applications");
    const checkQuery = query(
      appsRef,
      where("projectId", "==", appData.projectId),
      where("freelancerId", "==", appData.freelancerId),
      limit(2)
    );
    const existingSnap = await getDocs(checkQuery);
    if (!existingSnap.empty) {
      const activeExisting = existingSnap.docs.find(d => {
        const data = d.data();
        return d.id !== appId && !["Withdrawn", "Rejected", "Cancelled"].includes(data.status);
      });
      if (activeExisting) {
        throw new Error("You have already submitted an application for this project.");
      }
    }

    const newApp = {
      projectId: appData.projectId,
      freelancerId: appData.freelancerId,
      freelancerName: appData.freelancerName,
      freelancerEmail: appData.freelancerEmail,
      skills: appData.skills || [],
      portfolio: appData.portfolio || "",
      message: appData.message,
      deliveryDays: appData.deliveryDays || "Not specified",
      status: "Submitted",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(docRef, newApp);
    return { id: appId, ...newApp };
  },

  async updateApplication(appId, updates) {
    const docRef = doc(db, "applications", appId);
    const cleanUpdates = {
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await updateDoc(docRef, cleanUpdates);
    return { id: appId, ...cleanUpdates };
  },

  async withdrawApplication(appId, freelancerId) {
    const docRef = doc(db, "applications", appId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("Application not found.");
    const data = snap.data();
    if (data.freelancerId !== freelancerId && (!window.FidoAuth || !window.FidoAuth.isAdmin())) {
      throw new Error("Unauthorized to withdraw this application.");
    }
    if (["Completed", "Cancelled", "Withdrawn"].includes(data.status)) {
      throw new Error("Application cannot be withdrawn in its current state.");
    }
    await updateDoc(docRef, {
      status: "Withdrawn",
      updatedAt: new Date().toISOString()
    });
    return { id: appId, status: "Withdrawn" };
  },

  async deleteApplication(appId) {
    if (!appId) throw new Error("Application ID is required.");
    const docRef = doc(db, "applications", appId);
    await deleteDoc(docRef);
    return { id: appId, deleted: true };
  },

  async markProjectApplicationsCompleted(projectId) {
    // Marks all applications for a given project as "Completed"
    if (!projectId) throw new Error("Project ID is required.");
    const appsRef = collection(db, "applications");
    const q = query(appsRef, where("projectId", "==", projectId));
    const snap = await getDocs(q);
    const nowIso = new Date().toISOString();
    const batch = [];
    snap.forEach(docSnap => {
      batch.push(updateDoc(doc(db, "applications", docSnap.id), {
        status: "Completed",
        completedAt: nowIso,
        updatedAt: nowIso
      }));
    });
    await Promise.all(batch);
    return { projectId, count: batch.length };
  },

  // --- 3. Users ---
  async getUsers(role = null) {
    const usersRef = collection(db, "users");
    const q = role ? query(usersRef, where("role", "==", role)) : query(usersRef);
    const snapshot = await getDocs(q);

    let users = [];
    snapshot.forEach(docSnap => {
      users.push({ uid: docSnap.id, ...docSnap.data() });
    });

    users.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return users;
  },

  async getUserById(uid) {
    if (!uid) return null;
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { uid: docSnap.id, ...docSnap.data() };
    }
    return null;
  },

  async updateUser(uid, updates) {
    const docRef = doc(db, "users", uid);
    const isAdmin = window.FidoAuth ? window.FidoAuth.isAdmin() : false;
    if (updates.role === "admin" && !isAdmin) {
      delete updates.role;
    }

    const cleanUpdates = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await updateDoc(docRef, cleanUpdates);

    const currentUser = window.FidoAuth ? window.FidoAuth.getCurrentUser() : null;
    if (currentUser && currentUser.uid === uid) {
      window.FidoAuth._currentUser = {
        ...currentUser,
        ...cleanUpdates
      };
      window.FidoAuth.updateNavUI();
    }

    return { uid, ...cleanUpdates };
  },

  async updateMembership(freelancerId, status, plan = "Active Member", durationDays = 30) {
    const startDate = status === "active" ? new Date().toISOString() : null;
    const expiryDate = status === "active" ? new Date(Date.now() + durationDays*24*60*60*1000).toISOString() : null;

    return this.updateUser(freelancerId, {
      membershipStatus: status,
      membershipPlan: plan,
      membershipStart: startDate,
      membershipExpiry: expiryDate
    });
  },

  async updateFreelancerMembershipMessage(freelancerId, { message, messageType = "custom", status = null, durationDays = null, plan = null }) {
    if (!freelancerId) throw new Error("Freelancer ID is required.");

    const nowIso = new Date().toISOString();
    const updates = {
      membershipMessage: String(message || "").trim(),
      membershipMessageType: messageType || "custom",
      membershipMessageDate: nowIso
    };

    if (status && status !== "keep") {
      updates.membershipStatus = status;
      if (status === "active") {
        updates.membershipStart = nowIso;
        if (durationDays) {
          updates.membershipExpiry = new Date(Date.now() + Number(durationDays) * 24 * 60 * 60 * 1000).toISOString();
        }
        if (plan) {
          updates.membershipPlan = plan;
        }
      }
    }

    return this.updateUser(freelancerId, updates);
  },

  async getUPIConfig() {
    try {
      const settings = await this.getSettings();
      return {
        upiId: settings.upiId || DEFAULT_UPI_CONFIG.upiId,
        merchantName: settings.agencyName || DEFAULT_UPI_CONFIG.merchantName,
        qrAsset: DEFAULT_UPI_CONFIG.qrAsset
      };
    } catch (e) {
      return DEFAULT_UPI_CONFIG;
    }
  },

  // Check if a transaction ID (UTR) already exists in payments collection
  async checkTransactionIdExists(transactionId) {
    if (!transactionId) return false;
    const cleanTxn = String(transactionId).trim();
    if (!cleanTxn) return false;

    const paymentsRef = collection(db, "payments");
    const q = query(paymentsRef, where("transactionId", "==", cleanTxn), limit(1));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  },

  // Get any pending membership payment for a specific user
  async getUserPendingMembershipPayment(userId) {
    if (!userId) return null;
    try {
      const paymentsRef = collection(db, "payments");
      const q = query(
        paymentsRef,
        where("userId", "==", userId),
        where("type", "==", "membership"),
        where("status", "==", "pending"),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (e) {
      console.warn("Could not check pending payment:", e);
      return null;
    }
  },

  // Get most recent membership payment for a specific user
  async getUserLatestMembershipPayment(userId) {
    if (!userId) return null;
    try {
      const paymentsRef = collection(db, "payments");
      const q = query(
        paymentsRef,
        where("userId", "==", userId),
        where("type", "==", "membership")
      );
      const snapshot = await getDocs(q);
      let list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return list.length > 0 ? list[0] : null;
    } catch (e) {
      console.warn("Could not get latest user membership payment:", e);
      return null;
    }
  },

  // =========================================================================
  // --- Membership Plans (Database-Driven) ---
  // =========================================================================
  async getMembershipPlans(includeUnpublished = false) {
    try {
      const plansRef = collection(db, "membershipPlans");
      const snapshot = await getDocs(plansRef);
      let plans = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        plans.push({ id: docSnap.id, ...data });
      });

      if (!includeUnpublished) {
        plans = plans.filter(p => p.published !== false);
      }

      plans.sort((a, b) => {
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
          return a.sortOrder - b.sortOrder;
        }
        return (Number(a.price || a.priceAmount || 0)) - (Number(b.price || b.priceAmount || 0));
      });

      return plans;
    } catch (e) {
      console.warn("Could not fetch membership plans from database:", e);
      return [];
    }
  },

  async getMembershipPlanById(planId) {
    if (!planId) return null;
    const cleanId = String(planId).trim();
    try {
      const docRef = doc(db, "membershipPlans", cleanId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const priceNum = Number(data.price !== undefined ? data.price : data.priceAmount || 0);
        return {
          id: snap.id,
          ...data,
          price: priceNum,
          priceAmount: priceNum,
          priceDisplay: data.priceDisplay || `₹${priceNum.toLocaleString("en-IN")}`,
          duration: data.duration || "1 Month",
          durationDays: Number(data.durationDays) || 30,
          billingCycle: data.billingCycle || `/ ${data.duration || "month"}`,
          qrImageUrl: data.qrImageUrl || DEFAULT_UPI_CONFIG.qrAsset,
          upiId: data.upiId || DEFAULT_UPI_CONFIG.upiId,
          merchantName: data.merchantName || DEFAULT_UPI_CONFIG.merchantName,
          buttonText: data.buttonText || `Choose ${data.name || "Plan"}`
        };
      }
    } catch (e) {
      console.warn("Error fetching plan doc by id:", e);
    }

    // Check by name, slug or partial id in all plans from database
    try {
      const all = await this.getMembershipPlans(true);
      const cleanLower = cleanId.toLowerCase();
      const found = all.find(p => 
        p.id === cleanId || 
        p.id.toLowerCase() === cleanLower ||
        (p.name && p.name.toLowerCase() === cleanLower) ||
        (p.name && p.name.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanLower.replace(/[^a-z0-9]/g, "")) ||
        (p.id && p.id.includes(cleanLower)) ||
        (p.name && p.name.toLowerCase().includes(cleanLower))
      );
      if (found) return found;
    } catch (e) {}

    return null;
  },

  async saveMembershipPlan(planData) {
    const isNew = !planData.id;
    const planId = planData.id || String(planData.name || "plan").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `plan_${Date.now()}`;
    const priceNum = Number(planData.price !== undefined ? planData.price : planData.priceAmount) || 0;
    const durationDays = Number(planData.durationDays) || 30;

    let featuresArray = [];
    if (Array.isArray(planData.features)) {
      featuresArray = planData.features;
    } else if (typeof planData.features === "string") {
      featuresArray = planData.features.split("\n").map(s => s.trim()).filter(Boolean);
    }

    const cleanPlan = {
      name: String(planData.name || "Custom Plan").trim(),
      price: priceNum,
      priceAmount: priceNum,
      priceDisplay: planData.priceDisplay || `₹${priceNum.toLocaleString("en-IN")}`,
      duration: planData.duration || `${durationDays} Days`,
      durationDays: durationDays,
      billingCycle: planData.billingCycle || `/ ${planData.duration || "month"}`,
      tagline: String(planData.tagline || "").trim(),
      description: String(planData.description || "").trim(),
      features: featuresArray,
      qrImageUrl: String(planData.qrImageUrl || DEFAULT_UPI_CONFIG.qrAsset).trim(),
      upiId: String(planData.upiId || DEFAULT_UPI_CONFIG.upiId).trim(),
      merchantName: String(planData.merchantName || DEFAULT_UPI_CONFIG.merchantName).trim(),
      buttonText: String(planData.buttonText || `Choose ${planData.name || "Plan"}`).trim(),
      isRecommended: Boolean(planData.isRecommended),
      badge: planData.isRecommended ? (planData.badge || "Recommended for New Members") : "",
      published: planData.published !== false,
      sortOrder: Number(planData.sortOrder) || 0,
      updatedAt: new Date().toISOString()
    };

    if (isNew) {
      cleanPlan.createdAt = new Date().toISOString();
    }

    const docRef = doc(db, "membershipPlans", planId);
    await setDoc(docRef, cleanPlan, { merge: true });
    return { id: planId, ...cleanPlan };
  },

  async deleteMembershipPlan(planId) {
    if (!planId) throw new Error("Plan ID is required for deletion.");
    const docRef = doc(db, "membershipPlans", planId);
    await deleteDoc(docRef);
    return { success: true, planId };
  },

  async togglePlanPublish(planId, published) {
    if (!planId) throw new Error("Plan ID is required.");
    const docRef = doc(db, "membershipPlans", planId);
    const updates = {
      published: Boolean(published),
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, updates, { merge: true });
    return { id: planId, ...updates };
  },

  async seedDefaultMembershipPlans(force = false) {
    for (const [key, plan] of Object.entries(MEMBERSHIP_PLANS)) {
      try {
        const docRef = doc(db, "membershipPlans", key);
        const snap = await getDoc(docRef);
        if (!snap.exists() || force) {
          const nowIso = new Date().toISOString();
          const clean = {
            ...plan,
            createdAt: snap.exists() ? (snap.data().createdAt || nowIso) : nowIso,
            updatedAt: nowIso
          };
          await setDoc(docRef, clean, { merge: true });
        }
      } catch (e) {
        console.warn("Could not seed plan:", key, e);
      }
    }
  },

  // Submit manual UPI membership payment for admin verification
  async submitMembershipPayment({ userId, userEmail, userName, planId, transactionId, returnProject }) {
    if (!userId) throw new Error("Authenticated user ID is required.");
    if (!transactionId || !String(transactionId).trim()) {
      throw new Error("Please enter a valid UPI Transaction ID / UTR.");
    }

    const cleanTxnId = String(transactionId).trim();
    if (cleanTxnId.length < 6) {
      throw new Error("Transaction ID / UTR must be at least 6 characters.");
    }

    // 1. Duplicate transaction protection
    const exists = await this.checkTransactionIdExists(cleanTxnId);
    if (exists) {
      throw new Error("This transaction ID has already been submitted.");
    }

    // 2. Prevent multiple pending membership submissions
    const existingPending = await this.getUserPendingMembershipPayment(userId);
    if (existingPending) {
      throw new Error(`You already have a pending payment verification (Txn ID: ${existingPending.transactionId}). Please wait for admin approval.`);
    }

    // 3. Resolve plan securely from Firestore (Single source of truth)
    const plan = await this.getMembershipPlanById(planId);
    if (!plan) {
      throw new Error("Selected membership plan not found.");
    }

    const planPrice = Number(plan.price !== undefined ? plan.price : plan.priceAmount) || 0;
    const planDurationDays = Number(plan.durationDays) || 30;

    const paymentsRef = collection(db, "payments");
    const nowIso = new Date().toISOString();

    const paymentRecord = {
      userId,
      userEmail: userEmail || "",
      userName: userName || "Freelancer",
      freelancerId: userId,
      freelancerEmail: userEmail || "",
      freelancerName: userName || "Freelancer",
      planId: plan.id,
      planName: plan.name,
      amount: planPrice,
      amountDisplay: plan.priceDisplay || `₹${planPrice.toLocaleString("en-IN")}`,
      duration: plan.duration || `${planDurationDays} Days`,
      durationDays: planDurationDays,
      currency: "INR",
      qrImageUrl: plan.qrImageUrl || DEFAULT_UPI_CONFIG.qrAsset,
      upiId: plan.upiId || DEFAULT_UPI_CONFIG.upiId,
      merchantName: plan.merchantName || DEFAULT_UPI_CONFIG.merchantName,
      transactionId: cleanTxnId,
      paymentMethod: "UPI (Manual)",
      type: "membership",
      status: "pending",
      submittedAt: nowIso,
      createdAt: nowIso,
      verifiedAt: null,
      verifiedBy: null,
      adminNote: null,
      returnProject: returnProject || null
    };

    const docRef = await addDoc(paymentsRef, paymentRecord);
    return { id: docRef.id, ...paymentRecord };
  },

  // Admin verification of membership payment
  async verifyMembershipPayment(paymentId, adminEmail) {
    if (!paymentId) throw new Error("Payment ID is required.");
    const docRef = doc(db, "payments", paymentId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Payment record not found.");

    const payment = docSnap.data();
    const nowIso = new Date().toISOString();

    const updates = {
      status: "verified",
      verifiedAt: nowIso,
      verifiedBy: adminEmail || "Admin"
    };

    await updateDoc(docRef, updates);

    // Activate membership for the freelancer using actual plan data & durationDays from payment record
    const targetUserId = payment.userId || payment.freelancerId;
    const planName = payment.planName || "Active Membership";
    const durationDays = Number(payment.durationDays) || 30;
    await this.updateMembership(targetUserId, "active", planName, durationDays);

    return { id: paymentId, ...payment, ...updates };
  },

  // Admin rejection of membership payment
  async rejectMembershipPayment(paymentId, adminEmail, reason = "") {
    if (!paymentId) throw new Error("Payment ID is required.");
    const docRef = doc(db, "payments", paymentId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Payment record not found.");

    const payment = docSnap.data();
    const nowIso = new Date().toISOString();

    const updates = {
      status: "rejected",
      rejectedAt: nowIso,
      rejectedBy: adminEmail || "Admin",
      adminNote: reason || "Payment verification failed or details could not be confirmed."
    };

    await updateDoc(docRef, updates);
    return { id: paymentId, ...payment, ...updates };
  },

  // Legacy helper for simulated activation (used only for automated fallbacks)
  async activateMembershipPlan(freelancerId, planKey = "basic") {
    const plan = await this.getMembershipPlanById(planKey);
    const planName = plan ? plan.name : "Active Member";
    const durationDays = plan ? (plan.durationDays || 30) : 30;
    const updatedUser = await this.updateMembership(freelancerId, "active", planName, durationDays);
    return { user: updatedUser, plan };
  },

  // --- 4. Payments ---
  async getPayments(filters = {}) {
    const paymentsRef = collection(db, "payments");
    const snapshot = await getDocs(paymentsRef);
    let payments = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      let match = true;
      if (filters.userId && data.userId !== filters.userId && data.freelancerId !== filters.userId) match = false;
      if (filters.type && data.type !== filters.type) match = false;
      if (filters.status && data.status !== filters.status) match = false;
      if (match) {
        payments.push({ id: docSnap.id, ...data });
      }
    });
    payments.sort((a, b) => new Date(b.createdAt || b.submittedAt || 0) - new Date(a.createdAt || a.submittedAt || 0));
    return payments;
  },

  async addPayment(paymentData) {
    const paymentsRef = collection(db, "payments");
    const newPayment = {
      ...paymentData,
      createdAt: new Date().toISOString()
    };
    const docRef = await addDoc(paymentsRef, newPayment);
    return { id: docRef.id, ...newPayment };
  },

  // --- 5. Reviews ---
  async getReviews() {
    const reviewsRef = collection(db, "reviews");
    const snapshot = await getDocs(reviewsRef);
    let reviews = [];
    snapshot.forEach(docSnap => {
      reviews.push({ id: docSnap.id, ...docSnap.data() });
    });
    reviews.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return reviews;
  },

  async addReview(reviewData) {
    const reviewsRef = collection(db, "reviews");
    const newReview = {
      ...reviewData,
      createdAt: new Date().toISOString()
    };
    const docRef = await addDoc(reviewsRef, newReview);
    return { id: docRef.id, ...newReview };
  },

  // --- 6. Messages ---
  async getMessages(projectId = null) {
    const messagesRef = collection(db, "messages");
    const q = projectId ? query(messagesRef, where("projectId", "==", projectId)) : query(messagesRef);
    const snapshot = await getDocs(q);
    let messages = [];
    snapshot.forEach(docSnap => {
      messages.push({ id: docSnap.id, ...docSnap.data() });
    });
    messages.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return messages;
  },

  async addMessage(msgData) {
    const messagesRef = collection(db, "messages");
    const newMsg = {
      ...msgData,
      createdAt: new Date().toISOString()
    };
    const docRef = await addDoc(messagesRef, newMsg);
    return { id: docRef.id, ...newMsg };
  },

  // --- 7. Settings ---
  async getSettings() {
    const docRef = doc(db, "settings", "general");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return {
      agencyName: "FidoConnect",
      supportEmail: "thecard.primary@gmail.com",
      currency: "USD",
      projectPrefix: "FC"
    };
  },

  async updateSettings(settingsData) {
    const docRef = doc(db, "settings", "general");
    await setDoc(docRef, settingsData, { merge: true });
    return settingsData;
  },

  // --- 8. Dashboard Metrics ---
  async getDashboardStats() {
    const [projectsSnap, appsSnap, usersSnap, paymentsSnap] = await Promise.all([
      getDocs(collection(db, "projects")),
      getDocs(collection(db, "applications")),
      getDocs(collection(db, "users")),
      getDocs(collection(db, "payments"))
    ]);

    let newRequests = 0;
    let activeProjects = 0;
    let completedProjects = 0;
    let activeMembers = 0;
    let freelancersCount = 0;
    let clientsCount = 0;
    let totalRevenue = 0;
    let totalMargin = 0;

    projectsSnap.forEach(docSnap => {
      const p = docSnap.data();
      if (p.status === "Submitted" || p.status === "Under Review") newRequests++;
      if (["Approved", "Published", "In Progress", "Client Review", "Applications Open", "Freelancer Selected", "Submitted for Review", "Revision Required"].includes(p.status)) {
        activeProjects++;
      }
      if (p.status === "Completed") completedProjects++;
    });

    usersSnap.forEach(docSnap => {
      const u = docSnap.data();
      if (u.role === "freelancer") {
        freelancersCount++;
        if (u.membershipStatus === "active") activeMembers++;
      } else if (u.role === "client") {
        clientsCount++;
      }
    });

    paymentsSnap.forEach(docSnap => {
      const pay = docSnap.data();
      if (pay.clientAmount) totalRevenue += Number(pay.clientAmount) || 0;
      if (pay.agencyMargin) totalMargin += Number(pay.agencyMargin) || 0;
    });

    return {
      totalProjects: projectsSnap.size,
      newRequests,
      activeProjects,
      completedProjects,
      totalUsers: usersSnap.size,
      freelancersCount,
      clientsCount,
      activeMembers,
      pendingApplications: appsSnap.size,
      totalRevenue: totalRevenue > 0 ? `$${totalRevenue.toLocaleString()}` : "$0",
      agencyMargin: totalMargin > 0 ? `$${totalMargin.toLocaleString()}` : "$0"
    };
  },

  // --- 9. Invite Codes ---
  async getInviteCodes() {
    const codesRef = collection(db, "inviteCodes");
    const snapshot = await getDocs(codesRef);
    let codes = [];
    snapshot.forEach(docSnap => {
      codes.push({ id: docSnap.id, ...docSnap.data() });
    });
    codes.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return codes;
  },

  async getInviteCodeById(codeDocId) {
    if (!codeDocId) return null;
    const docRef = doc(db, "inviteCodes", codeDocId);
    const snap = await getDoc(docRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  async validateInviteCode(codeStr) {
    if (!codeStr || !codeStr.trim()) {
      throw new Error("Please enter a valid invite code.");
    }
    const cleanCode = codeStr.trim().toUpperCase();
    const docRef = doc(db, "inviteCodes", cleanCode);
    let docSnap = await getDoc(docRef);
    let data = null;
    let codeId = cleanCode;

    if (docSnap.exists()) {
      data = docSnap.data();
    } else {
      const q = query(collection(db, "inviteCodes"), where("code", "==", cleanCode), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        docSnap = snap.docs[0];
        data = docSnap.data();
        codeId = docSnap.id;
      } else {
        throw new Error("Invalid invite code. Please check your code and try again.");
      }
    }

    if (data.status === "used") {
      throw new Error("This invite code has already been used by another account.");
    }
    if (data.status === "revoked") {
      throw new Error("This invite code has been revoked and is no longer valid.");
    }
    if (data.status !== "active") {
      throw new Error("This invite code is currently inactive.");
    }

    return { id: codeId, ...data };
  },

  async claimInviteCode(inviteCodeId, freelancerUid, freelancerEmail) {
    const docRef = doc(db, "inviteCodes", inviteCodeId);
    const usedAt = new Date().toISOString();

    // Re-check and claim in one transaction. If two users submit the same
    // code, Firestore retries one transaction and only the first can succeed.
    return runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) {
        throw new Error("Invalid invite code. Please check your code and try again.");
      }

      const data = snap.data();
      if (data.status !== "active") {
        throw new Error(data.status === "used"
          ? "This invite code has already been used by another account."
          : "This invite code is no longer active.");
      }

      transaction.update(docRef, {
        status: "used",
        usedBy: freelancerUid,
        usedByEmail: freelancerEmail,
        usedAt
      });

      return {
        id: snap.id,
        ...data,
        status: "used",
        usedBy: freelancerUid,
        usedByEmail: freelancerEmail,
        usedAt
      };
    });
  },

  async createInviteCode({ 
    code, 
    sourcePlatform = "Freelancer", 
    otherPlatform = "", 
    freelancerName = "", 
    username = "", 
    additionalInfo = "", 
    note = "", 
    createdBy = "admin" 
  }) {
    if (!code || !code.trim()) {
      throw new Error("Please provide an invite code.");
    }
    const cleanCode = code.trim().toUpperCase();
    const docRef = doc(db, "inviteCodes", cleanCode);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      throw new Error(`Invite code "${cleanCode}" already exists. Please choose a different code.`);
    }

    const newCodeData = {
      code: cleanCode,
      sourcePlatform: sourcePlatform ? sourcePlatform.trim() : "Freelancer",
      otherPlatform: otherPlatform ? otherPlatform.trim() : "",
      freelancerName: freelancerName ? freelancerName.trim() : "",
      username: username ? username.trim() : "",
      additionalInfo: additionalInfo ? additionalInfo.trim() : "",
      note: note ? note.trim() : "",
      status: "active",
      createdBy: createdBy,
      createdAt: new Date().toISOString(),
      usedBy: null,
      usedByEmail: null,
      usedAt: null
    };

    await setDoc(docRef, newCodeData);
    return { id: cleanCode, ...newCodeData };
  },

  async updateInviteCodeStatus(codeDocId, newStatus) {
    const docRef = doc(db, "inviteCodes", codeDocId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error("Invite code not found.");
    }

    const data = snap.data();

    await updateDoc(docRef, {
      status: newStatus,
      updatedAt: new Date().toISOString()
    });

    // If this code was used by a freelancer, synchronize user profile access
    if (data.usedBy) {
      try {
        const userDocRef = doc(db, "users", data.usedBy);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const isVerified = newStatus !== "revoked";
          await updateDoc(userDocRef, {
            inviteVerified: isVerified,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.warn("Could not sync user inviteVerified status:", err);
      }
    }
  }
};

export const dbService = FidoDB;
window.FidoDB = FidoDB;
export default FidoDB;
