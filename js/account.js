/**
 * FidoConnect - Account Management Controller
 */

let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.FidoAuth.requireAuth()) return;

  currentUser = window.FidoAuth.getCurrentUser();
  renderAccountView();
  setupEventListeners();
});

function setupEventListeners() {
  // Tab switching
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

  // Check URL hash for direct tab
  if (window.location.hash) {
    const tabName = window.location.hash.replace("#", "") + "-tab";
    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.click();
  }
}

async function renderAccountView() {
  const container = document.getElementById("account-layout-container");
  if (!container) return;

  if (currentUser.role === "client") {
    await renderClientView(container);
  } else if (currentUser.role === "freelancer") {
    await renderFreelancerView(container);
  } else if (currentUser.role === "admin") {
    container.innerHTML = `
      <div class="card text-center" style="padding: 2.5rem;">
        <h3>Admin Account</h3>
        <p class="text-muted" style="margin: 0.5rem 0 1.5rem;">You are logged in as a FidoConnect administrator.</p>
        <a href="admin.html" class="btn btn-primary">Go to Admin Dashboard</a>
      </div>
    `;
  }
}

// --- Client Account View ---
async function renderClientView(container) {
  const clientProjects = await window.FidoDB.getProjects({ clientId: currentUser.uid });

  container.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
        <div>
          <h2>${currentUser.businessName || currentUser.name}</h2>
          <p class="text-muted">${currentUser.email} • Client Account</p>
        </div>
        <a href="post-work.html" class="btn btn-primary">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          Post a Work
        </a>
      </div>
    </div>

    <div class="tab-nav">
      <button class="tab-btn active" data-tab="client-projects-tab">Submitted Projects (${clientProjects.length})</button>
      <button class="tab-btn" data-tab="client-profile-tab">Account Details</button>
    </div>

    <!-- Tab 1: Client Projects -->
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

    <!-- Tab 2: Profile Settings -->
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

  // Attach profile update handler
  const profForm = document.getElementById("client-profile-form");
  if (profForm) {
    profForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await window.FidoDB.updateUser(currentUser.uid, {
          name: document.getElementById("edit-client-name").value.trim(),
          businessName: document.getElementById("edit-client-business").value.trim(),
          phone: document.getElementById("edit-client-phone").value.trim()
        });
        showToast("Profile updated successfully", "success");
      } catch (err) {
        showToast("Failed to update profile", "error");
      }
    });
  }
}

// --- Freelancer Account View ---
async function renderFreelancerView(container) {
  const applications = await window.FidoDB.getApplications({ freelancerId: currentUser.uid });
  const isMemberActive = currentUser.membershipStatus === "active";

  container.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
        <div>
          <h2>${currentUser.name}</h2>
          <p class="text-muted">${currentUser.email} • Freelancer Network</p>
        </div>
        <div>
          <span class="badge ${isMemberActive ? "badge-active" : "badge-inactive"}" style="font-size:0.88rem; padding:0.4rem 0.8rem;">
            ● Membership: ${isMemberActive ? "Active Member" : "Not Active"}
          </span>
        </div>
      </div>
    </div>

    <div class="tab-nav">
      <button class="tab-btn active" data-tab="freelancer-apps-tab">My Applications (${applications.length})</button>
      <button class="tab-btn" data-tab="membership-tab">Membership Plan</button>
      <button class="tab-btn" data-tab="freelancer-profile-tab">Profile & Skills</button>
    </div>

    <!-- Tab 1: Applications -->
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

    <!-- Tab 2: Membership Management -->
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
            Membership provides direct access to project opportunities vetted by our team. Projects are awarded based on suitability and requirements; projects are not guaranteed.
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 3: Freelancer Profile & Skills -->
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

  // Membership activate/renew simulation button
  const toggleMemberBtn = document.getElementById("toggle-membership-btn");
  if (toggleMemberBtn) {
    toggleMemberBtn.addEventListener("click", async () => {
      const newStatus = isMemberActive ? "active" : "active";
      await window.FidoDB.updateMembership(currentUser.uid, newStatus, "Standard Member");
      showToast("Membership activated! You can now apply for all open projects.", "success");
      setTimeout(() => window.location.reload(), 400);
    });
  }

  // Profile update handler
  const profForm = document.getElementById("freelancer-profile-form");
  if (profForm) {
    profForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const skillsRaw = document.getElementById("edit-free-skills").value;
        const skillsArr = skillsRaw.split(",").map(s => s.trim()).filter(Boolean);

        await window.FidoDB.updateUser(currentUser.uid, {
          name: document.getElementById("edit-free-name").value.trim(),
          phone: document.getElementById("edit-free-phone").value.trim(),
          portfolio: document.getElementById("edit-free-portfolio").value.trim(),
          skills: skillsArr
        });
        showToast("Profile updated successfully", "success");
      } catch (err) {
        showToast("Failed to update profile", "error");
      }
    });
  }
}
