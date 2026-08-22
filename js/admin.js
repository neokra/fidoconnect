/**
 * FidoConnect - Comprehensive Admin Control Dashboard Controller
 * 
 * Strict Admin Access: Only for thecard.primary@gmail.com
 * Handles all 11 modules.
 */

let allAdminProjects = [];
let allAdminApps = [];
let allAdminUsers = [];
let allAdminFreelancers = [];
let allAdminClients = [];
let allAdminPayments = [];
let allAdminReviews = [];
let allAdminMessages = [];

document.addEventListener("DOMContentLoaded", async () => {
  // Strict admin guard: only thecard.primary@gmail.com
  const currentUser = await window.FidoAuth.waitForAuth();
  
  if (!currentUser || !window.FidoAuth.isAdminEmail(currentUser.email)) {
    showToast("Access restricted to designated administrator.", "error");
    setTimeout(() => {
      window.location.href = "account.html";
    }, 1000);
    return;
  }

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

        await window.FidoDB.addPayment({
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
        await window.FidoDB.updateSettings({
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
}

async function loadAdminData() {
  try {
    const [projects, apps, users, payments, reviews, messages, stats] = await Promise.all([
      window.FidoDB.getProjects({}),
      window.FidoDB.getApplications({}),
      window.FidoDB.getUsers(),
      window.FidoDB.getPayments(),
      window.FidoDB.getReviews(),
      window.FidoDB.getMessages(),
      window.FidoDB.getDashboardStats()
    ]);

    allAdminProjects = projects;
    allAdminApps = apps;
    allAdminUsers = users;
    allAdminFreelancers = users.filter(u => u.role === "freelancer");
    allAdminClients = users.filter(u => u.role === "client");
    allAdminPayments = payments;
    allAdminReviews = reviews;
    allAdminMessages = messages;

    renderOverviewStats(stats);
    renderProjectsTable();
    renderApplicationsTable();
    renderUsersTable();
    renderFreelancersTable();
    renderClientsTable();
    renderMembershipsTable();
    renderPaymentsTable();
    renderReviewsTable();
    renderMessagesTable();

  } catch (err) {
    console.error("Error loading admin data from Firestore:", err);
    showToast("Error loading admin data: " + err.message, "error");
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
    await window.FidoDB.updateProject(projId, { 
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
    await window.FidoDB.updateProject(projId, {
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
    await window.FidoDB.updateApplication(appId, { status: newStatus });
    showToast(`Application marked as ${newStatus}`, "success");
    await loadAdminData();
  } catch (err) {
    showToast("Failed to update application: " + err.message, "error");
  }
};

window.selectFreelancerForProject = async function(projId, freelancerId, appId) {
  try {
    await window.FidoDB.updateProject(projId, {
      assignedFreelancerId: freelancerId,
      status: "In Progress",
      agencyNotes: `Freelancer selected and assigned by agency on ${formatDate(new Date())}. Work is in progress.`
    });
    await window.FidoDB.updateApplication(appId, { status: "Selected" });
    showToast("Freelancer selected and assigned to project!", "success");
    await loadAdminData();
  } catch (err) {
    showToast("Failed to assign freelancer: " + err.message, "error");
  }
};

// 4. Users Table (No assign admin button)
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
    await window.FidoDB.updateUser(uid, { status: targetStatus });
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
        </td>
        <td>
          <span style="font-size:0.85rem; font-weight:600;">★ ${f.rating || "5.0"}</span>
        </td>
        <td>
          <button class="btn ${isMember ? "btn-secondary" : "btn-primary"} btn-sm" onclick="toggleFreelancerMembership('${f.uid}', '${isMember ? "inactive" : "active"}')">
            ${isMember ? "Deactivate Membership" : "Activate Membership"}
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

window.toggleFreelancerMembership = async function(uid, targetStatus) {
  try {
    await window.FidoDB.updateMembership(uid, targetStatus);
    showToast(`Freelancer membership updated to ${targetStatus}`, "success");
    await loadAdminData();
  } catch (err) {
    showToast("Failed to update membership: " + err.message, "error");
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
          <span style="font-size:0.82rem; color:var(--text-muted);">${formatDate(c.createdAt)}</span>
        </td>
      </tr>
    `;
  }).join("");
}

// 7. Memberships Table
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
          <button class="btn ${isMember ? "btn-secondary" : "btn-primary"} btn-sm" onclick="toggleFreelancerMembership('${f.uid}', '${isMember ? "inactive" : "active"}')">
            ${isMember ? "Revoke" : "Grant Membership"}
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// 8. Payments Table
function renderPaymentsTable() {
  const container = document.getElementById("admin-payments-tbody");
  if (!container) return;

  if (allAdminPayments.length === 0) {
    container.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">No payment transactions recorded yet. Click "+ Record Payment" to add.</td></tr>`;
    return;
  }

  container.innerHTML = allAdminPayments.map(p => `
    <tr>
      <td><strong style="font-family:var(--font-mono);">${p.projectId}</strong></td>
      <td class="text-accent fw-bold">$${p.clientAmount}</td>
      <td>$${p.freelancerAmount}</td>
      <td style="color:#10b981; font-weight:600;">$${p.agencyMargin}</td>
      <td><span class="badge ${p.status === "Paid" ? "badge-active" : "badge-review"}">${p.status}</span></td>
      <td><span style="font-size:0.8rem; color:var(--text-muted);">${formatDate(p.createdAt)}</span></td>
    </tr>
  `).join("");
}

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
