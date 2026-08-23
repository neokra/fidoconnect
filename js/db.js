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

export const FidoDB = {
  // --- 1. Projects ---
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
    const docRef = doc(db, "projects", projectId);
    const docSnap = await getDoc(docRef);

    let proj = null;
    if (docSnap.exists()) {
      proj = { id: docSnap.id, ...docSnap.data() };
    } else {
      const q = query(collection(db, "projects"), where("projectId", "==", projectId), limit(1));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        const firstDoc = qSnap.docs[0];
        proj = { id: firstDoc.id, ...firstDoc.data() };
      }
    }

    if (!proj) return null;

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
    await updateDoc(docRef, updates);
    return { id: appId, ...updates };
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

  async updateMembership(freelancerId, status, plan = "Standard Member") {
    const startDate = status === "active" ? new Date().toISOString() : null;
    const expiryDate = status === "active" ? new Date(Date.now() + 365*24*60*60*1000).toISOString() : null;

    return this.updateUser(freelancerId, {
      membershipStatus: status,
      membershipPlan: plan,
      membershipStart: startDate,
      membershipExpiry: expiryDate
    });
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
    const codesRef = collection(db, "inviteCodes");
    const q = query(codesRef, where("code", "==", cleanCode), limit(1));
    const snap = await getDocs(q);

    if (snap.empty) {
      throw new Error("Invalid invite code. Please check your code and try again.");
    }

    const docSnap = snap.docs[0];
    const data = docSnap.data();

    if (data.status === "used") {
      throw new Error("This invite code has already been used by another account.");
    }
    if (data.status === "revoked") {
      throw new Error("This invite code has been revoked and is no longer valid.");
    }
    if (data.status !== "active") {
      throw new Error("This invite code is currently inactive.");
    }

    return { id: docSnap.id, ...data };
  },

  async claimInviteCode(codeStr, freelancerUid, freelancerEmail) {
    const validCode = await this.validateInviteCode(codeStr);
    const docRef = doc(db, "inviteCodes", validCode.id);
    await updateDoc(docRef, {
      status: "used",
      usedBy: freelancerUid,
      usedByEmail: freelancerEmail,
      usedAt: new Date().toISOString()
    });
    return { ...validCode, status: "used", usedBy: freelancerUid, usedByEmail: freelancerEmail };
  },

  async createInviteCode({ 
    code, 
    platform = "Freelancer", 
    freelancerName = "", 
    freelancerHandle = "", 
    additionalInfo = "", 
    note = "", 
    createdBy = "admin" 
  }) {
    if (!code || !code.trim()) {
      throw new Error("Please provide an invite code.");
    }
    const cleanCode = code.trim().toUpperCase();
    
    const codesRef = collection(db, "inviteCodes");
    const q = query(codesRef, where("code", "==", cleanCode), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error(`Invite code "${cleanCode}" already exists. Please choose a different code.`);
    }

    const newCodeData = {
      code: cleanCode,
      platform: platform ? platform.trim() : "Freelancer",
      freelancerName: freelancerName ? freelancerName.trim() : "",
      freelancerHandle: freelancerHandle ? freelancerHandle.trim() : "",
      additionalInfo: additionalInfo ? additionalInfo.trim() : "",
      note: note ? note.trim() : "",
      status: "active",
      createdBy: createdBy,
      createdAt: new Date().toISOString(),
      usedBy: null,
      usedByEmail: null,
      usedAt: null
    };

    const docRef = await addDoc(codesRef, newCodeData);
    return { id: docRef.id, ...newCodeData };
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

export { FidoDB };
export const dbService = FidoDB;
window.FidoDB = FidoDB;
export default FidoDB;
