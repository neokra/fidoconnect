/**
 * FidoConnect - Database & Firestore Service Abstraction Layer
 */

const FidoDB = {
  // Helper to load items from LocalStorage
  _getCollection(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Error reading collection:", key, e);
      return [];
    }
  },

  // Helper to save items to LocalStorage
  _setCollection(key, items) {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch (e) {
      console.error("Error saving collection:", key, e);
    }
  },

  // --- Project Operations ---
  async getProjects(filter = {}) {
    const projects = this._getCollection(window.FidoFirebase.storageKeys.PROJECTS);
    return projects.filter(p => {
      if (filter.status && p.status !== filter.status) return false;
      if (filter.category && filter.category !== "all" && p.category !== filter.category) return false;
      if (filter.clientId && p.clientId !== filter.clientId) return false;
      if (filter.assignedFreelancerId && p.assignedFreelancerId !== filter.assignedFreelancerId) return false;
      if (filter.visibility && p.visibility !== filter.visibility) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const matchesTitle = (p.title || "").toLowerCase().includes(q);
        const matchesDesc = (p.description || "").toLowerCase().includes(q);
        const matchesCat = (p.category || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesCat) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getProjectById(projectId) {
    const projects = this._getCollection(window.FidoFirebase.storageKeys.PROJECTS);
    return projects.find(p => p.id === projectId || p.projectId === projectId) || null;
  },

  async createProject(projectData) {
    const projects = this._getCollection(window.FidoFirebase.storageKeys.PROJECTS);
    
    // Generate sequential Project ID like FC-2026-0005
    const currentYear = new Date().getFullYear();
    const count = projects.length + 1;
    const projectSequence = String(count).padStart(4, "0");
    const uniqueProjectId = `FC-${currentYear}-${projectSequence}`;

    const newProject = {
      id: uniqueProjectId,
      projectId: uniqueProjectId,
      title: projectData.title,
      category: projectData.category || "Other",
      description: projectData.description,
      requirements: projectData.requirements || "",
      budget: projectData.budget || "To be discussed",
      deadline: projectData.deadline || "Flexible",
      clientId: projectData.clientId || "guest_client",
      clientName: projectData.clientName || "Client Request",
      clientBusiness: projectData.clientBusiness || "Private Business",
      clientEmail: projectData.clientEmail || "",
      clientPhone: projectData.clientPhone || "",
      requiredSkills: projectData.requiredSkills || [projectData.category],
      status: "Submitted", // Initial workflow state
      visibility: "admin_only", // Becomes 'public' upon admin approval
      assignedFreelancerId: null,
      agencyNotes: "Received new client submission. Pending review.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    projects.unshift(newProject);
    this._setCollection(window.FidoFirebase.storageKeys.PROJECTS, projects);
    return newProject;
  },

  async updateProject(projectId, updates) {
    const projects = this._getCollection(window.FidoFirebase.storageKeys.PROJECTS);
    const index = projects.findIndex(p => p.id === projectId || p.projectId === projectId);
    if (index === -1) throw new Error("Project not found");

    projects[index] = {
      ...projects[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this._setCollection(window.FidoFirebase.storageKeys.PROJECTS, projects);
    return projects[index];
  },

  // --- Application Operations ---
  async getApplications(filter = {}) {
    const apps = this._getCollection(window.FidoFirebase.storageKeys.APPLICATIONS);
    return apps.filter(app => {
      if (filter.projectId && app.projectId !== filter.projectId) return false;
      if (filter.freelancerId && app.freelancerId !== filter.freelancerId) return false;
      if (filter.status && app.status !== filter.status) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async createApplication(appData) {
    const apps = this._getCollection(window.FidoFirebase.storageKeys.APPLICATIONS);
    
    // Check if freelancer already applied
    const existing = apps.find(a => a.projectId === appData.projectId && a.freelancerId === appData.freelancerId);
    if (existing) {
      throw new Error("You have already submitted an application for this project.");
    }

    const newApp = {
      id: `APP-${Date.now().toString().slice(-4)}`,
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

    apps.unshift(newApp);
    this._setCollection(window.FidoFirebase.storageKeys.APPLICATIONS, apps);
    return newApp;
  },

  async updateApplication(appId, updates) {
    const apps = this._getCollection(window.FidoFirebase.storageKeys.APPLICATIONS);
    const index = apps.findIndex(a => a.id === appId);
    if (index === -1) throw new Error("Application not found");

    apps[index] = {
      ...apps[index],
      ...updates
    };

    this._setCollection(window.FidoFirebase.storageKeys.APPLICATIONS, apps);
    return apps[index];
  },

  // --- User Operations ---
  async getUsers(role = null) {
    const users = this._getCollection(window.FidoFirebase.storageKeys.USERS);
    if (!role) return users;
    return users.filter(u => u.role === role);
  },

  async getUserById(uid) {
    const users = this._getCollection(window.FidoFirebase.storageKeys.USERS);
    return users.find(u => u.uid === uid) || null;
  },

  async updateUser(uid, updates) {
    const users = this._getCollection(window.FidoFirebase.storageKeys.USERS);
    const index = users.findIndex(u => u.uid === uid);
    if (index === -1) throw new Error("User not found");

    users[index] = {
      ...users[index],
      ...updates
    };

    this._setCollection(window.FidoFirebase.storageKeys.USERS, users);
    
    // If updating currently logged in user, sync session
    const current = window.FidoAuth.getCurrentUser();
    if (current && current.uid === uid) {
      window.FidoAuth.setCurrentUser(users[index]);
    }

    return users[index];
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
    const projects = this._getCollection(window.FidoFirebase.storageKeys.PROJECTS);
    const apps = this._getCollection(window.FidoFirebase.storageKeys.APPLICATIONS);
    const users = this._getCollection(window.FidoFirebase.storageKeys.USERS);

    const newRequests = projects.filter(p => p.status === "Submitted" || p.status === "Under Review").length;
    const activeProjects = projects.filter(p => ["Approved", "Published", "In Progress", "Client Review"].includes(p.status)).length;
    const completedProjects = projects.filter(p => p.status === "Completed").length;
    const activeMembers = users.filter(u => u.role === "freelancer" && u.membershipStatus === "active").length;
    const totalApplications = apps.length;

    return {
      newRequests,
      activeProjects,
      completedProjects,
      activeMembers,
      totalApplications,
      totalProjects: projects.length
    };
  }
};

window.FidoDB = FidoDB;
