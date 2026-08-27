/**
 * FidoConnect - Account Management Controller
 * 
 * Manages Client, Freelancer, and Administrator account portals.
 */

import { FidoAuth } from "./auth.js";
import { FidoDB, SKILL_TAXONOMY } from "./db.js";
import { showToast, formatDate } from "./ui.js";

let currentUser = null;
let selectedModalCategories = new Set();
let selectedModalSubcategories = new Set();

document.addEventListener("DOMContentLoaded", async () => {
  const isAuth = await FidoAuth.requireAuth();
  if (!isAuth) return;

  currentUser = FidoAuth.getCurrentUser();
  setupSkillProfileModal();
  await renderAccountView();

  FidoAuth.onAuthChange(async (user) => {
    if (user) {
      currentUser = user;
      await renderAccountView();
    }
  });
});

function setupEventListeners() {
  // Backdrop click listener to close modals
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay && !overlay.classList.contains("modal-mandatory")) {
        closeModal(overlay.id);
      }
    });
  });

  // Auto-open modal based on URL params or hash
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get("tab") || (urlParams.get("return_project") ? "membership" : "");
  
  if (tabParam === "membership") {
    openModal("modal-membership");
  } else if (tabParam === "apps" || tabParam === "applications" || tabParam === "freelancer-apps") {
    openModal("modal-freelancer-apps");
  } else if (tabParam === "projects" || tabParam === "freelancer-projects" || tabParam === "client-projects") {
    openModal(currentUser && currentUser.role === "client" ? "modal-client-projects" : "modal-freelancer-projects");
  } else if (tabParam === "profile" || tabParam === "freelancer-profile" || tabParam === "client-profile") {
    openModal(currentUser && currentUser.role === "client" ? "modal-client-profile" : "modal-freelancer-profile");
  } else if (tabParam === "settings" || tabParam === "freelancer-settings" || tabParam === "client-settings") {
    openModal(currentUser && currentUser.role === "client" ? "modal-client-settings" : "modal-freelancer-settings");
  } else if (window.location.hash) {
    const hash = window.location.hash.replace("#", "").replace("-tab", "");
    if (hash === "membership") openModal("modal-membership");
    else if (hash === "apps" || hash === "freelancer-apps") openModal("modal-freelancer-apps");
    else if (hash === "projects" || hash === "freelancer-projects" || hash === "client-projects") {
      openModal(currentUser && currentUser.role === "client" ? "modal-client-projects" : "modal-freelancer-projects");
    } else if (hash === "profile" || hash === "freelancer-profile" || hash === "client-profile") {
      openModal(currentUser && currentUser.role === "client" ? "modal-client-profile" : "modal-freelancer-profile");
    } else if (hash === "settings" || hash === "freelancer-settings" || hash === "client-settings") {
      openModal(currentUser && currentUser.role === "client" ? "modal-client-settings" : "modal-freelancer-settings");
    }
  }
}

async function renderAccountView() {
  const container = document.getElementById("account-layout-container");
  if (!container || !currentUser) return;

  const isAdmin = FidoAuth.isAdmin();

  if (isAdmin) {
    await renderAdminAccountView(container);
  } else if (currentUser.role === "freelancer") {
    await renderFreelancerView(container);
  } else {
    await renderClientView(container);
  }

  // Re-attach modal & form event listeners
  setupEventListeners();
}

// 1. Administrator Account Portal
async function renderAdminAccountView(container) {
  const stats = await FidoDB.getDashboardStats();
  const initials = (currentUser.name || "Admin").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  container.innerHTML = `
    <div>
      <!-- 1. Profile Header Hero Banner -->
      <div class="dashboard-profile-card">
        <div class="dashboard-user-info">
          <div class="dashboard-avatar" style="background: linear-gradient(135deg, #475569 0%, #0f172a 100%);">
            ${currentUser.photoURL ? `<img src="${currentUser.photoURL}" alt="${currentUser.name || "Admin"}">` : initials}
          </div>
          <div class="dashboard-user-details">
            <div class="dashboard-user-name-row">
              <h1 class="dashboard-user-name">${currentUser.name || "Administrator"}</h1>
            </div>
            <p class="dashboard-user-email">${currentUser.email}</p>
            <div class="dashboard-badges-row">
              <span class="role-badge role-badge-admin">⚙ System Administrator</span>
              <span class="badge badge-active">✓ Master Access</span>
            </div>
          </div>
        </div>
        <div class="dashboard-header-actions">
          <a href="admin.html" class="btn btn-primary">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
            Admin Panel
          </a>
          <button id="admin-account-logout-btn" class="btn btn-secondary">Sign Out</button>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="dashboard-stats-grid">
        <div class="dashboard-stat-card">
          <span class="dashboard-stat-label">New Requests</span>
          <span class="dashboard-stat-value" style="color:var(--color-accent);">${stats.newRequests}</span>
          <span class="dashboard-stat-sub">Pending review</span>
        </div>
        <div class="dashboard-stat-card">
          <span class="dashboard-stat-label">Active Projects</span>
          <span class="dashboard-stat-value">${stats.activeProjects}</span>
          <span class="dashboard-stat-sub">In progress / Open</span>
        </div>
        <div class="dashboard-stat-card">
          <span class="dashboard-stat-label">Proposals</span>
          <span class="dashboard-stat-value">${stats.pendingApplications}</span>
          <span class="dashboard-stat-sub">Submitted proposals</span>
        </div>
        <div class="dashboard-stat-card">
          <span class="dashboard-stat-label">Members</span>
          <span class="dashboard-stat-value">${stats.activeMembers}</span>
          <span class="dashboard-stat-sub"><span class="stat-dot-active">●</span> Active freelancers</span>
        </div>
        <div class="dashboard-stat-card">
          <span class="dashboard-stat-label">Total Users</span>
          <span class="dashboard-stat-value">${stats.totalUsers}</span>
          <span class="dashboard-stat-sub">Clients & Freelancers</span>
        </div>
      </div>

      <!-- Admin Panel Callout Card -->
      <div class="card" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 2.25rem 2rem; border-radius: var(--border-radius-lg); margin-bottom: 2rem; box-shadow: var(--shadow-md);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.5rem;">
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
              <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#10b981;"></span>
              <span style="font-size:0.78rem; text-transform:uppercase; letter-spacing:0.06em; font-weight:700; color:#93c5fd;">System Control</span>
            </div>
            <h3 style="color:white; font-size:1.6rem; font-weight:750; margin-bottom:0.35rem;">FidoConnect Admin Console</h3>
            <p style="color:#cbd5e1; font-size:0.95rem; max-width:580px; margin:0; line-height:1.5;">
              Manage all 12 agency modules: project requests, approvals, proposals, network members, payments, reviews, invite codes, and client communication.
            </p>
          </div>
          <div>
            <a href="admin.html" class="btn btn-primary btn-lg" style="box-shadow: 0 4px 14px rgba(37,99,235,0.35);">
              Open Full Console &rarr;
            </a>
          </div>
        </div>
      </div>

      <!-- Admin Account Settings -->
      <div class="card" style="max-width: 680px; padding: 2rem 2.25rem; border-radius: var(--border-radius-lg);">
        <h3 style="margin-bottom: 1.25rem; font-size:1.35rem; font-weight:750;">Administrator Profile</h3>
        <form id="admin-profile-form">
          <div class="form-group">
            <label class="form-label">Name</label>
            <input type="text" id="edit-admin-name" class="form-control" value="${currentUser.name || ""}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" class="form-control" value="${currentUser.email}" disabled style="background:#f1f5f9;" />
          </div>
          <div class="form-group">
            <label class="form-label">WhatsApp / Phone</label>
            <input type="text" id="edit-admin-phone" class="form-control" value="${currentUser.phone || ""}" />
          </div>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById("admin-account-logout-btn").addEventListener("click", () => FidoAuth.logout());

  const profForm = document.getElementById("admin-profile-form");
  if (profForm) {
    profForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await FidoDB.updateUser(currentUser.uid, {
          name: document.getElementById("edit-admin-name").value.trim(),
          phone: document.getElementById("edit-admin-phone").value.trim()
        });
        showToast("Profile updated successfully", "success");
      } catch (err) {
        showToast("Failed to update profile: " + err.message, "error");
      }
    });
  }
}

// 2. Client Account Portal
async function renderClientView(container) {
  const clientProjects = await FidoDB.getProjects({ clientId: currentUser.uid });
  const activeCount = clientProjects.filter(p => ["Approved", "Published", "In Progress", "Applications Open", "Submitted"].includes(p.status)).length;
  const initials = (currentUser.businessName || currentUser.name || "Client").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  container.innerHTML = `
    <div>
      <!-- 1. Profile Header Hero Banner -->
      <div class="dashboard-profile-card">
        <div class="dashboard-user-info">
          <div class="dashboard-avatar">
            ${currentUser.photoURL ? `<img src="${currentUser.photoURL}" alt="${currentUser.name || "Client"}">` : initials}
          </div>
          <div class="dashboard-user-details">
            <div class="dashboard-user-name-row">
              <h1 class="dashboard-user-name">${currentUser.businessName || currentUser.name || "Client"}</h1>
            </div>
            <p class="dashboard-user-email">${currentUser.email}</p>
            <div class="dashboard-badges-row">
              <span class="role-badge role-badge-client">👤 Client Account</span>
              <span class="badge badge-active">✓ Verified Client</span>
            </div>
          </div>
        </div>
        <div class="dashboard-header-actions">
          <a href="post-work.html" class="btn btn-primary">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            Post a Work
          </a>
          <button id="client-logout-btn" class="btn btn-secondary">Sign Out</button>
        </div>
      </div>

      <!-- 2. Account Action Buttons Grid (Sitting Above Stats) -->
      <div class="account-action-grid account-action-grid-client">
        <div class="account-action-card" onclick="openModal('modal-client-projects')">
          <div>
            <div class="account-action-card-head">
              <span class="account-action-card-title">💼 My Projects</span>
              <span class="account-action-card-badge">${clientProjects.length}</span>
            </div>
            <p class="account-action-card-desc">View submitted project requests and live milestone tracking.</p>
          </div>
          <div class="account-action-card-arrow">View Projects &rarr;</div>
        </div>

        <div class="account-action-card" onclick="openModal('modal-client-profile')">
          <div>
            <div class="account-action-card-head">
              <span class="account-action-card-title">👤 Business Profile</span>
            </div>
            <p class="account-action-card-desc">Manage organization details and contact preferences.</p>
          </div>
          <div class="account-action-card-arrow">Edit Profile &rarr;</div>
        </div>

        <div class="account-action-card" onclick="openModal('modal-client-settings')">
          <div>
            <div class="account-action-card-head">
              <span class="account-action-card-title">⚙️ Account Settings</span>
            </div>
            <p class="account-action-card-desc">Account credentials, preferences, and password recovery.</p>
          </div>
          <div class="account-action-card-arrow">Settings &rarr;</div>
        </div>
      </div>

      <!-- 3. Quick Stats Area (Sitting Below Action Buttons) -->
      <div class="dashboard-stats-grid dashboard-stats-grid-client">
        <div class="dashboard-stat-card">
          <span class="dashboard-stat-label">Account Role</span>
          <span class="dashboard-stat-value" style="font-size:1.25rem;">Client</span>
          <span class="dashboard-stat-sub"><span class="stat-dot-active">●</span> Active account</span>
        </div>
        <div class="dashboard-stat-card">
          <span class="dashboard-stat-label">Total Projects</span>
          <span class="dashboard-stat-value">${clientProjects.length}</span>
          <span class="dashboard-stat-sub">${clientProjects.length === 1 ? "1 project posted" : `${clientProjects.length} total posted`}</span>
        </div>
        <div class="dashboard-stat-card">
          <span class="dashboard-stat-label">Active Work</span>
          <span class="dashboard-stat-value" style="color:var(--color-accent);">${activeCount}</span>
          <span class="dashboard-stat-sub">In progress or open</span>
        </div>
        <div class="dashboard-stat-card">
          <span class="dashboard-stat-label">Account Status</span>
          <span class="dashboard-stat-value" style="color:#10b981;">Active</span>
          <span class="dashboard-stat-sub">Good standing</span>
        </div>
      </div>

      <!-- 4. Client Dashboard Overview Card -->
      <div class="card" style="margin-top: 0.5rem; padding: 2rem 2.25rem; border-radius: var(--border-radius-lg);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.25rem; margin-bottom:1.5rem;">
          <div>
            <h3 style="margin:0; font-size:1.35rem; font-weight:750; color:var(--color-primary);">Project Activity Overview</h3>
            <p class="text-muted" style="font-size:0.95rem; margin-top:4px;">Summary of your recent project coordination with FidoConnect.</p>
          </div>
          <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary" onclick="openModal('modal-client-projects')">View All Projects (${clientProjects.length})</button>
            <a href="post-work.html" class="btn btn-primary">+ Post New Project</a>
          </div>
        </div>

        ${clientProjects.length === 0 ? `
          <div class="text-center" style="padding: 3rem 1.5rem; background:var(--bg-subtle); border-radius:var(--border-radius-md); border:1px solid var(--border-color);">
            <svg width="42" height="42" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin:0 auto 1rem; color:var(--text-light);"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <h4 style="font-size:1.15rem; margin-bottom:0.35rem;">No submitted projects yet</h4>
            <p class="text-muted" style="margin:0 0 1.25rem; font-size:0.92rem;">Post your website update, design, documents, or custom business task to get started.</p>
            <a href="post-work.html" class="btn btn-primary">Post a Work</a>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:0.85rem;">
            ${clientProjects.slice(0, 3).map(proj => `
              <div style="padding: 1.15rem 1.35rem; background:var(--bg-subtle); border-radius:var(--border-radius-md); border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; gap:1.25rem; flex-wrap:wrap;">
                <div style="flex:1; min-width:0;">
                  <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.35rem; flex-wrap:wrap;">
                    <span class="project-id-badge">${proj.projectId || proj.id}</span>
                    <span class="project-category-badge">${proj.category}</span>
                    ${getStatusBadge(proj.status)}
                  </div>
                  <strong style="font-size:1.05rem; color:var(--color-primary);">${proj.title}</strong>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:0.9rem; color:var(--text-muted);">Budget: <strong style="color:var(--color-primary);">${proj.budget}</strong></div>
                  <div style="font-size:0.82rem; color:var(--text-muted); margin-top:2px;">Submitted: ${formatDate(proj.createdAt)}</div>
                </div>
              </div>
            `).join("")}
          </div>
        `}
      </div>
    </div>

    <!-- ============================================== -->
    <!-- CLIENT POP-UP MODALS WITH CLOSE BUTTONS -->
    <!-- ============================================== -->

    <!-- Modal 1: Client Projects -->
    <div id="modal-client-projects" class="modal-overlay">
      <div class="modal-card modal-card-lg">
        <button class="modal-close-btn" onclick="closeModal('modal-client-projects')">&times;</button>
        <div class="modal-header-bar">
          <div>
            <div class="modal-header-title">💼 My Submitted Projects (${clientProjects.length})</div>
            <div class="modal-header-sub">Track the progress and agency coordination for all your posted tasks.</div>
          </div>
        </div>

        ${clientProjects.length === 0 ? `
          <div class="text-center" style="padding: 3.5rem 1.5rem; background: var(--bg-subtle); border-radius: var(--border-radius-md); border: 1px solid var(--border-color);">
            <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin:0 auto 1.25rem; color:var(--text-light);"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <h3 style="font-size:1.25rem; margin-bottom:0.4rem;">No submitted projects yet</h3>
            <p class="text-muted" style="margin: 0 0 1.5rem; font-size:0.95rem; max-width:440px; margin-left:auto; margin-right:auto;">Have a website update, design, data entry, or business task you need done?</p>
            <a href="post-work.html" class="btn btn-primary">Post Your First Project</a>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:1.25rem;">
            ${clientProjects.map(proj => `
              <div class="card" style="padding: 1.5rem; border:1px solid var(--border-color); border-radius:var(--border-radius-md);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1.25rem; flex-wrap:wrap;">
                  <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.5rem; flex-wrap:wrap;">
                      <span class="project-id-badge" style="font-size:0.85rem; padding:0.25rem 0.65rem;">${proj.projectId || proj.id}</span>
                      <span class="project-category-badge" style="font-size:0.85rem; padding:0.25rem 0.65rem;">${proj.category}</span>
                      ${getStatusBadge(proj.status)}
                    </div>
                    <h3 style="font-size:1.25rem; font-weight:700; margin-bottom:0.35rem; color:var(--color-primary);">${proj.title}</h3>
                    <p class="text-muted" style="font-size:0.95rem; line-height:1.55;">${proj.description}</p>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:0.95rem; color:var(--text-muted);">Budget: <strong style="color:var(--color-primary);">${proj.budget}</strong></div>
                    <div style="font-size:0.85rem; color:var(--text-muted); margin-top:3px;">Deadline: ${formatDate(proj.deadline)}</div>
                  </div>
                </div>
                <div style="margin-top:1.25rem; padding-top:0.85rem; border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; font-size:0.88rem; color:var(--text-muted); flex-wrap:wrap; gap:0.5rem;">
                  <span>Agency Coordination: <strong style="color:var(--color-primary);">${proj.agencyNotes || "Under review by FidoConnect"}</strong></span>
                  <span>Submitted: ${formatDate(proj.createdAt)}</span>
                </div>
              </div>
            `).join("")}
          </div>
        `}

        <div class="modal-footer-bar">
          <button type="button" class="btn btn-secondary" onclick="closeModal('modal-client-projects')">Close</button>
          <a href="post-work.html" class="btn btn-primary">+ Post Another Project</a>
        </div>
      </div>
    </div>

    <!-- Modal 2: Client Profile -->
    <div id="modal-client-profile" class="modal-overlay">
      <div class="modal-card modal-card-md">
        <button class="modal-close-btn" onclick="closeModal('modal-client-profile')">&times;</button>
        <div class="modal-header-bar">
          <div>
            <div class="modal-header-title">👤 Business Profile & Contact</div>
            <div class="modal-header-sub">Update your organization and communication details.</div>
          </div>
        </div>

        <form id="client-profile-form">
          <div class="form-group">
            <label class="form-label">Contact Name</label>
            <input type="text" id="edit-client-name" class="form-control" value="${currentUser.name || ""}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Business / Organization Name</label>
            <input type="text" id="edit-client-business" class="form-control" value="${currentUser.businessName || ""}" />
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" class="form-control" value="${currentUser.email || ""}" disabled style="background:#f1f5f9;" />
          </div>
          <div class="form-group">
            <label class="form-label">WhatsApp / Phone Number</label>
            <input type="text" id="edit-client-phone" class="form-control" value="${currentUser.phone || ""}" />
          </div>
          
          <div class="modal-footer-bar">
            <button type="button" class="btn btn-secondary" onclick="closeModal('modal-client-profile')">Close</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal 3: Client Settings -->
    <div id="modal-client-settings" class="modal-overlay">
      <div class="modal-card modal-card-md">
        <button class="modal-close-btn" onclick="closeModal('modal-client-settings')">&times;</button>
        <div class="modal-header-bar">
          <div>
            <div class="modal-header-title">⚙️ Account Settings & Security</div>
            <div class="modal-header-sub">Manage your security settings and password recovery.</div>
          </div>
        </div>

        <div class="settings-section-card" style="margin-bottom:1.5rem;">
          <h4 style="margin-bottom: 1rem; font-size:1.15rem; font-weight:750; color:var(--color-primary);">Account Information</h4>
          <div class="settings-meta-item">
            <span class="settings-meta-label">Account Role</span>
            <span class="settings-meta-val">Client / Work Poster</span>
          </div>
          <div class="settings-meta-item">
            <span class="settings-meta-label">Primary Email</span>
            <span class="settings-meta-val">${currentUser.email}</span>
          </div>
          <div class="settings-meta-item">
            <span class="settings-meta-label">User ID</span>
            <span class="settings-meta-val font-mono" style="font-size:0.88rem;">${currentUser.uid}</span>
          </div>
        </div>

        <div class="settings-section-card">
          <h4 style="margin-bottom: 0.4rem; font-size:1.15rem; font-weight:750; color:var(--color-primary);">Password Reset</h4>
          <p class="text-muted" style="font-size:0.92rem; margin-bottom:1.25rem;">Send a secure password reset link to your registered email address.</p>
          <button type="button" class="btn btn-secondary" id="btn-send-reset-client">Send Password Reset Link</button>
        </div>

        <div class="modal-footer-bar">
          <button type="button" class="btn btn-secondary" onclick="closeModal('modal-client-settings')">Close</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("client-logout-btn").addEventListener("click", () => FidoAuth.logout());

  const resetBtn = document.getElementById("btn-send-reset-client");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      try {
        await FidoAuth.resetPassword(currentUser.email);
        showToast("Password reset link sent to " + currentUser.email, "success");
      } catch (err) {
        showToast(err.message || "Failed to send reset link", "error");
      }
    });
  }

  const profForm = document.getElementById("client-profile-form");
  if (profForm) {
    profForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await FidoDB.updateUser(currentUser.uid, {
          name: document.getElementById("edit-client-name").value.trim(),
          businessName: document.getElementById("edit-client-business").value.trim(),
          phone: document.getElementById("edit-client-phone").value.trim()
        });
        showToast("Profile updated successfully", "success");
        closeModal("modal-client-profile");
        await renderClientView(container);
      } catch (err) {
        showToast("Failed to update profile: " + err.message, "error");
      }
    });
  }
}

// 3. Freelancer Account Portal
async function renderFreelancerView(container) {
  const applications = await FidoDB.getApplications({ freelancerId: currentUser.uid });
  const activeProjects = await FidoDB.getProjects({ assignedFreelancerId: currentUser.uid });
  const pendingPayment = await FidoDB.getUserPendingMembershipPayment(currentUser.uid);
  const publishedPlans = await FidoDB.getMembershipPlans(false);
  const isMemberActive = currentUser.membershipStatus === "active";
  const urlParams = new URLSearchParams(window.location.search);
  const returnProject = urlParams.get("return_project");
  const initials = (currentUser.name || "Freelancer").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  container.innerHTML = `
    <div>
      <!-- 1. Profile Header Hero Banner -->
      <div class="dashboard-profile-card">
        <div class="dashboard-user-info">
          <div class="dashboard-avatar">
            ${currentUser.photoURL ? `<img src="${currentUser.photoURL}" alt="${currentUser.name || "Freelancer"}">` : initials}
          </div>
          <div class="dashboard-user-details">
            <div class="dashboard-user-name-row">
              <h1 class="dashboard-user-name">${currentUser.name || "Freelancer"}</h1>
            </div>
            <p class="dashboard-user-email">${currentUser.email}</p>
            <div class="dashboard-badges-row">
              <span class="role-badge role-badge-freelancer">✓ Freelancer</span>
              ${currentUser.inviteVerified ? `<span class="badge badge-active">✓ Verified Member</span>` : `<span class="badge badge-inactive">○ Unverified</span>`}
              ${pendingPayment ? `
                <span class="badge" style="background:#fef3c7; color:#92400e; font-weight:700;">
                  🟡 Verification Pending (${pendingPayment.planName})
                </span>
              ` : `
                <span class="badge ${isMemberActive ? "badge-active" : "badge-inactive"}">
                  ${isMemberActive ? `⭐ ${currentUser.membershipPlan || "Selected Basic"}` : "○ Inactive Membership"}
                </span>
              `}
            </div>
          </div>
        </div>
        <div class="dashboard-header-actions">
          <button type="button" class="btn btn-secondary" onclick="openSkillProfileModal()">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
            Edit Skills & Bio
          </button>
          <button id="freelancer-logout-btn" class="btn btn-secondary">Sign Out</button>
        </div>
      </div>

      <!-- 2. Account Action Buttons Grid (Sitting ABOVE Stats) -->
      <div class="account-action-grid">
        <div class="account-action-card" onclick="openModal('modal-freelancer-apps')">
          <div>
            <div class="account-action-card-head">
              <span class="account-action-card-title">📋 My Applications</span>
              <span class="account-action-card-badge">${applications.length}</span>
            </div>
            <p class="account-action-card-desc">Track submitted proposals and live review status.</p>
          </div>
          <div class="account-action-card-arrow">View Applications &rarr;</div>
        </div>

        <div class="account-action-card" onclick="openModal('modal-freelancer-projects')">
          <div>
            <div class="account-action-card-head">
              <span class="account-action-card-title">💼 Assigned Projects</span>
              <span class="account-action-card-badge">${activeProjects.length}</span>
            </div>
            <p class="account-action-card-desc">Active client tasks currently assigned to you.</p>
          </div>
          <div class="account-action-card-arrow">View Projects &rarr;</div>
        </div>

        <div class="account-action-card" onclick="openModal('modal-membership')">
          <div>
            <div class="account-action-card-head">
              <span class="account-action-card-title">⭐ Membership</span>
              <span class="account-action-card-badge" style="${pendingPayment ? 'background:#fef3c7; color:#92400e;' : ''}">${pendingPayment ? "Pending" : (isMemberActive ? "Active" : "Plans")}</span>
            </div>
            <p class="account-action-card-desc">Manage your Selected Freelancer membership plan.</p>
          </div>
          <div class="account-action-card-arrow">Manage Plan &rarr;</div>
        </div>

        <div class="account-action-card" onclick="openModal('modal-freelancer-profile')">
          <div>
            <div class="account-action-card-head">
              <span class="account-action-card-title">👤 Profile & Skills</span>
              <span class="account-action-card-badge">${currentUser.profileCompleted ? "✓" : "!"}</span>
            </div>
            <p class="account-action-card-desc">Your verified categories, tools, and contact info.</p>
          </div>
          <div class="account-action-card-arrow">View Profile &rarr;</div>
        </div>

        <div class="account-action-card" onclick="openModal('modal-freelancer-settings')">
          <div>
            <div class="account-action-card-head">
              <span class="account-action-card-title">⚙️ Account Settings</span>
            </div>
            <p class="account-action-card-desc">Account credentials, preferences, and password.</p>
          </div>
          <div class="account-action-card-arrow">Settings &rarr;</div>
        </div>
      </div>

      <!-- 3. Quick Stats Area (Sitting BELOW Buttons) -->
      <div class="dashboard-stats-grid">
        <div class="dashboard-stat-card">
          <span class="dashboard-stat-label">Membership</span>
          <span class="dashboard-stat-value" style="font-size:1.25rem; ${pendingPayment ? 'color:#d97706;' : ''}">${pendingPayment ? "Pending Verification" : (isMemberActive ? (currentUser.membershipPlan || "Selected Basic") : "No Plan")}</span>
          <span class="dashboard-stat-sub">
            ${pendingPayment ? `<span style="color:#d97706;">●</span> Verification in progress` : (isMemberActive ? `<span class="stat-dot-active">●</span> Active membership` : `<span class="stat-dot-inactive">●</span> Inactive membership`)}
          </span>
        </div>
        <div class="dashboard-stat-card">
          <span class="dashboard-stat-label">Member Status</span>
          <span class="dashboard-stat-value" style="${isMemberActive ? "color:#10b981;" : (pendingPayment ? "color:#d97706;" : "color:var(--text-muted);")}">${isMemberActive ? "Active" : (pendingPayment ? "In Review" : "Inactive")}</span>
          <span class="dashboard-stat-sub">${isMemberActive ? "Eligible to apply" : (pendingPayment ? "Payment under review" : "Upgrade to apply")}</span>
        </div>
        <div class="dashboard-stat-card">
          <span class="dashboard-stat-label">Applications</span>
          <span class="dashboard-stat-value" style="color:var(--color-accent);">${applications.length}</span>
          <span class="dashboard-stat-sub">${applications.length === 1 ? "1 proposal submitted" : `${applications.length} proposals submitted`}</span>
        </div>
        <div class="dashboard-stat-card">
          <span class="dashboard-stat-label">Assigned Projects</span>
          <span class="dashboard-stat-value">${activeProjects.length}</span>
          <span class="dashboard-stat-sub">${activeProjects.length === 0 ? "No active jobs" : `${activeProjects.length} in execution`}</span>
        </div>
        <div class="dashboard-stat-card">
          <span class="dashboard-stat-label">Skill Profile</span>
          <span class="dashboard-stat-value" style="color:${currentUser.profileCompleted ? "#10b981" : "#f59e0b"};">${currentUser.profileCompleted ? "Verified" : "Incomplete"}</span>
          <span class="dashboard-stat-sub">${currentUser.profileCompleted ? "✓ Skills unlocked" : "Setup required"}</span>
        </div>
      </div>

      <!-- 4. Freelancer Dashboard Overview & Activity Card -->
      <div class="card" style="margin-top: 0.5rem; padding: 2rem 2.25rem; border-radius: var(--border-radius-lg);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.25rem; margin-bottom:1.5rem;">
          <div>
            <h3 style="margin:0; font-size:1.35rem; font-weight:750; color:var(--color-primary);">Selected Freelancer Status</h3>
            <p class="text-muted" style="font-size:0.95rem; margin-top:4px;">Your verified skills match eligible opportunities on FidoConnect.</p>
          </div>
          <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary" onclick="openModal('modal-freelancer-apps')">
              My Applications (${applications.length})
            </button>
            <a href="find-work.html" class="btn btn-primary">
              Find Matching Work &rarr;
            </a>
          </div>
        </div>

        <div class="grid-2" style="gap:1.5rem;">
          <!-- Skill Summary Preview -->
          <div style="background:var(--bg-subtle); padding:1.5rem; border-radius:var(--border-radius-md); border:1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                <span style="font-size:0.8rem; text-transform:uppercase; font-weight:700; letter-spacing:0.05em; color:var(--text-muted);">Verified Categories</span>
                <button type="button" class="btn btn-link btn-sm" style="padding:0; font-size:0.85rem; font-weight:600; color:var(--color-accent); text-decoration:none; cursor:pointer;" onclick="openSkillProfileModal()">Edit Skills &rarr;</button>
              </div>
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.85rem;">
                ${(currentUser.categories || []).map(cat => `<span class="badge badge-active" style="padding:0.35rem 0.75rem; font-size:0.85rem;">${cat}</span>`).join("") || '<span class="text-muted" style="font-size:0.9rem;">No categories selected yet</span>'}
              </div>
              ${currentUser.bio ? `
                <div style="font-size:0.88rem; color:var(--color-primary-muted); line-height:1.5; font-style:italic; border-top:1px solid var(--border-color); padding-top:0.75rem; margin-top:0.5rem;">
                  "${currentUser.bio.length > 140 ? currentUser.bio.slice(0, 140) + '...' : currentUser.bio}"
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Membership Plan Preview -->
          <div style="background:var(--bg-subtle); padding:1.5rem; border-radius:var(--border-radius-md); border:1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="font-size:0.8rem; text-transform:uppercase; font-weight:700; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:0.5rem;">Membership Overview</div>
              
              ${pendingPayment ? `
                <div style="background:#fef3c7; border:1px solid #fde68a; border-radius:var(--border-radius-sm); padding:0.85rem 1rem; margin-bottom:0.75rem;">
                  <div style="font-weight:750; font-size:0.95rem; color:#92400e; margin-bottom:0.25rem;">
                    🟡 Payment Verification Pending
                  </div>
                  <div style="font-size:0.85rem; color:#78350f; line-height:1.45;">
                    UPI payment of <strong>₹${pendingPayment.amount}</strong> for <strong>${pendingPayment.planName}</strong> (Txn: <code>${pendingPayment.transactionId}</code>) is being verified.
                  </div>
                </div>
              ` : `
                <div style="font-size:1.35rem; font-weight:800; color:var(--color-primary); margin-bottom:0.35rem;">
                  ${isMemberActive ? `⭐ ${currentUser.membershipPlan || "Selected Basic"}` : "No Active Membership"}
                </div>
                <p style="font-size:0.9rem; color:var(--color-primary-muted); margin:0; line-height:1.5;">
                  ${isMemberActive ? `Your membership is active until <strong>${formatDate(currentUser.membershipExpiry)}</strong>. You can apply to matching project opportunities.` : "Activate a membership plan to unlock application submission for matching projects."}
                </p>
              `}
            </div>
            <div style="margin-top:1.25rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
              ${pendingPayment ? `
                <a href="payment.html" class="btn btn-primary btn-sm">View Payment Status &rarr;</a>
              ` : `
                <button type="button" class="btn ${isMemberActive ? 'btn-secondary' : 'btn-primary'}" onclick="openModal('modal-membership')">
                  ${isMemberActive ? 'View Plan Details' : 'Choose a Membership Plan &rarr;'}
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================== -->
    <!-- FREELANCER POP-UP MODALS WITH CLOSE BUTTONS -->
    <!-- ============================================== -->

    <!-- Modal 1: My Applications -->
    <div id="modal-freelancer-apps" class="modal-overlay">
      <div class="modal-card modal-card-lg">
        <button class="modal-close-btn" onclick="closeModal('modal-freelancer-apps')">&times;</button>
        <div class="modal-header-bar">
          <div>
            <div class="modal-header-title">📋 My Submitted Applications (${applications.length})</div>
            <div class="modal-header-sub">Track the status and timeline of all project proposals you have submitted.</div>
          </div>
        </div>

        ${applications.length === 0 ? `
          <div class="text-center" style="padding: 3.5rem 1.5rem; background: var(--bg-subtle); border-radius: var(--border-radius-md); border: 1px solid var(--border-color);">
            <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin:0 auto 1.25rem; color:var(--text-light);"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            <h3 style="font-size:1.25rem; margin-bottom:0.4rem;">No active applications</h3>
            <p class="text-muted" style="margin: 0 0 1.5rem; font-size:0.95rem; max-width:440px; margin-left:auto; margin-right:auto;">Matching client opportunities will appear in Find Work as they are vetted by our agency.</p>
            <a href="find-work.html" class="btn btn-primary">Find Available Work</a>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:1.25rem;">
            ${applications.map(app => {
              const isActionable = !["Rejected", "Withdrawn", "Closed", "Completed", "Cancelled"].includes(app.status);
              return `
                <div class="card" style="padding: 1.5rem; border:1px solid var(--border-color); border-radius:var(--border-radius-md);">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1.25rem; flex-wrap:wrap;">
                    <div style="flex:1; min-width:0;">
                      <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.5rem; flex-wrap:wrap;">
                        <span class="project-id-badge" style="font-size:0.85rem; padding:0.25rem 0.65rem;">${app.projectId}</span>
                        ${getStatusBadge(app.status)}
                      </div>
                      <p style="font-size:1rem; margin-top:0.5rem; line-height:1.55; color:var(--text-main);">"${app.message}"</p>
                      <div style="font-size:0.9rem; color:var(--text-muted); margin-top:0.6rem;">
                        Estimated Delivery: <strong style="color:var(--color-primary);">${app.deliveryDays}</strong>
                      </div>
                    </div>
                    <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:0.75rem;">
                      <span style="font-size:0.85rem; color:var(--text-muted);">Applied: ${formatDate(app.createdAt)}</span>
                      <div style="display:flex; gap:0.6rem; flex-wrap:wrap; justify-content:flex-end;">
                        <a href="project-details.html?id=${app.projectId}" class="btn btn-secondary">View Project</a>
                        ${isActionable ? `
                          <button type="button" class="btn" style="color:var(--status-cancelled); border:1px solid var(--border-color); background:var(--bg-surface);" onclick="handleWithdrawApplication('${app.id}')">
                            Withdraw
                          </button>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `}

        <div class="modal-footer-bar">
          <button type="button" class="btn btn-secondary" onclick="closeModal('modal-freelancer-apps')">Close</button>
          <a href="find-work.html" class="btn btn-primary">Find Available Work</a>
        </div>
      </div>
    </div>

    <!-- Modal 2: Assigned Projects -->
    <div id="modal-freelancer-projects" class="modal-overlay">
      <div class="modal-card modal-card-lg">
        <button class="modal-close-btn" onclick="closeModal('modal-freelancer-projects')">&times;</button>
        <div class="modal-header-bar">
          <div>
            <div class="modal-header-title">💼 Assigned Projects (${activeProjects.length})</div>
            <div class="modal-header-sub">Projects currently assigned to you for execution with FidoConnect coordination.</div>
          </div>
        </div>

        ${activeProjects.length === 0 ? `
          <div class="text-center" style="padding: 3.5rem 1.5rem; background: var(--bg-subtle); border-radius: var(--border-radius-md); border: 1px solid var(--border-color);">
            <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin:0 auto 1.25rem; color:var(--text-light);"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            <h3 style="font-size:1.25rem; margin-bottom:0.4rem;">No assigned projects yet</h3>
            <p class="text-muted" style="margin: 0 0 1.5rem; font-size:0.95rem; max-width:440px; margin-left:auto; margin-right:auto;">Selected projects matching your verified skills will appear here once approved by our agency team.</p>
            <a href="find-work.html" class="btn btn-secondary">Browse Open Projects</a>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:1.25rem;">
            ${activeProjects.map(proj => `
              <div class="card" style="padding: 1.5rem; border:1px solid var(--border-color); border-radius:var(--border-radius-md);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1.25rem; flex-wrap:wrap;">
                  <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.5rem; flex-wrap:wrap;">
                      <span class="project-id-badge" style="font-size:0.85rem; padding:0.25rem 0.65rem;">${proj.projectId || proj.id}</span>
                      <span class="project-category-badge" style="font-size:0.85rem; padding:0.25rem 0.65rem;">${proj.category}</span>
                      ${getStatusBadge(proj.status)}
                    </div>
                    <h3 style="font-size:1.25rem; font-weight:700; margin-bottom:0.35rem; color:var(--color-primary);">${proj.title}</h3>
                    <p class="text-muted" style="font-size:0.95rem; line-height:1.55;">${proj.description}</p>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:0.95rem; color:var(--text-muted);">Budget: <strong style="color:var(--color-primary);">${proj.budget}</strong></div>
                    <div style="font-size:0.85rem; color:var(--text-muted); margin-top:3px;">Deadline: ${formatDate(proj.deadline)}</div>
                  </div>
                </div>
                <div style="margin-top:1.25rem; padding-top:0.85rem; border-top:1px solid var(--border-color); font-size:0.88rem; color:var(--text-muted);">
                  Agency Notes: <strong style="color:var(--color-primary);">${proj.agencyNotes || "In progress"}</strong>
                </div>
              </div>
            `).join("")}
          </div>
        `}

        <div class="modal-footer-bar">
          <button type="button" class="btn btn-secondary" onclick="closeModal('modal-freelancer-projects')">Close</button>
          <a href="find-work.html" class="btn btn-primary">Browse Open Projects</a>
        </div>
      </div>
    </div>

    <!-- Modal 3: Membership Plans -->
    <div id="modal-membership" class="modal-overlay">
      <div class="modal-card modal-card-lg">
        <button class="modal-close-btn" onclick="closeModal('modal-membership')">&times;</button>
        
        <!-- Modal Header -->
        <div class="modal-header-bar">
          <div>
            <div style="display:inline-flex; align-items:center; gap:6px; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.06em; font-weight:700; color:var(--color-accent); margin-bottom:0.35rem;">
              <span style="width:8px; height:8px; border-radius:50%; background:var(--color-accent);"></span>
              Selected Freelancer Program
            </div>
            <div class="modal-header-title">⭐ Plans for Selected Members</div>
            <div class="modal-header-sub">FidoConnect memberships are available to selected freelancers through our invite-only program.</div>
          </div>
        </div>

        <!-- Current Membership Banner / Pending Payment / Project Return Prompt -->
        ${pendingPayment ? `
          <div class="card" style="border: 2px solid #f59e0b; background-color: #fffbeb; margin-bottom: 1.75rem; padding: 1.5rem 1.75rem; border-radius:var(--border-radius-lg);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.25rem;">
              <div>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#f59e0b;"></span>
                  <span style="font-size:0.85rem; text-transform:uppercase; font-weight:750; color:#d97706; letter-spacing:0.04em;">🟡 Payment Verification Pending</span>
                </div>
                <div style="font-size:1.5rem; font-weight:800; color:var(--color-primary); margin-top:4px;">
                  ${pendingPayment.planName} (₹${pendingPayment.amount})
                </div>
                <div style="font-size:0.92rem; color:var(--color-primary-muted); margin-top:4px;">
                  Transaction ID / UTR: <strong class="font-mono">${pendingPayment.transactionId}</strong> &bull; Submitted ${formatDate(pendingPayment.submittedAt || pendingPayment.createdAt)}
                </div>
              </div>
              <div>
                <a href="payment.html" class="btn btn-primary btn-lg">
                  View Payment Status &rarr;
                </a>
              </div>
            </div>
          </div>
        ` : (isMemberActive ? `
          <div class="card" style="border: 2px solid var(--color-teal); background-color: var(--color-teal-soft); margin-bottom: 1.75rem; padding: 1.5rem 1.75rem; border-radius:var(--border-radius-lg);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.25rem;">
              <div>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--color-teal);"></span>
                  <span style="font-size:0.85rem; text-transform:uppercase; font-weight:750; color:var(--color-teal); letter-spacing:0.04em;">Current Active Membership</span>
                </div>
                <div style="font-size:1.5rem; font-weight:800; color:var(--color-primary); margin-top:4px;">
                  ${currentUser.membershipPlan || "Selected Basic"}
                </div>
                <div style="font-size:0.92rem; color:var(--color-primary-muted); margin-top:4px;">
                  Active until <strong>${formatDate(currentUser.membershipExpiry)}</strong>. You can apply to matching project opportunities.
                </div>
              </div>
              ${returnProject ? `
                <div>
                  <a href="project-details.html?id=${encodeURIComponent(returnProject)}&from_plan=true" class="btn btn-primary btn-lg">
                    Return to Project (${returnProject}) & Complete Application &rarr;
                  </a>
                </div>
              ` : ''}
            </div>
          </div>
        ` : (returnProject ? `
          <div class="notice-box notice-warning" style="margin-bottom: 1.75rem; padding: 1.25rem 1.5rem;">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:24px; height:24px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <div style="font-size:0.95rem;">
              <strong>Application Ready for Project ${returnProject}:</strong> Activate a membership below to submit your prepared proposal.
            </div>
          </div>
        ` : ''))}

        <!-- Database-Driven Membership Plans Grid -->
        <div class="plans-grid">
          ${publishedPlans.length === 0 ? `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
              No membership plans are currently published. Please check back shortly.
            </div>
          ` : publishedPlans.map(plan => {
            const isCurrentPlan = isMemberActive && (currentUser.membershipPlan === plan.name);
            const priceDisplay = plan.priceDisplay || `₹${(plan.price || plan.priceAmount || 0).toLocaleString("en-IN")}`;
            const durationDisplay = plan.billingCycle || `/ ${plan.duration || "month"}`;
            const features = Array.isArray(plan.features) ? plan.features : [];
            const buttonText = plan.buttonText || `Choose ${plan.name.replace('Selected ', '')}`;

            return `
              <div class="plan-card ${plan.isRecommended ? "plan-card-recommended" : ""}">
                ${plan.isRecommended ? `<div class="plan-badge-recommended">${plan.badge || "Recommended for New Members"}</div>` : ""}

                <div class="plan-header">
                  <span class="plan-tagline">${plan.tagline || ""}</span>
                  <h3 class="plan-title">${plan.name}</h3>
                  <div class="plan-price-wrap">
                    <span class="plan-price">${priceDisplay}</span>
                    <span class="plan-period">${durationDisplay}</span>
                  </div>
                  <p class="plan-desc">${plan.description || ""}</p>
                </div>

                <ul class="plan-features-list">
                  ${features.map(f => `
                    <li class="plan-feature-item">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                      <span>${f}</span>
                    </li>
                  `).join("")}
                </ul>

                <button 
                  type="button" 
                  id="btn-plan-${plan.id}" 
                  class="btn ${plan.isRecommended ? "btn-primary" : "btn-secondary"} plan-cta-btn"
                  onclick="handleActivatePlan('${plan.id}')"
                  ${isCurrentPlan ? "disabled" : ""}
                >
                  ${isCurrentPlan ? "✓ Current Active Plan" : (isMemberActive ? 'Switch to ' + plan.name.replace('Selected ', '') : buttonText)}
                </button>
              </div>
            `;
          }).join("")}
        </div>

        <!-- 4-Step Process Section -->
        <div style="margin-top: 2.5rem; margin-bottom: 2rem;">
          <h4 style="font-size: 1.3rem; font-weight:750; margin-bottom: 0.4rem; color:var(--color-primary);">How FidoConnect Membership Works</h4>
          <p class="text-muted" style="font-size: 0.95rem; margin-bottom: 1.25rem;">Our invite-only process connects verified professionals with vetted agency opportunities.</p>
          
          <div class="membership-steps-grid">
            <div class="membership-step-card">
              <div class="membership-step-number">1</div>
              <div class="membership-step-title">Invited</div>
              <p class="membership-step-desc">You receive an exclusive invitation to join our curated network.</p>
            </div>
            <div class="membership-step-card">
              <div class="membership-step-number">2</div>
              <div class="membership-step-title">Verified</div>
              <p class="membership-step-desc">Your freelancer profile and skills are reviewed.</p>
            </div>
            <div class="membership-step-card">
              <div class="membership-step-number">3</div>
              <div class="membership-step-title">Selected</div>
              <p class="membership-step-desc">You can access projects that match your verified skills.</p>
            </div>
            <div class="membership-step-card">
              <div class="membership-step-number">4</div>
              <div class="membership-step-title">Member</div>
              <p class="membership-step-desc">Activate a membership to submit applications and participate in selected project opportunities.</p>
            </div>
          </div>
        </div>

        <!-- Transparent Trust Section ("Before you join") -->
        <div class="card" style="background-color: var(--bg-subtle); border-left: 4px solid var(--color-accent); padding: 1.5rem; border-radius:var(--border-radius-md);">
          <h5 style="font-size: 1.05rem; font-weight:750; margin-bottom: 0.4rem; color: var(--color-primary);">Before you join</h5>
          <p style="font-size: 0.92rem; line-height: 1.6; color: var(--color-primary-muted); margin: 0;">
            FidoConnect membership provides access to eligible project opportunities. Project availability depends on client demand, project requirements, skill match, and agency selection. Membership does not guarantee a specific project, income, or number of completed jobs.
          </p>
        </div>

        <div class="modal-footer-bar">
          <button type="button" class="btn btn-secondary" onclick="closeModal('modal-membership')">Close</button>
        </div>
      </div>
    </div>

    <!-- Modal 4: Profile & Skills -->
    <div id="modal-freelancer-profile" class="modal-overlay">
      <div class="modal-card modal-card-md">
        <button class="modal-close-btn" onclick="closeModal('modal-freelancer-profile')">&times;</button>
        <div class="modal-header-bar">
          <div>
            <div class="modal-header-title">👤 Verified Skill Profile & Contact</div>
            <div class="modal-header-sub">Your verified skills determine which projects are unlocked in Find Work.</div>
          </div>
        </div>

        <div class="card" style="border:1px solid var(--border-color); margin-bottom: 1.5rem; padding: 1.5rem; border-radius:var(--border-radius-md);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.25rem; flex-wrap:wrap; gap:0.75rem;">
            <strong style="font-size:1.1rem; color:var(--color-primary);">Skills & Services</strong>
            <button type="button" class="btn btn-secondary btn-sm" onclick="openSkillProfileModal()">
              Edit Skills & Bio
            </button>
          </div>

          ${currentUser.profileCompleted ? `
            <div style="display:flex; flex-direction:column; gap:1rem; background:var(--bg-subtle); padding:1.25rem; border-radius:var(--border-radius-md); border:1px solid var(--border-color);">
              <div>
                <div style="font-size:0.78rem; text-transform:uppercase; font-weight:700; letter-spacing:0.04em; color:var(--text-muted); margin-bottom:0.4rem;">Primary Categories</div>
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                  ${(currentUser.categories || []).map(cat => `<span class="badge badge-active" style="font-size:0.85rem; padding:0.3rem 0.75rem;">${cat}</span>`).join("") || '<span class="text-muted">None selected</span>'}
                </div>
              </div>

              ${(currentUser.subcategories && currentUser.subcategories.length > 0) ? `
                <div>
                  <div style="font-size:0.78rem; text-transform:uppercase; font-weight:700; letter-spacing:0.04em; color:var(--text-muted); margin-bottom:0.4rem;">Skills & Tools</div>
                  <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                    ${currentUser.subcategories.map(sub => `<span class="badge badge-inactive" style="font-size:0.82rem; padding:0.25rem 0.65rem;">${sub}</span>`).join("")}
                  </div>
                </div>
              ` : ""}

              ${currentUser.customSkills ? `
                <div>
                  <div style="font-size:0.78rem; text-transform:uppercase; font-weight:700; letter-spacing:0.04em; color:var(--text-muted); margin-bottom:0.4rem;">Custom Skills</div>
                  <p style="font-size:0.92rem; margin:0; color:var(--color-primary);">${currentUser.customSkills}</p>
                </div>
              ` : ""}

              <div>
                <div style="font-size:0.78rem; text-transform:uppercase; font-weight:700; letter-spacing:0.04em; color:var(--text-muted); margin-bottom:0.4rem;">About You / Introduction</div>
                <p style="font-size:0.92rem; line-height:1.55; margin:0; font-style:italic; color:var(--color-primary-muted);">
                  ${currentUser.bio ? `"${currentUser.bio}"` : '<span class="text-muted">No introduction provided yet.</span>'}
                </p>
              </div>
            </div>
          ` : `
            <div class="notice-box notice-warning" style="margin-bottom:1.25rem;">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              <div>
                <strong>Skill profile incomplete:</strong> Complete your skill profile to unlock matching projects in Find Work.
              </div>
            </div>
            <button type="button" class="btn btn-primary" onclick="openSkillProfileModal()">
              Complete Skill Profile Now
            </button>
          `}
        </div>

        <form id="freelancer-profile-form">
          <h4 style="font-size:1.15rem; font-weight:750; margin-bottom: 1.25rem; color:var(--color-primary);">Contact Information</h4>
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="edit-free-name" class="form-control" value="${currentUser.name || ""}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" class="form-control" value="${currentUser.email || ""}" disabled style="background:#f1f5f9;" />
          </div>
          <div class="form-group">
            <label class="form-label">WhatsApp / Phone</label>
            <input type="text" id="edit-free-phone" class="form-control" value="${currentUser.phone || ""}" />
          </div>
          <div class="form-group">
            <label class="form-label">Portfolio / GitHub / Dribbble Link</label>
            <input type="url" id="edit-free-portfolio" class="form-control" placeholder="https://yourportfolio.com" value="${currentUser.portfolio || ""}" />
          </div>
          <div class="modal-footer-bar">
            <button type="button" class="btn btn-secondary" onclick="closeModal('modal-freelancer-profile')">Close</button>
            <button type="submit" class="btn btn-primary">Save Personal Details</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal 5: Account Settings -->
    <div id="modal-freelancer-settings" class="modal-overlay">
      <div class="modal-card modal-card-md">
        <button class="modal-close-btn" onclick="closeModal('modal-freelancer-settings')">&times;</button>
        <div class="modal-header-bar">
          <div>
            <div class="modal-header-title">⚙️ Account Settings & Security</div>
            <div class="modal-header-sub">Manage your account preferences and security options.</div>
          </div>
        </div>

        <div class="settings-section-card" style="margin-bottom:1.5rem;">
          <h4 style="margin-bottom: 1rem; font-size:1.15rem; font-weight:750; color:var(--color-primary);">Account Preferences</h4>
          <div class="settings-meta-item">
            <span class="settings-meta-label">Account Role</span>
            <span class="settings-meta-val">Selected Freelancer</span>
          </div>
          <div class="settings-meta-item">
            <span class="settings-meta-label">Invite Verification</span>
            <span class="settings-meta-val">${currentUser.inviteVerified ? "✓ Verified Member" : "Unverified"}</span>
          </div>
          <div class="settings-meta-item">
            <span class="settings-meta-label">Membership Status</span>
            <span class="settings-meta-val">${isMemberActive ? `${currentUser.membershipPlan || "Active"} (Valid until ${formatDate(currentUser.membershipExpiry)})` : "Inactive"}</span>
          </div>
          <div class="settings-meta-item">
            <span class="settings-meta-label">Primary Email</span>
            <span class="settings-meta-val">${currentUser.email}</span>
          </div>
          <div class="settings-meta-item">
            <span class="settings-meta-label">Freelancer ID</span>
            <span class="settings-meta-val font-mono" style="font-size:0.88rem;">${currentUser.uid}</span>
          </div>
        </div>

        <div class="settings-section-card">
          <h4 style="margin-bottom: 0.4rem; font-size:1.15rem; font-weight:750; color:var(--color-primary);">Password & Security</h4>
          <p class="text-muted" style="font-size:0.92rem; margin-bottom:1.25rem;">Request a password reset link sent directly to your registered email address.</p>
          <button type="button" class="btn btn-secondary" id="btn-send-reset-free">Send Password Reset Link</button>
        </div>

        <div class="modal-footer-bar">
          <button type="button" class="btn btn-secondary" onclick="closeModal('modal-freelancer-settings')">Close</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("freelancer-logout-btn").addEventListener("click", () => FidoAuth.logout());

  const resetBtn = document.getElementById("btn-send-reset-free");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      try {
        await FidoAuth.resetPassword(currentUser.email);
        showToast("Password reset link sent to " + currentUser.email, "success");
      } catch (err) {
        showToast(err.message || "Failed to send reset link", "error");
      }
    });
  }

  const profForm = document.getElementById("freelancer-profile-form");
  if (profForm) {
    profForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await FidoDB.updateUser(currentUser.uid, {
          name: document.getElementById("edit-free-name").value.trim(),
          phone: document.getElementById("edit-free-phone").value.trim(),
          portfolio: document.getElementById("edit-free-portfolio").value.trim()
        });
        showToast("Profile updated successfully", "success");
        closeModal("modal-freelancer-profile");
        await renderFreelancerView(container);
      } catch (err) {
        showToast("Failed to update profile: " + err.message, "error");
      }
    });
  }
}

window.handleActivatePlan = function(planId) {
  if (!currentUser) return;
  const urlParams = new URLSearchParams(window.location.search);
  const returnProject = urlParams.get("return_project");

  let targetUrl = `payment.html?plan=${encodeURIComponent(planId)}`;
  if (returnProject) {
    targetUrl += `&return_project=${encodeURIComponent(returnProject)}`;
  }
  window.location.href = targetUrl;
};

window.handleWithdrawApplication = async function(appId) {
  if (!confirm("Are you sure you want to withdraw this application? This will allow you to apply for other matching projects.")) {
    return;
  }

  try {
    await FidoDB.withdrawApplication(appId, currentUser.uid);
    showToast("Application withdrawn. You can now apply for other projects.", "success");
    await renderAccountView();
  } catch (err) {
    showToast("Failed to withdraw application: " + err.message, "error");
  }
};

// --- Skill Profile Modal Setup & Handlers for Account Page ---
function setupSkillProfileModal() {
  const categoryOptions = document.querySelectorAll(".skill-category-option");
  categoryOptions.forEach(opt => {
    const checkbox = opt.querySelector("input[type='checkbox']");
    if (!checkbox) return;

    checkbox.addEventListener("change", () => {
      const cat = checkbox.value;
      if (checkbox.checked) {
        opt.classList.add("selected");
        selectedModalCategories.add(cat);
      } else {
        opt.classList.remove("selected");
        selectedModalCategories.delete(cat);
        const subList = SKILL_TAXONOMY[cat] || [];
        subList.forEach(s => selectedModalSubcategories.delete(s));
      }
      renderModalSubcategories();
    });
  });

  const skillForm = document.getElementById("skill-profile-form");
  if (skillForm) {
    skillForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = FidoAuth.getCurrentUser();
      if (!user) return;

      if (selectedModalCategories.size === 0) {
        showToast("Please select at least one primary service category.", "error");
        return;
      }

      const bio = document.getElementById("modalBioInput").value.trim();
      if (!bio) {
        showToast("Please write a short introduction about yourself.", "error");
        return;
      }

      const customSkillsInput = document.getElementById("modalCustomSkillsInput");
      const customSkills = customSkillsInput ? customSkillsInput.value.trim() : "";

      const categories = Array.from(selectedModalCategories);
      const subcategories = Array.from(selectedModalSubcategories);

      const submitBtn = document.getElementById("modalSaveSkillsBtn");
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving Skills...";

      try {
        await FidoDB.saveSkillProfile(user.uid, {
          categories,
          subcategories,
          bio,
          customSkills
        });

        closeModal("skill-profile-modal");
        showToast("Skill profile updated successfully!", "success");

        currentUser = FidoAuth.getCurrentUser();
        await renderAccountView();
      } catch (err) {
        showToast(err.message || "Failed to save skill profile.", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Save & Continue";
      }
    });
  }
}

function renderModalSubcategories() {
  const container = document.getElementById("modal-subcategories-container");
  const wrapper = document.getElementById("subcategories-wrapper");
  const customGroup = document.getElementById("custom-skills-group");
  if (!container || !wrapper) return;

  if (selectedModalCategories.size === 0) {
    wrapper.style.display = "none";
    if (customGroup) customGroup.style.display = "none";
    container.innerHTML = "";
    return;
  }

  wrapper.style.display = "block";
  let hasOther = selectedModalCategories.has("Other");

  let html = "";
  selectedModalCategories.forEach(cat => {
    const subList = SKILL_TAXONOMY[cat] || [];
    if (subList.length === 0) return;

    html += `
      <div class="subcategory-group">
        <div class="subcategory-group-title">${cat} Skills & Tools</div>
        <div class="subcategory-chips-wrap">
          ${subList.map(sub => {
            const isSelected = selectedModalSubcategories.has(sub);
            if (sub === "Other") hasOther = true;
            return `
              <button type="button" class="skill-chip ${isSelected ? "selected" : ""}" data-category="${cat}" data-sub="${sub}">
                ${isSelected ? "✓ " : "+ "}${sub}
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  if (customGroup) {
    customGroup.style.display = hasOther ? "block" : "none";
  }

  container.querySelectorAll(".skill-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const sub = chip.getAttribute("data-sub");
      if (selectedModalSubcategories.has(sub)) {
        selectedModalSubcategories.delete(sub);
        chip.classList.remove("selected");
        chip.textContent = `+ ${sub}`;
      } else {
        selectedModalSubcategories.add(sub);
        chip.classList.add("selected");
        chip.textContent = `✓ ${sub}`;
      }
    });
  });
}

export function openSkillProfileModal() {
  const user = FidoAuth.getCurrentUser();

  selectedModalCategories = new Set(user && Array.isArray(user.categories) ? user.categories : []);
  selectedModalSubcategories = new Set(user && Array.isArray(user.subcategories) ? user.subcategories : []);

  document.querySelectorAll(".skill-category-option").forEach(opt => {
    const checkbox = opt.querySelector("input[type='checkbox']");
    if (checkbox) {
      const isChecked = selectedModalCategories.has(checkbox.value);
      checkbox.checked = isChecked;
      if (isChecked) opt.classList.add("selected");
      else opt.classList.remove("selected");
    }
  });

  const bioInput = document.getElementById("modalBioInput");
  if (bioInput) bioInput.value = (user && user.bio) || "";

  const customSkillsInput = document.getElementById("modalCustomSkillsInput");
  if (customSkillsInput) customSkillsInput.value = (user && user.customSkills) || "";

  renderModalSubcategories();
  openModal("skill-profile-modal");
}
window.openSkillProfileModal = openSkillProfileModal;
