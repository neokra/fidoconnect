/**
 * FidoConnect - Admin Control Dashboard Controller
 */

let allAdminProjects = [];
let allAdminApps = [];
let allAdminFreelancers = [];
let allAdminClients = [];

document.addEventListener("DOMContentLoaded", async () => {
  // Page guard for Admin role
  const currentUser = window.FidoAuth.getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    showToast("Admin access required. Please sign in with an administrator account.", "error");
    setTimeout(() => {
      window.location.href = "auth.html?redirect=admin.html";
    }, 1000);
    return;
  }

  setupAdminTabs();
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

async function loadAdminData() {
  try {
    allAdminProjects = await window.FidoDB.getProjects({});
    allAdminApps = await window.FidoDB.getApplications({});
    allAdminFreelancers = await window.FidoDB.getUsers("freelancer");
    allAdminClients = await window.FidoDB.getUsers("client");

    renderOverviewStats();
    renderProjectsTable();
    renderApplicationsTable();
    renderFreelancersTable();
    renderClientsTable();
  } catch (err) {
    console.error("Error loading admin data:", err);
    showToast("Error loading admin data.", "error");
  }
}

// 1. Overview Section
function renderOverviewStats() {
  const newRequests = allAdminProjects.filter(p => p.status === "Submitted" || p.status === "Under Review").length;
  const activeProjects = allAdminProjects.filter(p => ["Approved", "Published", "In Progress", "Client Review"].includes(p.status)).length;
  const completedProjects = allAdminProjects.filter(p => p.status === "Completed").length;
  const activeMembers = allAdminFreelancers.filter(f => f.membershipStatus === "active").length;

  document.getElementById("kpi-new-requests").textContent = newRequests;
  document.getElementById("kpi-active-projects").textContent = activeProjects;
  document.getElementById("kpi-completed-projects").textContent = completedProjects;
  document.getElementById("kpi-total-apps").textContent = allAdminApps.length;
  document.getElementById("kpi-active-members").textContent = activeMembers;
}

// 2. Projects Management
function renderProjectsTable() {
  const container = document.getElementById("admin-projects-tbody");
  if (!container) return;

  if (allAdminProjects.length === 0) {
    container.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:2rem;">No projects found.</td></tr>`;
    return;
  }

  container.innerHTML = allAdminProjects.map(proj => {
    const assignedFreelancer = allAdminFreelancers.find(f => f.uid === proj.assignedFreelancerId);

    return `
      <tr>
        <td>
          <div style="font-family:var(--font-mono); font-weight:700; font-size:0.82rem;">${proj.projectId}</div>
          <span style="font-size:0.75rem; color:var(--text-muted);">${formatDate(proj.createdAt)}</span>
        </td>
        <td>
          <strong style="color:var(--color-primary);">${proj.title}</strong>
          <div style="font-size:0.8rem; color:var(--text-muted);">${proj.category} • Budget: ${proj.budget}</div>
        </td>
        <td>
          <div>${proj.clientBusiness || proj.clientName}</div>
          <div style="font-size:0.78rem; color:var(--text-muted);">${proj.clientEmail} • ${proj.clientPhone}</div>
        </td>
        <td>
          <select class="form-control form-control-sm" style="padding:3px 6px; font-size:0.8rem; width:auto;" onchange="updateProjectStatus('${proj.id}', this.value)">
            ${[
              "Submitted", "Under Review", "Approved", "Published", 
              "In Progress", "Submitted for Review", "Client Review", 
              "Completed", "Cancelled"
            ].map(st => `<option value="${st}" ${proj.status === st ? "selected" : ""}>${st}</option>`).join("")}
          </select>
        </td>
        <td>
          <span style="font-size:0.85rem; font-weight:600;">
            ${assignedFreelancer ? assignedFreelancer.name : `<span class="text-muted">Unassigned</span>`}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:0.4rem;">
            ${proj.status === "Submitted" ? `
              <button class="btn btn-primary btn-sm" onclick="approveAndPublishProject('${proj.id}')" title="Approve & Publish to Find Work">Approve & Publish</button>
            ` : ""}
            <a href="project-details.html?id=${proj.projectId}" target="_blank" class="btn btn-secondary btn-sm">View</a>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// Fast Status Updater
window.updateProjectStatus = async function(projId, newStatus) {
  try {
    const visibility = newStatus === "Published" ? "public" : "admin_only";
    await window.FidoDB.updateProject(projId, { 
      status: newStatus,
      visibility: visibility
    });
    showToast(`Project status updated to ${newStatus}`, "success");
    await loadAdminData();
  } catch (err) {
    showToast("Failed to update status", "error");
  }
};

// Fast Approve & Publish
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
    showToast("Failed to publish project", "error");
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
          <div style="display:flex; gap:0.4rem;">
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
    showToast("Failed to update application", "error");
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
    showToast("Failed to assign freelancer", "error");
  }
};

// 4. Freelancers Table
function renderFreelancersTable() {
  const container = document.getElementById("admin-freelancers-tbody");
  if (!container) return;

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
    showToast("Failed to update membership", "error");
  }
};

// 5. Clients Table
function renderClientsTable() {
  const container = document.getElementById("admin-clients-tbody");
  if (!container) return;

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
