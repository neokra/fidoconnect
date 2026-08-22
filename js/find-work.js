/**
 * FidoConnect - Find Work Controller
 */

let allProjects = [];
let currentCategoryFilter = "all";
let currentSearchQuery = "";

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const paramCategory = urlParams.get("category");
  if (paramCategory) {
    currentCategoryFilter = paramCategory;
  }

  setupEventListeners();
  await loadProjects();
  renderRoleMembershipState();

  // Listen to auth changes
  if (window.FidoAuth) {
    window.FidoAuth.onAuthChange(() => {
      renderRoleMembershipState();
      renderProjectsList();
    });
  }
});

function setupEventListeners() {
  // Category tab clicks
  document.querySelectorAll(".category-pill").forEach(pill => {
    pill.addEventListener("click", (e) => {
      document.querySelectorAll(".category-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentCategoryFilter = pill.getAttribute("data-category");
      renderProjectsList();
    });
  });

  // Search input
  const searchInput = document.getElementById("project-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearchQuery = e.target.value.trim().toLowerCase();
      renderProjectsList();
    });
  }
}

async function loadProjects() {
  try {
    // Only published projects are visible on Find Work
    allProjects = await window.FidoDB.getProjects({ status: "Published" });
    
    // Set active category pill if filtered via URL
    if (currentCategoryFilter !== "all") {
      document.querySelectorAll(".category-pill").forEach(pill => {
        if (pill.getAttribute("data-category").toLowerCase() === currentCategoryFilter.toLowerCase()) {
          pill.classList.add("active");
        } else {
          pill.classList.remove("active");
        }
      });
    }

    renderProjectsList();
  } catch (err) {
    console.error("Error fetching projects from Firestore:", err);
    showToast("Failed to load projects.", "error");
  }
}

function renderRoleMembershipState() {
  const bannerContainer = document.getElementById("membership-gate-banner");
  if (!bannerContainer) return;

  const currentUser = window.FidoAuth ? window.FidoAuth.getCurrentUser() : null;

  if (!currentUser) {
    // Guest view
    bannerContainer.innerHTML = `
      <div class="notice-box notice-info">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <div style="flex:1;">
          <strong>Browsing public preview</strong> — Log in or join the FidoConnect network to view complete project details and apply.
          <div style="margin-top: 0.5rem;">
            <a href="auth.html" class="btn btn-secondary btn-sm">Log in</a>
            <a href="auth.html?mode=register&role=freelancer" class="btn btn-primary btn-sm">Join as Freelancer</a>
          </div>
        </div>
      </div>
    `;
    bannerContainer.style.display = "block";
  } else if (currentUser.role === "freelancer" && currentUser.membershipStatus !== "active") {
    // Freelancer without active membership
    bannerContainer.innerHTML = `
      <div class="notice-box notice-warning" style="flex-direction:column; gap:0.6rem;">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          <strong style="font-size:1rem;">Membership required to apply for projects</strong>
        </div>
        <p style="margin:0; font-size:0.9rem; color:#78350f;">
          FidoConnect members can apply directly for available projects.
        </p>
        <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap; margin-top:0.25rem;">
          <a href="account.html#membership" class="btn btn-primary btn-sm">View Membership</a>
          <span style="font-size:0.8rem; color:#92400e;">
            * Membership provides access to project opportunities. Projects are not guaranteed.
          </span>
        </div>
      </div>
    `;
    bannerContainer.style.display = "block";
  } else if (currentUser.role === "freelancer" && currentUser.membershipStatus === "active") {
    // Active member
    bannerContainer.innerHTML = `
      <div class="notice-box notice-success" style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span><strong>Active FidoConnect Member</strong> — You have full access to submit proposals for available projects.</span>
        </div>
      </div>
    `;
    bannerContainer.style.display = "block";
  } else {
    bannerContainer.style.display = "none";
  }
}

function renderProjectsList() {
  const container = document.getElementById("projects-grid");
  const countEl = document.getElementById("results-count");
  if (!container) return;

  const filtered = allProjects.filter(p => {
    if (currentCategoryFilter !== "all" && p.category.toLowerCase() !== currentCategoryFilter.toLowerCase()) {
      return false;
    }
    if (currentSearchQuery) {
      const matchTitle = (p.title || "").toLowerCase().includes(currentSearchQuery);
      const matchDesc = (p.description || "").toLowerCase().includes(currentSearchQuery);
      const matchId = (p.projectId || "").toLowerCase().includes(currentSearchQuery);
      if (!matchTitle && !matchDesc && !matchId) return false;
    }
    return true;
  });

  if (countEl) {
    countEl.textContent = `${filtered.length} project${filtered.length === 1 ? "" : "s"} available`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card text-center" style="grid-column: 1 / -1; padding: 3rem 1rem;">
        <svg width="40" height="40" style="margin:0 auto 1rem; color:var(--text-light);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <h3>No projects found</h3>
        <p class="text-muted" style="margin-top:0.4rem;">Try selecting a different category or clear your search.</p>
      </div>
    `;
    return;
  }

  const currentUser = window.FidoAuth ? window.FidoAuth.getCurrentUser() : null;
  const canApplyDirectly = currentUser && currentUser.role === "freelancer" && currentUser.membershipStatus === "active";

  container.innerHTML = filtered.map(project => `
    <div class="project-card">
      <div class="project-card-header">
        <span class="project-id-badge">${project.projectId || project.id}</span>
        <span class="project-category-badge">${project.category}</span>
      </div>

      <div>
        <h3 class="project-title">${project.title}</h3>
        <p class="project-desc" style="margin-top:0.4rem;">${project.description}</p>
      </div>

      <div class="project-meta-grid">
        <div class="meta-item">
          <span class="meta-label">Budget</span>
          <span class="meta-val text-accent">${project.budget}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Deadline</span>
          <span class="meta-val">${formatDate(project.deadline)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Posted</span>
          <span class="meta-val">${formatDate(project.createdAt)}</span>
        </div>
      </div>

      <div class="project-card-footer">
        <span style="font-size:0.8rem; color:var(--text-muted);">
          Agency Coordinated
        </span>
        <a href="project-details.html?id=${project.projectId || project.id}" class="btn ${canApplyDirectly ? "btn-primary" : "btn-secondary"} btn-sm">
          ${canApplyDirectly ? "Apply for Project" : "View Details"}
        </a>
      </div>
    </div>
  `).join("");
}
