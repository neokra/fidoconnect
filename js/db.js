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

export const MEMBERSHIP_PLANS = {
  basic: {
    id: "basic",
    name: "Selected Basic",
    priceDisplay: "₹499",
    priceAmount: 499,
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
    buttonText: "Choose Basic"
  },
  pro: {
    id: "pro",
    name: "Selected Pro",
    priceDisplay: "₹1,999",
    priceAmount: 1999,
    billingCycle: "/ month",
    badge: null,
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
    buttonText: "Choose Pro"
  },
  premium: {
    id: "premium",
    name: "Selected Premium",
    priceDisplay: "₹4,999",
    priceAmount: 4999,
    billingCycle: "/ month",
    badge: null,
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
    buttonText: "Choose Premium"
  }
};

export const FidoDB = {
  SKILL_TAXONOMY,
  MEMBERSHIP_PLANS,

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
    return applications;
  },

  async createApplication(appData) {
    const appsRef = collection(db, "applications");

    const checkQuery = query(
      appsRef,
      where("projectId", "==", appData.projectId),
      where("freelancerId", "==", appData.freelancerId),
      limit(1)
    );
    const existingSnap = await getDocs(checkQuery);

    if (!existingSnap.empty) {
      throw new Error("You have already submitted an application for this project.");
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
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(appsRef, newApp);
    return { id: docRef.id, ...newApp };
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

  async updateMembership(freelancerId, status, plan = "Selected Basic", durationDays = 30) {
    const startDate = status === "active" ? new Date().toISOString() : null;
    const expiryDate = status === "active" ? new Date(Date.now() + durationDays*24*60*60*1000).toISOString() : null;

    return this.updateUser(freelancerId, {
      membershipStatus: status,
      membershipPlan: plan,
      membershipStart: startDate,
      membershipExpiry: expiryDate
    });
  },

  async activateMembershipPlan(freelancerId, planKey = "basic") {
    const plan = MEMBERSHIP_PLANS[planKey] || MEMBERSHIP_PLANS.basic;
    const currentUser = window.FidoAuth ? window.FidoAuth.getCurrentUser() : null;

    const updatedUser = await this.updateMembership(freelancerId, "active", plan.name, 30);

    try {
      await this.addPayment({
        freelancerId,
        freelancerName: currentUser ? currentUser.name : "",
        freelancerEmail: currentUser ? currentUser.email : "",
        planId: plan.id,
        planName: plan.name,
        amount: plan.priceAmount,
        currency: "INR",
        paymentMethod: "Online (Simulated)",
        status: "Completed",
        type: "membership"
      });
    } catch (e) {
      console.warn("Could not log membership payment:", e);
    }

    return { user: updatedUser, plan };
  },

  // --- 4. Payments ---
  async getPayments() {
    const paymentsRef = collection(db, "payments");
    const snapshot = await getDocs(paymentsRef);
    let payments = [];
    snapshot.forEach(docSnap => {
      payments.push({ id: docSnap.id, ...docSnap.data() });
    });
    payments.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
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
