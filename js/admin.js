/**
 * FidoConnect - Comprehensive Admin Control Dashboard Controller
 * 
 * Strict Admin Access: Only for thecard.primary@gmail.com
 * Handles all 12 modules including Invite Codes management.
 */

import { FidoAuth } from "./auth.js";
import { FidoDB } from "./db.js";

let allAdminProjects = [];
let allAdminApps = [];
let allAdminApplications = [];
let allAdminUsers = [];
let allAdminFreelancers = [];
let allAdminClients = [];
let allAdminPayments = [];
let allAdminReviews = [];
let allAdminMessages = [];
let allAdminInviteCodes = [];
let allAdminPlans = [];

document.addEventListener("DOMContentLoaded", async () => {
  const isAuth = await FidoAuth.requireAuth(["admin"]);
  if (!isAuth) return;

  setupAdminTabs();
  setupFilterListeners();
  setupModalForms();
  await loadAdminData();
});

function setupAdminTabs() {
  document.querySelectorAll(".admin-nav-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".admin-nav-item").forEach(i => i.classList.remove("active"));
      document.querySelectorAll(".admin-tab-section").forEach(s => s.style.display = "none");

      item.classList.add("active");
      const targetId = item.getAttribute("data-section");
      const targetSec = document.getElementById(targetId);
      if (targetSec) targetSec.style.display = "block";
    });
  });

  // Handle URL hash or tab query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get("tab") || (window.location.hash ? window.location.hash.replace("#", "") : "");
  if (tabParam) {
    const secId = tabParam.startsWith("sec-") ? tabParam : `sec-${tabParam}`;
    const targetItem = document.querySelector(`.admin-nav-item[data-section="${secId}"]`);
    if (targetItem) targetItem.click();
  }
}

function setupFilterListeners() {
  const statusFilter = document.getElementById("admin-proj-filter-status");
  const catFilter = document.getElementById("admin-proj-filter-cat");

  if (statusFilter) {
    statusFilter.addEventListener("change", () => renderProjectsTable());
  }
  if (catFilter) {
    catFilter.addEventListener("change", () => renderProjectsTable());
  }
}

function setupModalForms() {
  // Record Payment Form
  const payForm = document.getElementById("record-payment-form");
  if (payForm) {
    payForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const projectId = document.getElementById("payProjectId").value.trim();
        const clientAmount = Number(document.getElementById("payClientAmount").value) || 0;
        const freelancerAmount = Number(document.getElementById("payFreelancerAmount").value) || 0;
        const status = document.getElementById("payStatus").value;
        const agencyMargin = Math.max(0, clientAmount - freelancerAmount);

        await FidoDB.addPayment({
          projectId,
          clientAmount,
          freelancerAmount,
          agencyMargin,
          status
        });

        closeModal("add-payment-modal");
        showToast("Payment record saved!", "success");
        await loadAdminData();
      } catch (err) {
        showToast("Failed to save payment: " + err.message, "error");
      }
    });
  }

  // Agency Settings Form
  const settingsForm = document.getElementById("admin-settings-form");
  if (settingsForm) {
    settingsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await FidoDB.updateSettings({
          agencyName: document.getElementById("setting-agency-name").value.trim(),
          projectPrefix: document.getElementById("setting-prefix").value.trim(),
          currency: document.getElementById("setting-currency").value.trim()
        });
        showToast("Settings updated successfully", "success");
      } catch (err) {
        showToast("Failed to update settings: " + err.message, "error");
      }
    });
  }

  // Create Invite Code Form
  const inviteForm = document.getElementById("create-invite-code-form");
  const platformSelect = document.getElementById("newInvitePlatform");
  const otherPlatformGroup = document.getElementById("invite-other-platform-group");

  if (platformSelect && otherPlatformGroup) {
    platformSelect.addEventListener("change", () => {
      otherPlatformGroup.style.display = platformSelect.value === "Other" ? "block" : "none";
    });
  }

  if (inviteForm) {
    inviteForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const code = document.getElementById("newInviteCode").value.trim().toUpperCase();
        const sourcePlatform = document.getElementById("newInvitePlatform") ? document.getElementById("newInvitePlatform").value : "Freelancer";
        const otherPlatform = (sourcePlatform === "Other" && document.getElementById("newInviteOtherPlatform")) ? document.getElementById("newInviteOtherPlatform").value.trim() : "";
        const freelancerName = document.getElementById("newInviteFreelancerName") ? document.getElementById("newInviteFreelancerName").value.trim() : "";
        const username = document.getElementById("newInviteHandle") ? document.getElementById("newInviteHandle").value.trim() : "";
        const additionalInfo = document.getElementById("newInviteAdditionalInfo") ? document.getElementById("newInviteAdditionalInfo").value.trim() : "";
        const note = document.getElementById("newInviteNote") ? document.getElementById("newInviteNote").value.trim() : "";

        if (!code) {
          showToast("Please enter an invite code.", "error");
          return;
        }

        const currentUser = FidoAuth.getCurrentUser();
        await FidoDB.createInviteCode({
          code,
          sourcePlatform,
          otherPlatform,
          freelancerName,
          username,
          additionalInfo,
          note,
          createdBy: currentUser ? currentUser.email : "admin"
        });

        closeModal("create-invite-code-modal");
        document.getElementById("newInviteCode").value = "";
        if (document.getElementById("newInviteOtherPlatform")) document.getElementById("newInviteOtherPlatform").value = "";
        if (document.getElementById("newInviteFreelancerName")) document.getElementById("newInviteFreelancerName").value = "";
        if (document.getElementById("newInviteHandle")) document.getElementById("newInviteHandle").value = "";
        if (document.getElementById("newInviteAdditionalInfo")) document.getElementById("newInviteAdditionalInfo").value = "";
        if (document.getElementById("newInviteNote")) document.getElementById("newInviteNote").value = "";
        if (otherPlatformGroup) otherPlatformGroup.style.display = "none";

        showToast(`Invite code ${code} created successfully!`, "success");
        await loadAdminData();
      } catch (err) {
        showToast(err.message || "Failed to create invite code.", "error");
      }
    });
  }

  // Plan Editor Form (Database-Driven Plans)
  const planForm = document.getElementById("plan-editor-form");
  if (planForm) {
    planForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById("btn-save-plan");
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving Plan...";
      }

      try {
        const planId = document.getElementById("planEditId") ? document.getElementById("planEditId").value.trim() : "";
        const name = document.getElementById("planEditName").value.trim();
        const tagline = document.getElementById("planEditTagline") ? document.getElementById("planEditTagline").value.trim() : "";
        const price = Number(document.getElementById("planEditPrice").value) || 0;
        const duration = document.getElementById("planEditDuration").value.trim() || "1 Month";
        const durationDays = Number(document.getElementById("planEditDurationDays").value) || 30;
        const description = document.getElementById("planEditDescription") ? document.getElementById("planEditDescription").value.trim() : "";
        const featuresText = document.getElementById("planEditFeatures") ? document.getElementById("planEditFeatures").value : "";
        const qrImageUrl = document.getElementById("planEditQrUrl") ? document.getElementById("planEditQrUrl").value.trim() : "";
        const upiId = document.getElementById("planEditUpiId") ? document.getElementById("planEditUpiId").value.trim() : "";
        const merchantName = document.getElementById("planEditMerchantName") ? document.getElementById("planEditMerchantName").value.trim() : "";
        const buttonText = document.getElementById("planEditButtonText") ? document.getElementById("planEditButtonText").value.trim() : "";
        const sortOrder = Number(document.getElementById("planEditSortOrder") ? document.getElementById("planEditSortOrder").value : 0) || 0;
        const published = document.getElementById("planEditPublished") ? document.getElementById("planEditPublished").checked : true;
        const isRecommended = document.getElementById("planEditRecommended") ? document.getElementById("planEditRecommended").checked : false;

        const features = featuresText.split("\n").map(s => s.trim()).filter(Boolean);

        await FidoDB.saveMembershipPlan({
          id: planId || undefined,
          name,
          tagline,
          price,
          duration,
          durationDays,
          description,
          features,
          qrImageUrl: qrImageUrl || undefined,
          upiId: upiId || undefined,
          merchantName: merchantName || undefined,
          buttonText: buttonText || undefined,
          sortOrder,
          published,
          isRecommended
        });

        closeModal("modal-plan-editor");
        showToast(`Plan "${name}" saved successfully!`, "success");
        await loadAdminData();
      } catch (err) {
        showToast(err.message || "Failed to save membership plan.", "error");
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = "Save Plan";
        }
      }
    });
  }

  // Add Plan Toolbar Button
  const addPlanBtn = document.getElementById("btn-add-plan");
  if (addPlanBtn) {
    addPlanBtn.addEventListener("click", () => {
      openAddPlanModal();
    });
  }

  // Seed Plans Toolbar Button
  const seedPlansBtn = document.getElementById("btn-seed-plans");
  if (seedPlansBtn) {
    seedPlansBtn.addEventListener("click", () => {
      handleSeedDefaultPlans();
    });
  }

  // Generate Random Code Button
  const genBtn = document.getElementById("btn-generate-random-code");
  if (genBtn) {
    genBtn.addEventListener("click", () => {
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase() + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
      const codeInput = document.getElementById("newInviteCode");
      if (codeInput) {
        codeInput.value = `FIDO-${randomSuffix}`;
      }
    });
  }
}

async function loadAdminData() {
  try {
    const [projects, apps, users, payments, reviews, messages, stats, inviteCodes, plans] = await Promise.all([
      FidoDB.getProjects({}).catch(e => { console.warn("getProjects warning:", e); return []; }),
      FidoDB.getApplications({}).catch(e => { console.warn("getApplications warning:", e); return []; }),
      FidoDB.getUsers().catch(e => { console.warn("getUsers warning:", e); return []; }),
      FidoDB.getPayments().catch(e => { console.warn("getPayments warning:", e); return []; }),
      FidoDB.getReviews().catch(e => { console.warn("getReviews warning:", e); return []; }),
      FidoDB.getMessages().catch(e => { console.warn("getMessages warning:", e); return []; }),
      FidoDB.getDashboardStats().catch(e => { 
        console.warn("getDashboardStats warning:", e); 
        return { totalProjects: 0, newRequests: 0, activeProjects: 0, completedProjects: 0, totalUsers: 0, freelancersCount: 0, clientsCount: 0, activeMembers: 0, pendingApplications: 0, totalRevenue: "$0", agencyMargin: "$0" }; 
      }),
      FidoDB.getInviteCodes().catch(e => { console.warn("getInviteCodes warning:", e); return []; }),
      FidoDB.getMembershipPlans(true).catch(e => { console.warn("getMembershipPlans warning:", e); return []; })
    ]);

    allAdminProjects = projects || [];
    allAdminApps = apps || [];
    allAdminApplications = allAdminApps;
    window.allAdminApplications = allAdminApps;
    allAdminUsers = users || [];
    allAdminFreelancers = (users || []).filter(u => u.role === "freelancer");
    allAdminClients = (users || []).filter(u => u.role === "client");
    allAdminPayments = payments || [];
    allAdminReviews = reviews || [];
    allAdminMessages = messages || [];
    allAdminInviteCodes = inviteCodes || [];
    allAdminPlans = plans || [];

    if (stats) renderOverviewStats(stats);
    renderProjectsTable();
    renderApplicationsTable();
    renderUsersTable();
    renderFreelancersTable();
    renderClientsTable();
    renderMembershipPlansTable();
    renderMembershipsTable();
    renderPaymentsTable();
    renderReviewsTable();
    renderMessagesTable();
    renderInviteCodesTable();

  } catch (err) {
    console.error("Error in loadAdminData:", err);
    showToast("Notice while loading data: " + err.message, "error");
  }
}

// 1. Overview Section
function renderOverviewStats(stats) {
  document.getElementById("kpi-total-projects").textContent = stats.totalProjects;
  document.getElementById("kpi-new-requests").textContent = stats.newRequests;
  document.getElementById("kpi-active-projects").textContent = stats.activeProjects;
  document.getElementById("kpi-completed-projects").textContent = stats.completedProjects;
  document.getElementById("kpi-total-users").textContent = stats.totalUsers;
  document.getElementById("kpi-freelancers-count").textContent = stats.freelancersCount;
  document.getElementById("kpi-clients-count").textContent = stats.clientsCount;
  document.getElementById("kpi-active-members").textContent = stats.activeMembers;
  document.getElementById("kpi-total-apps").textContent = stats.pendingApplications;
  document.getElementById("kpi-total-revenue").textContent = stats.totalRevenue;
  document.getElementById("kpi-total-margin").textContent = stats.agencyMargin;
}

// 2. Projects Management
function renderProjectsTable() {
  const container = document.getElementById("admin-projects-tbody");
  if (!container) return;

  const statusVal = document.getElementById("admin-proj-filter-status") ? document.getElementById("admin-proj-filter-status").value : "all";
  const catVal = document.getElementById("admin-proj-filter-cat") ? document.getElementById("admin-proj-filter-cat").value : "all";

  const filtered = allAdminProjects.filter(p => {
    if (statusVal !== "all" && p.status !== statusVal) return false;
    if (catVal !== "all" && p.category !== catVal) return false;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">No projects matching current filter.</td></tr>`;
    return;
  }

  container.innerHTML = filtered.map(proj => {
    const assignedFreelancer = allAdminFreelancers.find(f => f.uid === proj.assignedFreelancerId);

    return `
      <tr>
        <td>
          <div style="font-family:var(--font-mono); font-weight:700; font-size:0.82rem;">${proj.projectId || proj.id}</div>
          <span style="font-size:0.75rem; color:var(--text-muted);">${formatDate(proj.createdAt)}</span>
        </td>
        <td>
          <strong style="color:var(--color-primary);">${proj.title}</strong>
          <div style="font-size:0.8rem; color:var(--text-muted);">${proj.category} • Budget: ${proj.budget}</div>
        </td>
        <td>
          <div>${proj.clientBusiness || proj.clientName}</div>
          <div style="font-size:0.78rem; color:var(--text-muted);">${proj.clientEmail || ""} • ${proj.clientPhone || ""}</div>
        </td>
        <td>
          <select class="form-control form-control-sm" style="padding:3px 6px; font-size:0.8rem; width:auto;" onchange="updateProjectStatus('${proj.id}', this.value)">
            ${[
              "Submitted", "Under Review", "Approved", "Published", "Applications Open",
              "Freelancer Selected", "In Progress", "Submitted for Review", "Client Review", 
              "Revision Required", "Completed", "Cancelled"
            ].map(st => `<option value="${st}" ${proj.status === st ? "selected" : ""}>${st}</option>`).join("")}
          </select>
        </td>
        <td>
          <span style="font-size:0.85rem; font-weight:600;">
            ${assignedFreelancer ? assignedFreelancer.name : `<span class="text-muted">Unassigned</span>`}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            ${proj.status === "Submitted" || proj.status === "Under Review" ? `
              <button class="btn btn-primary btn-sm" onclick="approveAndPublishProject('${proj.id}')" title="Approve & Publish to Find Work">Approve & Publish</button>
            ` : ""}
            <a href="project-details.html?id=${proj.projectId || proj.id}" target="_blank" class="btn btn-secondary btn-sm">View</a>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

window.updateProjectStatus = async function(projId, newStatus) {
  try {
    const visibility = (newStatus === "Published" || newStatus === "Applications Open") ? "public" : "admin_only";
    await FidoDB.updateProject(projId, { 
      status: newStatus,
      visibility: visibility
    });
    showToast(`Project status updated to ${newStatus}`, "success");
    await loadAdminData();
  } catch (err) {
    showToast("Failed to update status: " + err.message, "error");
  }
};

window.approveAndPublishProject = async function(projId) {
  try {
    await FidoDB.updateProject(projId, {
      status: "Published",
      visibility: "public",
      agencyNotes: "Approved by FidoConnect operations. Open for freelancer applications."
    });
    showToast("Project approved and published to Find Work!", "success");
    await loadAdminData();
  } catch (err) {
    showToast("Failed to publish project: " + err.message, "error");
  }
};

// 3. Applications Management
function renderApplicationsTable() {
  const container = document.getElementById("admin-apps-tbody");
  if (!container) return;

  if (allAdminApps.length === 0) {
    container.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">No applications received yet.</td></tr>`;
    return;
  }

  container.innerHTML = allAdminApps.map(app => {
    const proj = allAdminProjects.find(p => p.projectId === app.projectId || p.id === app.projectId);

    return `
      <tr>
        <td>
          <div style="font-family:var(--font-mono); font-weight:700;">${app.projectId}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">${proj ? proj.title : ""}</div>
        </td>
        <td>
          <strong style="color:var(--color-primary);">${app.freelancerName}</strong>
          <div style="font-size:0.78rem; color:var(--text-muted);">${app.freelancerEmail}</div>
          ${app.portfolio ? `<a href="${app.portfolio}" target="_blank" style="font-size:0.78rem; color:var(--color-accent);">Portfolio ↗</a>` : ""}
        </td>
        <td style="max-width:300px;">
          <div style="font-size:0.85rem; font-style:italic;">"${app.message}"</div>
          <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">Est: ${app.deliveryDays}</div>
        </td>
        <td>
          ${getStatusBadge(app.status)}
        </td>
        <td>
          <span style="font-size:0.8rem; color:var(--text-muted);">${formatDate(app.createdAt)}</span>
        </td>
        <td>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="selectFreelancerForProject('${app.projectId}', '${app.freelancerId}', '${app.id}')">Select & Assign</button>
            <button class="btn btn-secondary btn-sm" onclick="updateAppStatus('${app.id}', 'Shortlisted')">Shortlist</button>
            <button class="btn btn-secondary btn-sm" onclick="updateAppStatus('${app.id}', 'Rejected')">Reject</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

window.updateAppStatus = async function(appId, newStatus) {
  try {
    await FidoDB.updateApplication(appId, { status: newStatus });
    showToast(`Application marked as ${newStatus}`, "success");
    await loadAdminData();
  } catch (err) {
    showToast("Failed to update application: " + err.message, "error");
  }
};

window.selectFreelancerForProject = async function(projId, freelancerId, appId) {
  try {
    await FidoDB.updateProject(projId, {
      assignedFreelancerId: freelancerId,
      status: "In Progress",
      agencyNotes: `Freelancer selected and assigned by agency on ${formatDate(new Date())}. Work is in progress.`
    });
    await FidoDB.updateApplication(appId, { status: "Selected" });
    showToast("Freelancer selected and assigned to project!", "success");
    await loadAdminData();
  } catch (err) {
    showToast("Failed to assign freelancer: " + err.message, "error");
  }
};

// 4. Users Table
function renderUsersTable() {
  const container = document.getElementById("admin-users-tbody");
  if (!container) return;

  if (allAdminUsers.length === 0) {
    container.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">No users found in database.</td></tr>`;
    return;
  }

  container.innerHTML = allAdminUsers.map(u => {
    const isSuspended = u.status === "suspended";
    return `
      <tr>
        <td>
          <strong>${u.name || "User"}</strong>
          <div style="font-size:0.8rem; color:var(--text-muted);">${u.email}</div>
        </td>
        <td>
          <span class="badge ${u.role === "admin" ? "badge-completed" : "badge-inactive"}">${u.role || u.accountType || "client"}</span>
        </td>
        <td>
          <span class="badge ${u.membershipStatus === "active" ? "badge-active" : "badge-inactive"}">${u.membershipStatus || "N/A"}</span>
        </td>
        <td>
          <span style="font-size:0.82rem; color:var(--text-muted);">${formatDate(u.createdAt)}</span>
        </td>
        <td>
          <span class="badge ${isSuspended ? "badge-cancelled" : "badge-active"}">${isSuspended ? "Suspended" : "Active"}</span>
        </td>
        <td>
          ${u.role !== "admin" ? `
            <button class="btn btn-secondary btn-sm" onclick="toggleUserStatus('${u.uid}', '${isSuspended ? "active" : "suspended"}')">
              ${isSuspended ? "Reactivate" : "Suspend"}
            </button>
          ` : `<span style="font-size:0.75rem; color:var(--text-muted);">Admin</span>`}
        </td>
      </tr>
    `;
  }).join("");
}

window.toggleUserStatus = async function(uid, targetStatus) {
  try {
    await FidoDB.updateUser(uid, { status: targetStatus });
    showToast(`User marked as ${targetStatus}`, "success");
    await loadAdminData();
  } catch (err) {
    showToast("Failed to update user: " + err.message, "error");
  }
};

// 5. Freelancers Table
function renderFreelancersTable() {
  const container = document.getElementById("admin-freelancers-tbody");
  if (!container) return;

  if (allAdminFreelancers.length === 0) {
    container.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">No registered freelancers found.</td></tr>`;
    return;
  }

  container.innerHTML = allAdminFreelancers.map(f => {
    const isMember = f.membershipStatus === "active";
    return `
      <tr>
        <td>
          <strong>${f.name}</strong>
          <div style="font-size:0.8rem; color:var(--text-muted);">${f.email} • ${f.phone || "No phone"}</div>
          ${f.usedInviteCode ? `<div style="font-size:0.75rem; color:var(--color-accent); font-family:var(--font-mono);">Code: ${f.usedInviteCode}</div>` : ""}
        </td>
        <td>
          <div>${(f.skills || []).map(s => `<span class="badge badge-inactive">${s}</span>`).join(" ")}</div>
          ${f.portfolio ? `<a href="${f.portfolio}" target="_blank" style="font-size:0.8rem; color:var(--color-accent);">View Portfolio ↗</a>` : ""}
        </td>
        <td>
          <span class="badge ${isMember ? "badge-active" : "badge-inactive"}">
            ${isMember ? "Active Member" : "Inactive"}
          </span>
          ${isMember ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Exp: ${formatDate(f.membershipExpiry)}</div>` : ""}
          ${f.membershipMessage ? `<div style="font-size:0.75rem; color:var(--color-primary-muted); margin-top:4px; line-height:1.35; background:var(--bg-subtle); padding:3px 6px; border-radius:4px; border:1px solid var(--border-color);">💬 <em>${f.membershipMessage}</em></div>` : ""}
        </td>
        <td>
          <span style="font-size:0.85rem; font-weight:600;">★ ${f.rating || "5.0"}</span>
        </td>
        <td>
          <button class="btn ${isMember ? "btn-secondary" : "btn-primary"} btn-sm" onclick="openMembershipModal('${f.uid}', '${isMember ? "inactive" : "active"}')">
            ${isMember ? "Deactivate Membership" : "Activate Membership"}
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

let activeMsgFreelancer = null;
let activeMsgTemplates = {};

window.openMembershipModal = function(uid, targetStatus) {
  try {
    const f = (allAdminFreelancers || []).find(x => (x.uid === uid || x.id === uid)) 
           || (allAdminUsers || []).find(x => (x.uid === uid || x.id === uid));
    if (!f) {
      console.warn("Freelancer not found for uid:", uid);
      showToast("Freelancer record not found.", "error");
      return;
    }

    activeMsgFreelancer = f;

    const titleEl = document.getElementById("modal-membership-title");
    const uidInput = document.getElementById("msg-target-freelancer-uid");
    const statusInput = document.getElementById("msg-target-status");
    const nameEl = document.getElementById("msg-target-freelancer-name");
    const metaEl = document.getElementById("msg-target-freelancer-meta");
    const curMsgEl = document.getElementById("msg-target-current-msg");
    const selectEl = document.getElementById("msg-template-select");
    const textEl = document.getElementById("msg-custom-text");
    const planGroup = document.getElementById("msg-plan-selection-group");
    const planSelect = document.getElementById("msg-plan-select");
    const submitBtn = document.getElementById("btn-save-membership-msg");

    const isActivating = targetStatus === "active";

    if (titleEl) {
      titleEl.textContent = isActivating ? "Activate Freelancer Membership" : "Deactivate Freelancer Membership";
    }

    if (submitBtn) {
      submitBtn.textContent = isActivating ? "Apply & Activate Membership" : "Apply & Deactivate Membership";
      if (isActivating) {
        submitBtn.className = "btn btn-primary";
        submitBtn.style.color = "";
        submitBtn.style.borderColor = "";
      } else {
        submitBtn.className = "btn btn-secondary";
        submitBtn.style.color = "#dc2626";
        submitBtn.style.borderColor = "#fca5a5";
      }
    }

    if (uidInput) uidInput.value = f.uid || f.id || uid;
    if (statusInput) statusInput.value = targetStatus;
    if (nameEl) nameEl.textContent = `${f.name || 'Freelancer'} (${f.email || 'No email'})`;
    
    const isMember = f.membershipStatus === "active";
    const planName = f.membershipPlan || "Basic";
    const expiryText = f.membershipExpiry ? `Exp: ${formatDate(f.membershipExpiry)}` : "No expiry date";
    if (metaEl) metaEl.textContent = `Current Status: ${isMember ? "Active" : "Inactive"} • Tier: ${planName} • ${expiryText}`;

    if (curMsgEl) {
      if (f.membershipMessage) {
        curMsgEl.style.display = "block";
        curMsgEl.innerHTML = `<strong>Current Reason Note:</strong> "${f.membershipMessage}" <span style="font-size:0.75rem; color:var(--text-muted);">(${formatDate(f.membershipMessageDate || f.updatedAt)})</span>`;
      } else {
        curMsgEl.style.display = "none";
        curMsgEl.textContent = "";
      }
    }

    // 1. Resolve duration from plan or user data
    let planDurationDays = 30;
    if (allAdminPlans && allAdminPlans.length > 0) {
      const matchedPlan = allAdminPlans.find(p => p.name && p.name.toLowerCase() === (f.membershipPlan || "").toLowerCase());
      if (matchedPlan && matchedPlan.durationDays) {
        planDurationDays = matchedPlan.durationDays;
      }
    }

    // 2. Resolve project data from applications / system projects
    let projectInfo = null;
    const userApps = (allAdminApps || []).filter(a => a.freelancerId === (f.uid || f.id));
    if (userApps.length > 0) {
      const latestApp = userApps[0];
      const targetProject = (allAdminProjects || []).find(p => (p.projectId || p.id) === (latestApp.projectId || latestApp.id) || p.id === latestApp.projectId);
      if (targetProject) {
        projectInfo = targetProject.title || targetProject.projectId || targetProject.id;
      } else if (latestApp.projectId) {
        projectInfo = `Project ${latestApp.projectId}`;
      }
    }

    // Populate plan selection if activating
    if (planGroup && planSelect) {
      if (isActivating && allAdminPlans && allAdminPlans.length > 0) {
        planGroup.style.display = "block";
        planSelect.innerHTML = allAdminPlans.map(p => `
          <option value="${p.id}" ${p.name.toLowerCase() === (f.membershipPlan || "").toLowerCase() ? 'selected' : ''}>
            ${p.name} (₹${p.price || p.priceAmount || 0} • ${p.durationDays || 30} Days)
          </option>
        `).join("");
      } else {
        planGroup.style.display = "none";
      }
    }

    // Build dynamic templates based on actual system data
    activeMsgTemplates = {
      activated: `Membership Activated`,
      expired_duration: `Membership Expired — ${planDurationDays}-day membership period completed`,
      expired_project: projectInfo ? `Membership Expired — selected project opportunity completed (${projectInfo})` : `Membership Expired — selected project opportunity completed`,
      deactivated: `Membership Deactivated`,
      renewed: `Membership Renewed`,
      custom: f.membershipMessage || ""
    };

    // Update option labels for dynamic duration & project in dropdown
    if (selectEl) {
      const optDuration = selectEl.querySelector('option[value="expired_duration"]');
      if (optDuration) optDuration.textContent = activeMsgTemplates.expired_duration;

      const optProject = selectEl.querySelector('option[value="expired_project"]');
      if (optProject) optProject.textContent = activeMsgTemplates.expired_project;

      // Default selection
      if (isActivating) {
        selectEl.value = isMember ? "renewed" : "activated";
      } else {
        selectEl.value = projectInfo ? "expired_project" : "expired_duration";
      }
    }

    handleMembershipTemplateChange();
    openModal("modal-membership-message");
  } catch (err) {
    console.error("Error opening membership modal:", err);
    showToast("Error opening membership modal: " + err.message, "error");
  }
};

window.toggleFreelancerMembership = window.openMembershipModal;

window.handleMembershipTemplateChange = function() {
  const selectEl = document.getElementById("msg-template-select");
  const textEl = document.getElementById("msg-custom-text");
  const statusInput = document.getElementById("msg-target-status");
  const titleEl = document.getElementById("modal-membership-title");
  const submitBtn = document.getElementById("btn-save-membership-msg");
  if (!selectEl || !textEl) return;

  const key = selectEl.value;
  if (key !== "custom") {
    textEl.value = activeMsgTemplates[key] || "";
  }

  if (statusInput) {
    if (key === "activated" || key === "renewed") {
      statusInput.value = "active";
      if (titleEl) titleEl.textContent = "Activate Freelancer Membership";
      if (submitBtn) {
        submitBtn.textContent = "Apply & Activate Membership";
        submitBtn.className = "btn btn-primary";
        submitBtn.style.color = "";
        submitBtn.style.borderColor = "";
      }
    } else if (key === "expired_duration" || key === "expired_project" || key === "deactivated") {
      statusInput.value = "inactive";
      if (titleEl) titleEl.textContent = "Deactivate Freelancer Membership";
      if (submitBtn) {
        submitBtn.textContent = "Apply & Deactivate Membership";
        submitBtn.className = "btn btn-secondary";
        submitBtn.style.color = "#dc2626";
        submitBtn.style.borderColor = "#fca5a5";
      }
    }
  }
};

window.handleSaveMembershipMessage = async function(e) {
  e.preventDefault();
  const uid = document.getElementById("msg-target-freelancer-uid")?.value;
  const status = document.getElementById("msg-target-status")?.value || "active";
  const textEl = document.getElementById("msg-custom-text");
  const selectEl = document.getElementById("msg-template-select");
  const planSelect = document.getElementById("msg-plan-select");
  const submitBtn = document.getElementById("btn-save-membership-msg");

  if (!uid || !textEl) return;
  const msgText = textEl.value.trim();
  if (!msgText) {
    showToast("Please enter a membership message.", "error");
    return;
  }

  const templateType = selectEl ? selectEl.value : "custom";

  let selectedPlanName = null;
  let selectedPlanDuration = 30;
  if (status === "active" && planSelect && planSelect.value && allAdminPlans) {
    const p = allAdminPlans.find(x => x.id === planSelect.value);
    if (p) {
      selectedPlanName = p.name;
      selectedPlanDuration = p.durationDays || 30;
    }
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Applying...";
  }

  try {
    await FidoDB.updateFreelancerMembershipMessage(uid, {
      message: msgText,
      messageType: templateType,
      status: status,
      plan: selectedPlanName || (activeMsgFreelancer && activeMsgFreelancer.membershipPlan) || "Basic",
      durationDays: selectedPlanDuration
    });

    showToast(`✓ Freelancer membership updated to ${status} with reason saved!`, "success");
    closeModal("modal-membership-message");
    await loadAdminData();
  } catch (err) {
    showToast("Failed to update membership: " + err.message, "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = status === "active" ? "Apply & Activate Membership" : "Apply & Deactivate Membership";
    }
  }
};

// 6. Clients Table
function renderClientsTable() {
  const container = document.getElementById("admin-clients-tbody");
  if (!container) return;

  if (allAdminClients.length === 0) {
    container.innerHTML = `<tr><td colspan="4" class="text-center text-muted" style="padding:2rem;">No registered clients found.</td></tr>`;
    return;
  }

  container.innerHTML = allAdminClients.map(c => {
    const clientProjects = allAdminProjects.filter(p => p.clientId === c.uid);
    return `
      <tr>
        <td>
          <strong>${c.businessName || c.name}</strong>
          <div style="font-size:0.8rem; color:var(--text-muted);">Contact: ${c.name}</div>
        </td>
        <td>
          <div>${c.email}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">${c.phone || "No phone"}</div>
        </td>
        <td>
          <span class="badge badge-approved">${clientProjects.length} projects</span>
        </td>
        <td>
          <span style="font-size:0.82rem; color:var(--text-muted);">Joined ${formatDate(c.createdAt)}</span>
        </td>
      </tr>
    `;
  }).join("");
}

// 7a. Database-Driven Membership Plans Table
function renderMembershipPlansTable() {
  const container = document.getElementById("admin-plans-tbody");
  if (!container) return;

  if (!allAdminPlans || allAdminPlans.length === 0) {
    container.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">No membership plans in database. Click <strong>+ Add New Plan</strong> to create one.</td></tr>`;
    return;
  }

  container.innerHTML = allAdminPlans.map(p => {
    const isPub = p.published !== false;
    const priceDisplay = p.priceDisplay || `₹${(p.price || p.priceAmount || 0).toLocaleString("en-IN")}`;
    const durationLabel = p.duration || `${p.durationDays || 30} Days`;
    const featuresCount = Array.isArray(p.features) ? p.features.length : 0;
    
    return `
      <tr>
        <td>
          <div style="font-weight:750; color:var(--color-primary); display:flex; align-items:center; gap:0.4rem;">
            ${p.name}
            ${p.isRecommended ? '<span class="badge badge-proposal" style="font-size:0.7rem;">Recommended</span>' : ''}
          </div>
          <div style="font-size:0.8rem; color:var(--text-muted);">${p.tagline || (p.description ? p.description.substring(0, 45) + '...' : 'No tagline')}</div>
        </td>
        <td>
          <div style="font-weight:750; color:var(--color-accent); font-size:1.05rem;">${priceDisplay}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">${durationLabel} (${p.durationDays || 30}d)</div>
        </td>
        <td>
          <div style="font-family:var(--font-mono); font-size:0.82rem; color:var(--color-primary);">${p.upiId || "Default UPI"}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${p.merchantName || "FidoConnect"} &bull; <a href="${p.qrImageUrl || 'images/fido-upi-qr.svg'}" target="_blank" style="color:var(--color-accent); text-decoration:none;">View QR &nearr;</a></div>
        </td>
        <td>
          <span class="badge badge-approved" title="${(p.features || []).join(', ')}">${featuresCount} features</span>
        </td>
        <td>
          <span class="badge ${isPub ? 'badge-active' : 'badge-inactive'}">
            ${isPub ? '✓ Published' : 'Draft / Hidden'}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="openEditPlanModal('${p.id}')" title="Edit Plan">
              Edit
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="handleTogglePlanPublish('${p.id}', ${isPub})" title="${isPub ? 'Hide from public' : 'Publish publicly'}">
              ${isPub ? 'Unpublish' : 'Publish'}
            </button>
            <button type="button" class="btn btn-danger btn-sm" onclick="handleDeletePlan('${p.id}')" title="Delete Plan">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

window.openAddPlanModal = function() {
  document.getElementById("plan-editor-title").textContent = "Add Membership Plan";
  document.getElementById("planEditId").value = "";
  document.getElementById("planEditName").value = "";
  document.getElementById("planEditTagline").value = "";
  document.getElementById("planEditPrice").value = "";
  document.getElementById("planEditDuration").value = "1 Month";
  document.getElementById("planEditDurationDays").value = "30";
  document.getElementById("planEditDescription").value = "";
  document.getElementById("planEditFeatures").value = "Access to selected FidoConnect project opportunities\nApply to matching projects\nVerified freelancer profile badge\nProject performance record";
  document.getElementById("planEditQrUrl").value = "images/fido-upi-qr.svg";
  document.getElementById("planEditUpiId").value = "fidoconnect@okaxis";
  document.getElementById("planEditMerchantName").value = "FidoConnect";
  document.getElementById("planEditButtonText").value = "";
  document.getElementById("planEditSortOrder").value = allAdminPlans.length + 1;
  document.getElementById("planEditPublished").checked = true;
  document.getElementById("planEditRecommended").checked = false;

  openModal("modal-plan-editor");
};

window.openEditPlanModal = function(planId) {
  const plan = allAdminPlans.find(p => p.id === planId);
  if (!plan) {
    showToast("Plan not found.", "error");
    return;
  }

  document.getElementById("plan-editor-title").textContent = `Edit Plan: ${plan.name}`;
  document.getElementById("planEditId").value = plan.id;
  document.getElementById("planEditName").value = plan.name || "";
  document.getElementById("planEditTagline").value = plan.tagline || "";
  document.getElementById("planEditPrice").value = plan.price !== undefined ? plan.price : (plan.priceAmount || 0);
  document.getElementById("planEditDuration").value = plan.duration || "1 Month";
  document.getElementById("planEditDurationDays").value = plan.durationDays || 30;
  document.getElementById("planEditDescription").value = plan.description || "";
  
  const featuresText = Array.isArray(plan.features) ? plan.features.join("\n") : (plan.features || "");
  document.getElementById("planEditFeatures").value = featuresText;
  
  document.getElementById("planEditQrUrl").value = plan.qrImageUrl || "images/fido-upi-qr.svg";
  document.getElementById("planEditUpiId").value = plan.upiId || "fidoconnect@okaxis";
  document.getElementById("planEditMerchantName").value = plan.merchantName || "FidoConnect";
  document.getElementById("planEditButtonText").value = plan.buttonText || "";
  document.getElementById("planEditSortOrder").value = plan.sortOrder !== undefined ? plan.sortOrder : 0;
  document.getElementById("planEditPublished").checked = plan.published !== false;
  document.getElementById("planEditRecommended").checked = Boolean(plan.isRecommended);

  openModal("modal-plan-editor");
};

window.handleTogglePlanPublish = async function(planId, currentPublished) {
  try {
    const nextState = !currentPublished;
    await FidoDB.togglePlanPublish(planId, nextState);
    showToast(`Plan ${nextState ? "published" : "unpublished"} successfully!`, "success");
    await loadAdminData();
  } catch (err) {
    showToast(err.message || "Failed to update plan status.", "error");
  }
};

window.handleDeletePlan = async function(planId) {
  const plan = allAdminPlans.find(p => p.id === planId);
  const planName = plan ? plan.name : planId;
  if (!confirm(`Are you sure you want to delete the plan "${planName}"? This action cannot be undone.`)) {
    return;
  }

  try {
    await FidoDB.deleteMembershipPlan(planId);
    showToast(`Plan "${planName}" deleted.`, "success");
    await loadAdminData();
  } catch (err) {
    showToast(err.message || "Failed to delete plan.", "error");
  }
};

window.handleSeedDefaultPlans = async function() {
  if (!confirm("This will load the 3 standard membership plans (Basic ₹499, Pro ₹1,999, Premium ₹4,999) into your database. Existing plans with those IDs will be updated. Proceed?")) {
    return;
  }

  try {
    await FidoDB.seedDefaultMembershipPlans(true);
    showToast("Default membership plans loaded successfully!", "success");
    await loadAdminData();
  } catch (err) {
    showToast(err.message || "Failed to seed default plans.", "error");
  }
};

// 7b. Memberships Table
function renderMembershipsTable() {
  const container = document.getElementById("admin-memberships-tbody");
  if (!container) return;

  if (allAdminFreelancers.length === 0) {
    container.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">No memberships to display.</td></tr>`;
    return;
  }

  container.innerHTML = allAdminFreelancers.map(f => {
    const isMember = f.membershipStatus === "active";
    return `
      <tr>
        <td>
          <strong>${f.name}</strong>
          <div style="font-size:0.8rem; color:var(--text-muted);">${f.email}</div>
        </td>
        <td>${f.membershipPlan || "Standard"}</td>
        <td>
          <span class="badge ${isMember ? "badge-active" : "badge-inactive"}">${isMember ? "Active" : "Inactive"}</span>
        </td>
        <td>${formatDate(f.membershipStart)}</td>
        <td>${formatDate(f.membershipExpiry)}</td>
        <td>
          <button class="btn ${isMember ? "btn-secondary" : "btn-primary"} btn-sm" onclick="openMembershipModal('${f.uid}', '${isMember ? "inactive" : "active"}')">
            ${isMember ? "Deactivate Membership" : "Activate Membership"}
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

let currentPaymentFilter = "all";

window.filterAdminPayments = function(filter) {
  currentPaymentFilter = filter;
  document.querySelectorAll(".admin-pay-filter-btn").forEach(btn => {
    if (btn.getAttribute("data-filter") === filter) {
      btn.classList.replace("btn-secondary", "btn-primary");
    } else {
      btn.classList.replace("btn-primary", "btn-secondary");
    }
  });
  renderPaymentsTable();
};

// 8. Payments & Membership Verifications Table
function renderPaymentsTable() {
  const container = document.getElementById("admin-payments-tbody");
  if (!container) return;

  let filtered = allAdminPayments;
  if (currentPaymentFilter === "pending-membership") {
    filtered = allAdminPayments.filter(p => p.type === "membership" && p.status === "pending");
  } else if (currentPaymentFilter === "verified-membership") {
    filtered = allAdminPayments.filter(p => p.type === "membership" && p.status === "verified");
  } else if (currentPaymentFilter === "project") {
    filtered = allAdminPayments.filter(p => p.type !== "membership");
  }

  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:2.5rem;">No payments match the selected filter.</td></tr>`;
    return;
  }

  container.innerHTML = filtered.map(p => {
    const isMembership = p.type === "membership";
    
    if (isMembership) {
      const isPending = p.status === "pending";
      const isVerified = p.status === "verified" || p.status === "Completed";
      const isRejected = p.status === "rejected";

      let statusBadge = `<span class="badge badge-review">Pending</span>`;
      if (isPending) {
        statusBadge = `<span class="badge" style="background:#fef3c7; color:#92400e; font-weight:700;">🟡 Pending UPI</span>`;
      } else if (isVerified) {
        statusBadge = `<span class="badge badge-active">✓ Verified</span>`;
      } else if (isRejected) {
        statusBadge = `<span class="badge badge-inactive" style="background:#fee2e2; color:#991b1b;">✕ Rejected</span>`;
      }

      return `
        <tr style="${isPending ? 'background: #fffdf5;' : ''}">
          <td>
            <div style="font-weight:700; color:var(--color-primary);">${p.planName || "Selected Membership"}</div>
            <span class="badge badge-proposal" style="font-size:0.72rem; margin-top:2px;">UPI Membership</span>
            ${p.returnProject ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Target Project: <strong class="font-mono">${p.returnProject}</strong></div>` : ''}
          </td>
          <td>
            <div style="font-weight:600; color:var(--color-primary);">${p.userName || p.freelancerName || "Freelancer"}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">${p.userEmail || p.freelancerEmail || ""}</div>
          </td>
          <td>
            <strong style="color:var(--color-accent); font-size:1.05rem;">₹${p.amount}</strong>
            <div style="font-size:0.75rem; color:var(--text-muted);">${p.currency || "INR"}</div>
          </td>
          <td>
            <code style="font-family:var(--font-mono); font-size:0.9rem; font-weight:700; background:var(--bg-subtle); padding:3px 6px; border-radius:4px; border:1px solid var(--border-color);">${p.transactionId || "N/A"}</code>
          </td>
          <td>${statusBadge}</td>
          <td>
            <span style="font-size:0.85rem; color:var(--color-primary);">${formatDate(p.submittedAt || p.createdAt)}</span>
            ${p.verifiedAt ? `<div style="font-size:0.75rem; color:var(--text-muted);">Verified: ${formatDate(p.verifiedAt)}</div>` : ''}
          </td>
          <td>
            ${isPending ? `
              <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                <button type="button" class="btn btn-primary btn-sm" style="padding:4px 10px; font-size:0.78rem; background:#059669; border-color:#059669;" onclick="handleAdminVerifyPayment('${p.id}')">
                  ✓ Verify
                </button>
                <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.78rem; color:#dc2626; border-color:#fecaca;" onclick="handleAdminRejectPayment('${p.id}')">
                  ✕ Reject
                </button>
              </div>
            ` : (isVerified ? `
              <span style="font-size:0.8rem; color:#059669; font-weight:600;">✓ Active (${p.verifiedBy || "Admin"})</span>
            ` : `
              <span style="font-size:0.8rem; color:#991b1b;">Rejected (${p.verifiedBy || "Admin"})</span>
            `)}
          </td>
        </tr>
      `;
    }

    // Standard Project Milestone Payment Row
    return `
      <tr>
        <td>
          <strong style="font-family:var(--font-mono);">${p.projectId || "Project"}</strong>
          <div style="font-size:0.72rem; color:var(--text-muted);">Client Project</div>
        </td>
        <td>
          <div style="font-weight:600; color:var(--color-primary);">${p.clientName || "Client"}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">${p.freelancerName ? 'To: ' + p.freelancerName : ''}</div>
        </td>
        <td>
          <div class="text-accent fw-bold">$${p.clientAmount || 0}</div>
          <div style="font-size:0.75rem; color:#10b981; font-weight:600;">Margin: $${p.agencyMargin || 0}</div>
        </td>
        <td>
          <span class="text-muted" style="font-size:0.85rem;">${p.paymentMethod || "Internal"}</span>
        </td>
        <td><span class="badge ${p.status === "Paid" ? "badge-active" : "badge-review"}">${p.status || "Completed"}</span></td>
        <td><span style="font-size:0.85rem; color:var(--text-muted);">${formatDate(p.createdAt)}</span></td>
        <td>
          <span style="font-size:0.8rem; color:var(--text-muted);">&mdash;</span>
        </td>
      </tr>
    `;
  }).join("");
}

window.handleAdminVerifyPayment = async function(paymentId) {
  if (!confirm("Are you sure you want to verify this UPI payment?\n\nThis will immediately activate the freelancer's membership for 30 days and grant project application privileges.")) {
    return;
  }

  try {
    const adminUser = FidoAuth.getCurrentUser();
    const adminEmail = adminUser ? adminUser.email : "Admin";

    await FidoDB.verifyMembershipPayment(paymentId, adminEmail);
    showToast("✓ Payment verified! Membership activated successfully.", "success");
    await loadAdminData();
  } catch (err) {
    showToast("Failed to verify payment: " + err.message, "error");
  }
};

window.handleAdminRejectPayment = async function(paymentId) {
  const reason = prompt("Enter a brief reason for rejecting this payment (optional):", "Transaction ID could not be verified in bank records.");
  if (reason === null) return; // User cancelled prompt

  try {
    const adminUser = FidoAuth.getCurrentUser();
    const adminEmail = adminUser ? adminUser.email : "Admin";

    await FidoDB.rejectMembershipPayment(paymentId, adminEmail, reason);
    showToast("Payment rejected. Membership remains inactive.", "success");
    await loadAdminData();
  } catch (err) {
    showToast("Failed to reject payment: " + err.message, "error");
  }
};

window.openAddPaymentModal = function() {
  openModal("add-payment-modal");
};

// 9. Reviews Table
function renderReviewsTable() {
  const container = document.getElementById("admin-reviews-tbody");
  if (!container) return;

  if (allAdminReviews.length === 0) {
    container.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">No reviews submitted yet.</td></tr>`;
    return;
  }

  container.innerHTML = allAdminReviews.map(r => `
    <tr>
      <td>${r.projectId}</td>
      <td>${r.clientName}</td>
      <td>${r.freelancerName}</td>
      <td>★ ${r.rating}</td>
      <td>"${r.reviewText}"</td>
      <td>${formatDate(r.createdAt)}</td>
    </tr>
  `).join("");
}

// 10. Messages Table
function renderMessagesTable() {
  const container = document.getElementById("admin-messages-tbody");
  if (!container) return;

  if (allAdminMessages.length === 0) {
    container.innerHTML = `<tr><td colspan="4" class="text-center text-muted" style="padding:2rem;">No messages logged yet.</td></tr>`;
    return;
  }

  container.innerHTML = allAdminMessages.map(m => `
    <tr>
      <td><strong style="font-family:var(--font-mono);">${m.projectId || "General"}</strong></td>
      <td>${m.senderName || m.senderId}</td>
      <td>${m.messageText}</td>
      <td>${formatDate(m.createdAt)}</td>
    </tr>
  `).join("");
}

// 11. Invite Codes Table (Module 12)
function renderInviteCodesTable() {
  const container = document.getElementById("admin-invite-codes-tbody");
  if (!container) return;

  if (allAdminInviteCodes.length === 0) {
    container.innerHTML = `<tr><td colspan="9" class="text-center text-muted" style="padding:2rem;">No invite codes created yet. Click "+ Create Invite Code" to generate one.</td></tr>`;
    return;
  }

  container.innerHTML = allAdminInviteCodes.map(code => {
    let statusBadge = `<span class="badge badge-active">Active</span>`;
    if (code.status === "used") {
      statusBadge = `<span class="badge badge-completed">Used</span>`;
    } else if (code.status === "revoked") {
      statusBadge = `<span class="badge badge-cancelled">Revoked</span>`;
    }

    return `
      <tr>
        <td>
          <span style="font-family:var(--font-mono); font-weight:700; font-size:0.9rem; color:var(--color-primary);">${code.code}</span>
        </td>
        <td>
          <span class="badge badge-inactive">${code.sourcePlatform || code.platform || "Freelancer"}${code.otherPlatform ? ` (${code.otherPlatform})` : ""}</span>
        </td>
        <td>
          ${code.freelancerName ? `<div><strong>${code.freelancerName}</strong></div>` : ""}
          ${code.username || code.freelancerHandle ? `<div style="font-size:0.78rem; color:var(--color-accent);">${code.username || code.freelancerHandle}</div>` : ""}
          ${!code.freelancerName && !code.username && !code.freelancerHandle ? `<span class="text-muted">—</span>` : ""}
        </td>
        <td>${statusBadge}</td>
        <td><span style="font-size:0.82rem; color:var(--text-muted);">${formatDate(code.createdAt)}</span></td>
        <td>
          ${code.usedByEmail ? `
            <div><strong>${code.usedByEmail}</strong></div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">${code.usedBy}</div>
          ` : `<span class="text-muted">—</span>`}
        </td>
        <td><span style="font-size:0.82rem; color:var(--text-muted);">${code.usedAt ? formatDate(code.usedAt) : "—"}</span></td>
        <td>
          ${code.note ? `<div>${code.note}</div>` : ""}
          ${code.additionalInfo ? `<div style="font-size:0.78rem; color:var(--text-muted);">${code.additionalInfo}</div>` : ""}
          ${!code.note && !code.additionalInfo ? `<span class="text-muted">—</span>` : ""}
        </td>
        <td>
          ${code.status === "active" ? `
            <button class="btn btn-secondary btn-sm" onclick="toggleInviteCodeStatus('${code.id}', 'revoked')">Revoke</button>
          ` : (code.status === "revoked" ? `
            <button class="btn btn-primary btn-sm" onclick="toggleInviteCodeStatus('${code.id}', 'active')">Reactivate</button>
          ` : (code.usedBy ? `
            <button class="btn btn-secondary btn-sm" onclick="toggleInviteCodeStatus('${code.id}', 'revoked')">Revoke Access</button>
          ` : `<span style="font-size:0.78rem; color:var(--text-muted);">Redeemed</span>`))}
        </td>
      </tr>
    `;
  }).join("");
}

window.openCreateInviteModal = function() {
  openModal("create-invite-code-modal");
};

window.toggleInviteCodeStatus = async function(codeDocId, newStatus) {
  try {
    await FidoDB.updateInviteCodeStatus(codeDocId, newStatus);
    showToast(`Invite code marked as ${newStatus}`, "success");
    await loadAdminData();
  } catch (err) {
    showToast("Failed to update invite code: " + err.message, "error");
  }
};
