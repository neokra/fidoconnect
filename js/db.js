/**
 * FidoConnect - Firestore Database Service
 * 
 * Real Cloud Firestore operations for projects, applications, users,
 * memberships, payments, reviews, messages, settings, and dashboard stats.
 */

// Helper to wait until Firebase is initialized
const getFirebaseServices = async () => {
  if (window.FidoFirebase && window.FidoFirebase.db) {
    return {
      db: window.FidoFirebase.db,
      auth: window.FidoFirebase.auth,
      fs: window.FidoFirebase.firestore
    };
  }

  return new Promise((resolve) => {
    const handler = (e) => {
      window.removeEventListener("firebase-initialized", handler);
      resolve({
        db: e.detail.db,
        auth: e.detail.auth,
        fs: window.FidoFirebase.firestore
      });
    };
    window.addEventListener("firebase-initialized", handler);
  });
};

const FidoDB = {
  // --- 1. Project Operations ---
  async getProjects(filter = {}) {
    const { db, fs } = await getFirebaseServices();
    const projectsRef = fs.collection(db, "projects");
    
    let constraints = [];

    if (filter.status && filter.status !== "all") {
      constraints.push(fs.where("status", "==", filter.status));
    }
    if (filter.clientId) {
      constraints.push(fs.where("clientId", "==", filter.clientId));
    }
    if (filter.assignedFreelancerId) {
      constraints.push(fs.where("assignedFreelancerId", "==", filter.assignedFreelancerId));
    }
    if (filter.visibility) {
      constraints.push(fs.where("visibility", "==", filter.visibility));
    }

    const q = constraints.length > 0 
      ? fs.query(projectsRef, ...constraints)
      : fs.query(projectsRef);

    const snapshot = await fs.getDocs(q);
    let projects = [];

    const currentUser = window.FidoAuth ? window.FidoAuth.getCurrentUser() : null;
    const isAdmin = window.FidoAuth ? window.FidoAuth.isAdmin() : false;

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const proj = { id: docSnap.id, ...data };

      // Client-side category filter
      if (filter.category && filter.category !== "all" && proj.category !== filter.category) {
        return;
      }

      // Search filter
      if (filter.search) {
        const queryStr = filter.search.toLowerCase();
        const matchesTitle = (proj.title || "").toLowerCase().includes(queryStr);
        const matchesDesc = (proj.description || "").toLowerCase().includes(queryStr);
        const matchesCat = (proj.category || "").toLowerCase().includes(queryStr);
        const matchesId = (proj.projectId || "").toLowerCase().includes(queryStr);
        if (!matchesTitle && !matchesDesc && !matchesCat && !matchesId) return;
      }

      // PRIVACY SAFEGUARD:
      // Never expose private client contact info to freelancers or public viewers
      const isOwner = currentUser && proj.clientId === currentUser.uid;
      if (!isAdmin && !isOwner) {
        delete proj.clientEmail;
        delete proj.clientPhone;
        delete proj.clientAddress;
        delete proj.privateContactDetails;
      }

      projects.push(proj);
    });

    // Sort by createdAt descending
    projects.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return projects;
  },

  async getProjectById(projectId) {
    const { db, fs } = await getFirebaseServices();
    
    // Check direct doc ID
    const docRef = fs.doc(db, "projects", projectId);
    const docSnap = await fs.getDoc(docRef);

    let proj = null;
    if (docSnap.exists()) {
      proj = { id: docSnap.id, ...docSnap.data() };
    } else {
      const q = fs.query(fs.collection(db, "projects"), fs.where("projectId", "==", projectId), fs.limit(1));
      const qSnap = await fs.getDocs(q);
      if (!qSnap.empty) {
        const firstDoc = qSnap.docs[0];
        proj = { id: firstDoc.id, ...firstDoc.data() };
      }
    }

    if (!proj) return null;

    // Apply Privacy Safeguard
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

  // Generates unique, collision-safe Project IDs (FC-YYYY-XXXX) using an atomic Firestore transaction
  async createProject(projectData) {
    const { db, fs } = await getFirebaseServices();
    const currentYear = new Date().getFullYear();
    const counterRef = fs.doc(db, "counters", "project_counter");

    let uniqueProjectId = "";

    try {
      await fs.runTransaction(db, async (transaction) => {
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

    const projectDocRef = fs.doc(db, "projects", uniqueProjectId);
    await fs.setDoc(projectDocRef, newProject);

    return { id: uniqueProjectId, ...newProject };
  },

  async updateProject(projectId, updates) {
    const { db, fs } = await getFirebaseServices();
    const docRef = fs.doc(db, "projects", projectId);
    
    const cleanUpdates = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await fs.updateDoc(docRef, cleanUpdates);
    return { id: projectId, ...cleanUpdates };
  },

  async deleteProject(projectId) {
    const { db, fs } = await getFirebaseServices();
    const docRef = fs.doc(db, "projects", projectId);
    await fs.deleteDoc(docRef);
    return true;
  },

  // --- 2. Application Operations ---
  async getApplications(filter = {}) {
    const { db, fs } = await getFirebaseServices();
    const appsRef = fs.collection(db, "applications");
    
    let constraints = [];
    if (filter.projectId) {
      constraints.push(fs.where("projectId", "==", filter.projectId));
    }
    if (filter.freelancerId) {
      constraints.push(fs.where("freelancerId", "==", filter.freelancerId));
    }
    if (filter.status) {
      constraints.push(fs.where("status", "==", filter.status));
    }

    const q = constraints.length > 0 ? fs.query(appsRef, ...constraints) : fs.query(appsRef);
    const snapshot = await fs.getDocs(q);

    let applications = [];
    snapshot.forEach(docSnap => {
      applications.push({ id: docSnap.id, ...docSnap.data() });
    });

    applications.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return applications;
  },

  async createApplication(appData) {
    const { db, fs } = await getFirebaseServices();
    const appsRef = fs.collection(db, "applications");

    // Prevent duplicate applications
    const checkQuery = fs.query(
      appsRef,
      fs.where("projectId", "==", appData.projectId),
      fs.where("freelancerId", "==", appData.freelancerId),
      fs.limit(1)
    );
    const existingSnap = await fs.getDocs(checkQuery);

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

    const docRef = await fs.addDoc(appsRef, newApp);
    return { id: docRef.id, ...newApp };
  },

  async updateApplication(appId, updates) {
    const { db, fs } = await getFirebaseServices();
    const docRef = fs.doc(db, "applications", appId);
    await fs.updateDoc(docRef, updates);
    return { id: appId, ...updates };
  },

  // --- 3. User Operations ---
  async getUsers(role = null) {
    const { db, fs } = await getFirebaseServices();
    const usersRef = fs.collection(db, "users");

    const q = role ? fs.query(usersRef, fs.where("role", "==", role)) : fs.query(usersRef);
    const snapshot = await fs.getDocs(q);

    let users = [];
    snapshot.forEach(docSnap => {
      users.push({ uid: docSnap.id, ...docSnap.data() });
    });

    users.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return users;
  },

  async getUserById(uid) {
    if (!uid) return null;
    const { db, fs } = await getFirebaseServices();
    const docRef = fs.doc(db, "users", uid);
    const docSnap = await fs.getDoc(docRef);

    if (docSnap.exists()) {
      return { uid: docSnap.id, ...docSnap.data() };
    }
    return null;
  },

  async updateUser(uid, updates) {
    const { db, fs } = await getFirebaseServices();
    const docRef = fs.doc(db, "users", uid);

    // Never allow non-admins to change role to admin
    const isAdmin = window.FidoAuth ? window.FidoAuth.isAdmin() : false;
    if (updates.role === "admin" && !isAdmin) {
      delete updates.role;
    }

    const cleanUpdates = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await fs.updateDoc(docRef, cleanUpdates);
    
    // Sync active cached profile if updating current user
    const currentUser = window.FidoAuth ? window.FidoAuth.getCurrentUser() : null;
    if (currentUser && currentUser.uid === uid) {
      window.FidoAuth._cachedUserProfile = {
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

  // --- 4. Payments Collection Operations ---
  async getPayments() {
    const { db, fs } = await getFirebaseServices();
    const paymentsRef = fs.collection(db, "payments");
    const snapshot = await fs.getDocs(paymentsRef);

    let payments = [];
    snapshot.forEach(docSnap => {
      payments.push({ id: docSnap.id, ...docSnap.data() });
    });

    payments.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return payments;
  },

  async addPayment(paymentData) {
    const { db, fs } = await getFirebaseServices();
    const paymentsRef = fs.collection(db, "payments");
    const newPayment = {
      ...paymentData,
      createdAt: new Date().toISOString()
    };
    const docRef = await fs.addDoc(paymentsRef, newPayment);
    return { id: docRef.id, ...newPayment };
  },

  async updatePayment(paymentId, updates) {
    const { db, fs } = await getFirebaseServices();
    const docRef = fs.doc(db, "payments", paymentId);
    await fs.updateDoc(docRef, updates);
    return { id: paymentId, ...updates };
  },

  // --- 5. Reviews Collection Operations ---
  async getReviews() {
    const { db, fs } = await getFirebaseServices();
    const reviewsRef = fs.collection(db, "reviews");
    const snapshot = await fs.getDocs(reviewsRef);

    let reviews = [];
    snapshot.forEach(docSnap => {
      reviews.push({ id: docSnap.id, ...docSnap.data() });
    });

    reviews.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return reviews;
  },

  async addReview(reviewData) {
    const { db, fs } = await getFirebaseServices();
    const reviewsRef = fs.collection(db, "reviews");
    const newReview = {
      ...reviewData,
      createdAt: new Date().toISOString()
    };
    const docRef = await fs.addDoc(reviewsRef, newReview);
    return { id: docRef.id, ...newReview };
  },

  // --- 6. Messages Collection Operations ---
  async getMessages(projectId = null) {
    const { db, fs } = await getFirebaseServices();
    const messagesRef = fs.collection(db, "messages");
    
    const q = projectId 
      ? fs.query(messagesRef, fs.where("projectId", "==", projectId))
      : fs.query(messagesRef);

    const snapshot = await fs.getDocs(q);
    let messages = [];
    snapshot.forEach(docSnap => {
      messages.push({ id: docSnap.id, ...docSnap.data() });
    });

    messages.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return messages;
  },

  async addMessage(msgData) {
    const { db, fs } = await getFirebaseServices();
    const messagesRef = fs.collection(db, "messages");
    const newMsg = {
      ...msgData,
      createdAt: new Date().toISOString()
    };
    const docRef = await fs.addDoc(messagesRef, newMsg);
    return { id: docRef.id, ...newMsg };
  },

  // --- 7. Settings Collection Operations ---
  async getSettings() {
    const { db, fs } = await getFirebaseServices();
    const docRef = fs.doc(db, "settings", "general");
    const docSnap = await fs.getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return {
      agencyName: "FidoConnect",
      supportEmail: "thecard.primary@gmail.com",
      currency: "USD",
      projectPrefix: "FC",
      membershipAnnualFee: "$120"
    };
  },

  async updateSettings(settingsData) {
    const { db, fs } = await getFirebaseServices();
    const docRef = fs.doc(db, "settings", "general");
    await fs.setDoc(docRef, settingsData, { merge: true });
    return settingsData;
  },

  // --- 8. Comprehensive Dashboard Metrics ---
  async getDashboardStats() {
    const { db, fs } = await getFirebaseServices();

    const [projectsSnap, appsSnap, usersSnap, paymentsSnap] = await Promise.all([
      fs.getDocs(fs.collection(db, "projects")),
      fs.getDocs(fs.collection(db, "applications")),
      fs.getDocs(fs.collection(db, "users")),
      fs.getDocs(fs.collection(db, "payments"))
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
  }
};

window.FidoDB = FidoDB;
export default FidoDB;
