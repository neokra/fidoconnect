/**
 * FidoConnect - Firestore Database Service
 * 
 * Direct Cloud Firestore operations for projects, applications, users,
 * memberships, and operational metrics.
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
  // --- Project Operations ---
  async getProjects(filter = {}) {
    const { db, fs } = await getFirebaseServices();
    const projectsRef = fs.collection(db, "projects");
    
    let constraints = [];

    // Server-side filtering when possible
    if (filter.status) {
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
    const isAdmin = currentUser && currentUser.role === "admin";

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const proj = { id: docSnap.id, ...data };

      // Client-side text & category filters
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

      // PRIVACY SAFEGUARD:
      // Never expose private client details to freelancers or public viewers
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
      // Query by projectId field if different
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
    const isAdmin = currentUser && currentUser.role === "admin";
    const isOwner = currentUser && proj.clientId === currentUser.uid;

    if (!isAdmin && !isOwner) {
      delete proj.clientEmail;
      delete proj.clientPhone;
      delete proj.clientAddress;
      delete proj.privateContactDetails;
    }

    return proj;
  },

  // Generates unique, collision-safe Project IDs (FC-YYYY-XXXX) using a Firestore atomic transaction
  async createProject(projectData) {
    const { db, fs } = await getFirebaseServices();
    const currentYear = new Date().getFullYear();
    const counterRef = fs.doc(db, "counters", "project_counter");

    let uniqueProjectId = "";

    try {
      // Atomic counter transaction for guaranteed collision-free sequential IDs
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
      console.warn("Transaction counter fallback to timestamp ID:", err);
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
      status: "Submitted", // Project lifecycle start
      visibility: "admin_only", // Only published after agency review & approval
      assignedFreelancerId: null,
      agencyNotes: "Received new client submission. Pending review.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save to Firestore using uniqueProjectId as document ID
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

  // --- Application Operations ---
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

    // Prevent duplicate applications for same project by same freelancer
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

  // --- User Operations ---
  async getUsers(role = null) {
    const { db, fs } = await getFirebaseServices();
    const usersRef = fs.collection(db, "users");

    const q = role ? fs.query(usersRef, fs.where("role", "==", role)) : fs.query(usersRef);
    const snapshot = await fs.getDocs(q);

    let users = [];
    snapshot.forEach(docSnap => {
      users.push({ uid: docSnap.id, ...docSnap.data() });
    });

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

    // Prevent malicious self-escalation to admin
    const currentUser = window.FidoAuth ? window.FidoAuth.getCurrentUser() : null;
    if (updates.role === "admin" && (!currentUser || currentUser.role !== "admin")) {
      delete updates.role;
    }

    await fs.updateDoc(docRef, updates);
    
    // If updating current user, refresh cache
    if (currentUser && currentUser.uid === uid) {
      window.FidoAuth._cachedUserProfile = {
        ...currentUser,
        ...updates
      };
      window.FidoAuth.updateNavUI();
    }

    return { uid, ...updates };
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

  // --- Dashboard Metrics ---
  async getDashboardStats() {
    const { db, fs } = await getFirebaseServices();

    const [projectsSnap, appsSnap, usersSnap] = await Promise.all([
      fs.getDocs(fs.collection(db, "projects")),
      fs.getDocs(fs.collection(db, "applications")),
      fs.getDocs(fs.collection(db, "users"))
    ]);

    let newRequests = 0;
    let activeProjects = 0;
    let completedProjects = 0;
    let activeMembers = 0;

    projectsSnap.forEach(docSnap => {
      const p = docSnap.data();
      if (p.status === "Submitted" || p.status === "Under Review") newRequests++;
      if (["Approved", "Published", "In Progress", "Client Review"].includes(p.status)) activeProjects++;
      if (p.status === "Completed") completedProjects++;
    });

    usersSnap.forEach(docSnap => {
      const u = docSnap.data();
      if (u.role === "freelancer" && u.membershipStatus === "active") activeMembers++;
    });

    return {
      newRequests,
      activeProjects,
      completedProjects,
      activeMembers,
      totalApplications: appsSnap.size,
      totalProjects: projectsSnap.size
    };
  }
};

window.FidoDB = FidoDB;
export default FidoDB;
