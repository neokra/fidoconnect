/**
 * FidoConnect - Account Management Controller
 * 
 * Manages Client, Freelancer, and Administrator account portals.
 */

import { FidoAuth } from "./auth.js";
import { FidoDB } from "./db.js";

let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  const isAuth = await FidoAuth.requireAuth();
  if (!isAuth) return;

  currentUser = FidoAuth.getCurrentUser();
  await renderAccountView();
  setupEventListeners();

  FidoAuth.onAuthChange(async (user) => {
    if (user) {
      currentUser = user;
      await renderAccountView();
    }
  });
});

function setupEventListeners() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const target = btn.getAttribute("data-tab");
      const pane = document.getElementById(target);
      if (pane) pane.classList.add("active");
    });
  });

  if (window.location.hash) {
    const tabName = window.location.hash.replace("#", "") + "-tab";
    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.click();
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
}

// 1. Administrator Account Portal
async function renderAdminAccountView(container) {
  const stats = await FidoDB.getDashboardStats();

  container.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
        <div>
          <h2>${currentUser.name || "Administrator"}</h2>
          <p class="text-muted">${currentUser.email} • Designated FidoConnect Administrator</p>
        </div>
        <div>
          <button id="admin-account-logout-btn" class="btn btn-secondary btn-sm">Sign Out</button>
        </div>
      </div>
    </div>

    <!-- Admin Panel Card -->
    <div class="card" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 2rem; border-radius: var(--border-radius-lg); margin-bottom: 2rem; box-shadow: var(--shadow-md);">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.5rem;">
        <div>
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#10b981;"></span>
            <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.06em; font-weight:700; color:#93c5fd;">System Control</span>
          </div>
          <h3 style="color:white; font-size:1.6rem; margin-bottom:0.35rem;">FidoConnect Admin Panel</h3>
          <p style="color:#cbd5e1; font-size:0.92rem; max-width:560px; margin:0;">
            Manage all 12 agency modules: project requests, approvals, proposals, network members, payments, reviews, invite codes, and client communication.
          </p>
        </div>
        <div>
          <a href="admin.html" class="btn btn-primary btn-lg" style="box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
            Open Admin Dashboard
          </a>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:1rem; margin-top:1.5rem; padding-top:1.25rem; border-top:1px solid rgba(255,255,255,0.12);">
        <div>
          <div style="font-size:0.75rem; color:#94a3b8; text-transform:uppercase;">New Requests</div>
          <div style="font-size:1.35rem; font-weight:750; color:#60a5fa;">${stats.newRequests}</div>
        </div>
        <div>
          <div style="font-size:0.75rem; color:#94a3b8; text-transform:uppercase;">Active Projects</div>
          <div style="font-size:1.35rem; font-weight:750; color:#c084fc;">${stats.activeProjects}</div>
        </div>
        <div>
          <div style="font-size:0.75rem; color:#94a3b8; text-transform:uppercase;">Proposals</div>
          <div style="font-size:1.35rem; font-weight:750; color:#34d399;">${stats.pendingApplications}</div>
        </div>
        <div>
          <div style="font-size:0.75rem; color:#94a3b8; text-transform:uppercase;">Members</div>
          <div style="font-size:1.35rem; font-weight:750; color:#2dd4bf;">${stats.activeMembers}</div>
        </div>
      </div>
    </div>

    <!-- Admin Account Settings -->
    <div class="card" style="max-width: 600px;">
      <h3 style="margin-bottom: 1.25rem;">Administrator Profile</h3>
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
        <button type="submit" class="btn btn-primary">Save Profile</button>
      </form>
    </div>
  `;

  document.getElementById("admin-account-logout-btn").addEventListener("click", () => FidoAuth.logout());

  document.getElementById("admin-profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await FidoDB.updateUser(currentUser.uid, {
        name: document.getElementById("edit-admin-name").value.trim(),
        phone: document.getElementById("edit-admin-phone").value.trim()
      });
      showToast("Administrator profile updated", "success");
    } catch (err) {
      showToast("Failed to update profile: " + err.message, "error");
    }
  });
}

// 2. Client Account Portal
async function renderClientView(container) {
  const clientProjects = await FidoDB.getProjects({ clientId: currentUser.uid });

  container.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
        <div>
          <h2>${currentUser.businessName || currentUser.name}</h2>
          <p class="text-muted">${currentUser.email} • Client Account</p>
        </div>
        <div style="display:flex; gap:0.5rem; align-items:center;">
          <a href="post-work.html" class="btn btn-primary">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            Post a Work
          </a>
          <button id="client-logout-btn" class="btn btn-secondary btn-sm">Sign Out</button>
        </div>
      </div>
    </div>

    <div class="tab-nav">
      <button class="tab-btn active" data-tab="client-projects-tab">My Projects (${clientProjects.length})</button>
      <button class="tab-btn" data-tab="client-profile-tab">Account Details</button>
    </div>

    <div id="client-projects-tab" class="tab-pane active">
      ${clientProjects.length === 0 ? `
        <div class="card text-center" style="padding: 3rem 1rem;">
          <h4>No submitted projects yet</h4>
          <p class="text-muted" style="margin: 0.4rem 0 1.25rem;">Have a website update, design, or business task you need done?</p>
          <a href="post-work.html" class="btn btn-primary">Post Your First Project</a>
        </div>
      ` : `
        <div style="display:flex; flex-direction:column; gap:1rem;">
          ${clientProjects.map(proj => `
            <div class="card" style="padding: 1.25rem;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap;">
                <div>
                  <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.35rem;">
                    <span class="project-id-badge">${proj.projectId || proj.id}</span>
                    <span class="project-category-badge">${proj.category}</span>
                    ${getStatusBadge(proj.status)}
                  </div>
                  <h3 style="font-size:1.15rem; margin-bottom:0.25rem;">${proj.title}</h3>
                  <p class="text-muted" style="font-size:0.88rem;">${proj.description}</p>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:0.85rem; color:var(--text-muted);">Budget: <strong>${proj.budget}</strong></div>
                  <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Deadline: ${formatDate(proj.deadline)}</div>
                </div>
              </div>
              <div style="margin-top:1rem; padding-top:0.75rem; border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; font-size:0.82rem; color:var(--text-muted);">
                <span>Agency Update: <em style="color:var(--color-primary);">${proj.agencyNotes || "Under agency review"}</em></span>
                <span>Submitted: ${formatDate(proj.createdAt)}</span>
              </div>
            </div>
          `).join("")}
        </div>
      `}
    </div>

    <div id="client-profile-tab" class="tab-pane">
      <div class="card" style="max-width: 600px;">
        <h3 style="margin-bottom: 1.25rem;">Business & Contact Information</h3>
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
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById("client-logout-btn").addEventListener("click", () => FidoAuth.logout());

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
  const isMemberActive = currentUser.membershipStatus === "active";

  container.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
        <div>
          <h2>${currentUser.name}</h2>
          <p class="text-muted">${currentUser.email} • Freelancer Network</p>
        </div>
        <div style="display:flex; gap:0.5rem; align-items:center;">
          <span class="badge ${isMemberActive ? "badge-active" : "badge-inactive"}" style="font-size:0.88rem; padding:0.4rem 0.8rem;">
            ● Membership: ${isMemberActive ? "Active Member" : "Not Active"}
          </span>
          <button id="freelancer-logout-btn" class="btn btn-secondary btn-sm">Sign Out</button>
        </div>
      </div>
    </div>

    <div class="tab-nav">
      <button class="tab-btn active" data-tab="freelancer-apps-tab">My Applications (${applications.length})</button>
      <button class="tab-btn" data-tab="freelancer-projects-tab">Assigned Projects (${activeProjects.length})</button>
      <button class="tab-btn" data-tab="membership-tab">Membership Plan</button>
      <button class="tab-btn" data-tab="freelancer-profile-tab">Profile & Skills</button>
    </div>

    <div id="freelancer-apps-tab" class="tab-pane active">
      ${applications.length === 0 ? `
        <div class="card text-center" style="padding: 3rem 1rem;">
          <h4>No applications submitted yet</h4>
          <p class="text-muted" style="margin: 0.4rem 0 1.25rem;">Browse available projects curated by FidoConnect and apply.</p>
          <a href="find-work.html" class="btn btn-primary">Find Available Work</a>
        </div>
      ` : `
        <div style="display:flex; flex-direction:column; gap:1rem;">
          ${applications.map(app => `
            <div class="card" style="padding: 1.25rem;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap;">
                <div>
                  <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.35rem;">
                    <span class="project-id-badge">${app.projectId}</span>
                    ${getStatusBadge(app.status)}
                  </div>
                  <p style="font-size:0.95rem; margin-top:0.3rem;">"${app.message}"</p>
                  <div style="font-size:0.82rem; color:var(--text-muted); margin-top:0.4rem;">
                    Estimated Delivery: <strong>${app.deliveryDays}</strong>
                  </div>
                </div>
                <div style="text-align:right;">
                  <span style="font-size:0.8rem; color:var(--text-muted);">Applied: ${formatDate(app.createdAt)}</span>
                  <div style="margin-top:0.5rem;">
                    <a href="project-details.html?id=${app.projectId}" class="btn btn-secondary btn-sm">View Project</a>
                  </div>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      `}
    </div>

    <div id="freelancer-projects-tab" class="tab-pane">
      ${activeProjects.length === 0 ? `
        <div class="card text-center" style="padding: 3rem 1rem;">
          <h4>No active assigned projects</h4>
          <p class="text-muted" style="margin: 0.4rem 0 1.25rem;">When the FidoConnect agency assigns you to a project, it will appear here.</p>
          <a href="find-work.html" class="btn btn-secondary">Browse Open Projects</a>
        </div>
      ` : `
        <div style="display:flex; flex-direction:column; gap:1rem;">
          ${activeProjects.map(proj => `
            <div class="card" style="padding: 1.25rem;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap;">
                <div>
                  <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.35rem;">
                    <span class="project-id-badge">${proj.projectId || proj.id}</span>
                    <span class="project-category-badge">${proj.category}</span>
                    ${getStatusBadge(proj.status)}
                  </div>
                  <h3 style="font-size:1.15rem; margin-bottom:0.25rem;">${proj.title}</h3>
                  <p class="text-muted" style="font-size:0.88rem;">${proj.description}</p>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:0.85rem; color:var(--text-muted);">Budget: <strong>${proj.budget}</strong></div>
                  <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Deadline: ${formatDate(proj.deadline)}</div>
                </div>
              </div>
              <div style="margin-top:1rem; padding-top:0.75rem; border-top:1px solid var(--border-color); font-size:0.82rem; color:var(--text-muted);">
                Agency Notes: <em style="color:var(--color-primary);">${proj.agencyNotes || "In progress"}</em>
              </div>
            </div>
          `).join("")}
        </div>
      `}
    </div>

    <div id="membership-tab" class="tab-pane">
      <div class="card" style="max-width: 680px;">
        <h3 style="margin-bottom: 0.5rem;">FidoConnect Membership</h3>
        <p class="text-muted" style="font-size:0.92rem; margin-bottom: 1.5rem;">
          Membership gives you access to FidoConnect project opportunities and allows you to apply for suitable projects.
        </p>

        <div class="card" style="background-color:var(--bg-subtle); border-color:var(--border-color); margin-bottom:1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
            <div>
              <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Status</div>
              <div style="font-size:1.2rem; font-weight:750; color:var(--color-primary); margin-top:2px;">
                ${isMemberActive ? "Active Standard Membership" : "Membership Inactive"}
              </div>
              <div style="font-size:0.82rem; color:var(--text-muted); margin-top:4px;">
                ${isMemberActive ? `Valid until ${formatDate(currentUser.membershipExpiry)}` : "Activate membership to submit proposals"}
              </div>
            </div>
            <div>
              <button id="toggle-membership-btn" class="btn ${isMemberActive ? "btn-secondary" : "btn-primary"}">
                ${isMemberActive ? "Renew / Manage Membership" : "Activate Membership"}
              </button>
            </div>
          </div>
        </div>

        <div class="notice-box notice-info" style="font-size:0.85rem;">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <div>
            <strong>Clear Agency Commitment</strong><br/>
            Membership provides access to project opportunities. Projects are not guaranteed.
          </div>
        </div>
      </div>
    </div>

    <div id="freelancer-profile-tab" class="tab-pane">
      <div class="card" style="max-width: 600px;">
        <h3 style="margin-bottom: 1.25rem;">Freelancer Profile</h3>
        <form id="freelancer-profile-form">
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
          <div class="form-group">
            <label class="form-label">Key Skills (comma separated)</label>
            <input type="text" id="edit-free-skills" class="form-control" placeholder="Website, HTML, Design, Figma" value="${(currentUser.skills || []).join(", ")}" />
          </div>
          <button type="submit" class="btn btn-primary">Save Profile</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById("freelancer-logout-btn").addEventListener("click", () => FidoAuth.logout());

  const toggleMemberBtn = document.getElementById("toggle-membership-btn");
  if (toggleMemberBtn) {
    toggleMemberBtn.addEventListener("click", async () => {
      try {
        await FidoDB.updateMembership(currentUser.uid, "active", "Standard Member");
        showToast("Membership activated! You can now apply for all open projects.", "success");
        currentUser.membershipStatus = "active";
        currentUser.membershipPlan = "Standard Member";
        await renderFreelancerView(container);
      } catch (err) {
        showToast("Failed to activate membership: " + err.message, "error");
      }
    });
  }

  const profForm = document.getElementById("freelancer-profile-form");
  if (profForm) {
    profForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const skillsRaw = document.getElementById("edit-free-skills").value;
        const skillsArr = skillsRaw.split(",").map(s => s.trim()).filter(Boolean);

        await FidoDB.updateUser(currentUser.uid, {
          name: document.getElementById("edit-free-name").value.trim(),
          phone: document.getElementById("edit-free-phone").value.trim(),
          portfolio: document.getElementById("edit-free-portfolio").value.trim(),
          skills: skillsArr
        });
        showToast("Profile updated successfully", "success");
      } catch (err) {
        showToast("Failed to update profile: " + err.message, "error");
      }
    });
  }
}
