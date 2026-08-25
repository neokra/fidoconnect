/**
 * FidoConnect - Account Management Controller
 * 
 * Manages Client, Freelancer, and Administrator account portals.
 */

import { FidoAuth } from "./auth.js";
import { FidoDB, SKILL_TAXONOMY, MEMBERSHIP_PLANS } from "./db.js";

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

  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get("tab") || (urlParams.get("return_project") ? "membership" : "");
  if (tabParam) {
    const tabName = tabParam.endsWith("-tab") ? tabParam : `${tabParam}-tab`;
    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.click();
  } else if (window.location.hash) {
    const hash = window.location.hash.replace("#", "");
    const tabName = hash.endsWith("-tab") ? hash : `${hash}-tab`;
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

  // Re-attach tab switching after every dynamic render
  setupEventListeners();
}

// 1. Administrator Account Portal
async function renderAdminAccountView(container) {
  const stats = await FidoDB.getDashboardStats();

  container.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
        <div>
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.25rem;">
            <h2 style="margin:0;">${currentUser.name || "Administrator"}</h2>
            <span class="role-badge role-badge-admin">⚙ Admin</span>
          </div>
          <p class="text-muted" style="font-size:0.88rem; margin:0;">${currentUser.email}</p>
        </div>
        <div class="account-header-actions" style="display:flex; gap:0.5rem; align-items:center;">
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
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.25rem;">
            <h2 style="margin:0;">${currentUser.businessName || currentUser.name}</h2>
            <span class="role-badge role-badge-client">👤 Client</span>
          </div>
          <p class="text-muted" style="font-size:0.88rem; margin:0;">${currentUser.email}</p>
        </div>
        <div class="account-header-actions" style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
          <a href="post-work.html" class="btn btn-primary btn-sm">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
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
  const urlParams = new URLSearchParams(window.location.search);
  const returnProject = urlParams.get("return_project");

  container.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
        <div>
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.25rem;">
            <h2 style="margin:0;">${currentUser.name}</h2>
            <span class="role-badge role-badge-freelancer">🔗 Freelancer</span>
            <span class="badge ${isMemberActive ? "badge-active" : "badge-inactive"}">
              ${isMemberActive ? `✓ ${currentUser.membershipPlan || "Active Member"}` : "○ Inactive Member"}
            </span>
          </div>
          <p class="text-muted" style="font-size:0.88rem; margin:0;">${currentUser.email}</p>
        </div>
        <div class="account-header-actions" style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
          <button id="freelancer-logout-btn" class="btn btn-secondary btn-sm">Sign Out</button>
        </div>
      </div>
    </div>

    <div class="tab-nav">
      <button class="tab-btn active" data-tab="freelancer-apps-tab">My Applications (${applications.length})</button>
      <button class="tab-btn" data-tab="freelancer-projects-tab">Assigned Projects (${activeProjects.length})</button>
      <button class="tab-btn" data-tab="membership-tab">Membership Plans</button>
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
          ${applications.map(app => {
            const isActionable = !["Rejected", "Withdrawn", "Closed", "Completed", "Cancelled"].includes(app.status);
            return `
              <div class="card" style="padding: 1.25rem;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap;">
                  <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.35rem;">
                      <span class="project-id-badge">${app.projectId}</span>
                      ${getStatusBadge(app.status)}
                    </div>
                    <p style="font-size:0.95rem; margin-top:0.3rem;">"${app.message}"</p>
                    <div style="font-size:0.82rem; color:var(--text-muted); margin-top:0.4rem;">
                      Estimated Delivery: <strong>${app.deliveryDays}</strong>
                    </div>
                  </div>
                  <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
                    <span style="font-size:0.8rem; color:var(--text-muted);">Applied: ${formatDate(app.createdAt)}</span>
                    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; justify-content:flex-end;">
                      <a href="project-details.html?id=${app.projectId}" class="btn btn-secondary btn-sm">View Project</a>
                      ${isActionable ? `
                        <button type="button" class="btn btn-sm" style="color:var(--status-cancelled); border:1px solid var(--border-color); background:var(--bg-surface);" onclick="handleWithdrawApplication('${app.id}')">
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
      <!-- Section Header -->
      <div style="margin-bottom: 2rem;">
        <div style="display:inline-flex; align-items:center; gap:6px; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.06em; font-weight:700; color:var(--color-accent); margin-bottom:0.4rem;">
          <span style="width:8px; height:8px; border-radius:50%; background:var(--color-accent);"></span>
          Selected Freelancer Program
        </div>
        <h2 style="font-size: 1.85rem; margin-bottom: 0.4rem;">Plans for Selected Members</h2>
        <p class="text-muted" style="font-size: 1rem; max-width: 720px; line-height: 1.6; margin-bottom: 0.5rem;">
          FidoConnect memberships are available to selected freelancers through our invite-only program.
        </p>
        <p style="font-size: 0.88rem; color: var(--color-primary-muted); max-width: 720px; line-height: 1.6;">
          You reached this page through a FidoConnect invitation. Your skills have been reviewed and verified, giving you access to membership plans designed for selected freelancers.
        </p>
      </div>

      <!-- Current Membership Banner / Project Return Prompt -->
      ${isMemberActive ? `
        <div class="card" style="border: 2px solid var(--color-teal); background-color: var(--color-teal-soft); margin-bottom: 2rem; padding: 1.25rem 1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
            <div>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--color-teal);"></span>
                <span style="font-size:0.8rem; text-transform:uppercase; font-weight:700; color:var(--color-teal);">Current Active Membership</span>
              </div>
              <div style="font-size:1.35rem; font-weight:800; color:var(--color-primary); margin-top:2px;">
                ${currentUser.membershipPlan || "Selected Basic"}
              </div>
              <div style="font-size:0.85rem; color:var(--color-primary-muted); margin-top:2px;">
                Active until <strong>${formatDate(currentUser.membershipExpiry)}</strong>. You can apply to matching project opportunities.
              </div>
            </div>
            ${returnProject ? `
              <div>
                <a href="project-details.html?id=${encodeURIComponent(returnProject)}&from_plan=true" class="btn btn-primary">
                  Return to Project (${returnProject}) & Complete Application &rarr;
                </a>
              </div>
            ` : ''}
          </div>
        </div>
      ` : (returnProject ? `
        <div class="notice-box notice-warning" style="margin-bottom: 2rem;">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <div>
            <strong>Application Ready for Project ${returnProject}:</strong> Activate a membership below to submit your prepared proposal.
          </div>
        </div>
      ` : '')}

      <!-- 3 Membership Tiers Grid -->
      <div class="plans-grid">
        ${Object.values(MEMBERSHIP_PLANS).map(plan => {
          const isCurrentPlan = isMemberActive && (currentUser.membershipPlan === plan.name);
          return `
            <div class="plan-card ${plan.isRecommended ? 'plan-card-recommended' : ''}">
              ${plan.badge ? `<div class="plan-badge-recommended">${plan.badge}</div>` : ''}
              
              <div class="plan-header">
                <div class="plan-tagline">${plan.tagline}</div>
                <h3 class="plan-title">${plan.name}</h3>
                <div class="plan-price-wrap">
                  <span class="plan-price">${plan.priceDisplay}</span>
                  <span class="plan-period">${plan.billingCycle}</span>
                </div>
                <p class="plan-desc">${plan.description}</p>
              </div>

              <ul class="plan-features-list">
                ${plan.features.map(f => `
                  <li class="plan-feature-item">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                    <span>${f}</span>
                  </li>
                `).join("")}
              </ul>

              <div>
                ${isCurrentPlan ? `
                  <button type="button" class="btn btn-secondary plan-cta-btn" disabled style="opacity:0.8; cursor:default;">
                    ✓ Current Active Plan
                  </button>
                ` : `
                  <button type="button" id="btn-plan-${plan.id}" class="btn ${plan.isRecommended ? 'btn-primary' : 'btn-secondary'} plan-cta-btn" onclick="handleActivatePlan('${plan.id}')">
                    ${isMemberActive ? 'Switch to ' + plan.name.replace('Selected ', '') : plan.buttonText}
                  </button>
                `}
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <!-- How FidoConnect Membership Works Section -->
      <div style="margin: 3rem 0 2rem;">
        <h3 style="font-size: 1.35rem; margin-bottom: 0.35rem;">How FidoConnect Membership Works</h3>
        <p class="text-muted" style="font-size: 0.88rem; margin-bottom: 1.25rem;">Understanding our invite-only selected freelancer network.</p>

        <div class="membership-steps-grid">
          <div class="membership-step-card">
            <div class="membership-step-number">1</div>
            <div class="membership-step-title">Invited</div>
            <p class="membership-step-desc">You were invited based on your skills and portfolio.</p>
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
      <div class="card" style="background-color: var(--bg-subtle); border-left: 4px solid var(--color-accent); padding: 1.5rem; max-width: 840px;">
        <h4 style="font-size: 1.05rem; margin-bottom: 0.4rem; color: var(--color-primary);">Before you join</h4>
        <p style="font-size: 0.88rem; line-height: 1.6; color: var(--color-primary-muted); margin: 0;">
          FidoConnect membership provides access to eligible project opportunities. Project availability depends on client demand, project requirements, skill match, and agency selection. Membership does not guarantee a specific project, income, or number of completed jobs.
        </p>
      </div>
    </div>

    <div id="freelancer-profile-tab" class="tab-pane">
      <div class="card" style="max-width: 680px; margin-bottom: 1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.25rem; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <h3 style="margin:0;">Verified Skill Profile & Services</h3>
            <p class="text-muted" style="font-size:0.85rem; margin-top:2px;">Your verified skills determine which projects are unlocked for you in Find Work.</p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="openSkillProfileModal()">
            Edit Skills & Bio
          </button>
        </div>

        ${currentUser.profileCompleted ? `
          <div style="display:flex; flex-direction:column; gap:1rem; background:var(--bg-subtle); padding:1.25rem; border-radius:var(--border-radius-md); border:1px solid var(--border-color);">
            <div>
              <div style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:0.4rem;">Primary Categories</div>
              <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                ${(currentUser.categories || []).map(cat => `<span class="badge badge-active">${cat}</span>`).join("") || '<span class="text-muted">None selected</span>'}
              </div>
            </div>

            ${(currentUser.subcategories && currentUser.subcategories.length > 0) ? `
              <div>
                <div style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:0.4rem;">Skills & Tools</div>
                <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                  ${currentUser.subcategories.map(sub => `<span class="badge badge-inactive">${sub}</span>`).join("")}
                </div>
              </div>
            ` : ""}

            ${currentUser.customSkills ? `
              <div>
                <div style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:0.4rem;">Custom Skills</div>
                <p style="font-size:0.88rem; margin:0;">${currentUser.customSkills}</p>
              </div>
            ` : ""}

            <div>
              <div style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:0.4rem;">About You / Introduction</div>
              <p style="font-size:0.88rem; line-height:1.55; margin:0; font-style:italic;">
                ${currentUser.bio ? `"${currentUser.bio}"` : '<span class="text-muted">No introduction provided yet.</span>'}
              </p>
            </div>
          </div>
        ` : `
          <div class="notice-box notice-warning" style="margin-bottom:1rem;">
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

      <div class="card" style="max-width: 680px;">
        <h3 style="margin-bottom: 1.5rem;">Basic Contact Information</h3>
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
          <button type="submit" class="btn btn-primary">Save Personal Details</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById("freelancer-logout-btn").addEventListener("click", () => FidoAuth.logout());

  const redeemForm = document.getElementById("redeem-invite-code-form");
  if (redeemForm) {
    redeemForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const codeInput = document.getElementById("redeem-invite-input");
      const btn = document.getElementById("redeem-invite-btn");
      const codeStr = codeInput ? codeInput.value.trim() : "";

      if (!codeStr) return;

      btn.disabled = true;
      btn.textContent = "Verifying...";

      try {
        await FidoAuth.verifyFreelancerInvite(codeStr);
        showToast("Invite code verified! You now have full access to view project details and submit proposals.", "success");
        await renderFreelancerView(container);
      } catch (err) {
        showToast(err.message || "Failed to redeem invite code.", "error");
        btn.disabled = false;
        btn.textContent = "Redeem Code";
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
      } catch (err) {
        showToast("Failed to update profile: " + err.message, "error");
      }
    });
  }

  // Restore active tab if requested in URL or hash
  if (returnProject || urlParams.get("tab") === "membership") {
    const memTabBtn = document.querySelector(`[data-tab="membership-tab"]`);
    if (memTabBtn) memTabBtn.click();
  }
}

window.handleActivatePlan = async function(planId) {
  if (!currentUser) return;
  const btn = document.getElementById("btn-plan-" + planId);
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Activating...";
  }

  try {
    const res = await FidoDB.activateMembershipPlan(currentUser.uid, planId);
    showToast(`✓ Membership activated! ${res.plan.name} is now active.`, "success");

    const urlParams = new URLSearchParams(window.location.search);
    const returnProject = urlParams.get("return_project");

    if (returnProject) {
      setTimeout(() => {
        window.location.href = `project-details.html?id=${encodeURIComponent(returnProject)}&from_plan=true`;
      }, 700);
    } else {
      // Patch currentUser and FidoAuth._currentUser so UI reflects membership immediately
      currentUser.membershipStatus = "active";
      currentUser.membershipPlan = res.plan.name;
      if (window.FidoAuth && window.FidoAuth._currentUser) {
        window.FidoAuth._currentUser.membershipStatus = "active";
        window.FidoAuth._currentUser.membershipPlan = res.plan.name;
      }
      const container = document.getElementById("account-layout-container");
      if (container) await renderAccountView();
    }
  } catch (err) {
    showToast("Failed to activate membership: " + err.message, "error");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Choose Plan";
    }
  }
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
