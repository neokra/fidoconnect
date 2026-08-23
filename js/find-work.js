/**
 * FidoConnect - Find Work Controller
 */

import { FidoAuth } from "./auth.js";
import { FidoDB } from "./db.js";

let allProjects = [];
let currentCategoryFilter = "all";
let currentSearchQuery = "";
let pendingTargetProjectId = null;

document.addEventListener("DOMContentLoaded", async () => {
  const isAuth = await FidoAuth.requireAuth();
  if (!isAuth) return;

  const urlParams = new URLSearchParams(window.location.search);
  const paramCategory = urlParams.get("category");
  if (paramCategory) {
    currentCategoryFilter = paramCategory;
  }

  setupEventListeners();
  await loadProjects();
  renderRoleMembershipState();

  FidoAuth.onAuthChange(() => {
    renderRoleMembershipState();
    renderProjectsList();
  });
});

function setupEventListeners() {
  document.querySelectorAll(".category-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".category-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentCategoryFilter = pill.getAttribute("data-category");
      renderProjectsList();
    });
  });

  const searchInput = document.getElementById("project-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearchQuery = e.target.value.trim().toLowerCase();
      renderProjectsList();
    });
  }

  const inviteForm = document.getElementById("invite-verify-form");
  if (inviteForm) {
    inviteForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("modalInviteCodeInput");
      const btn = document.getElementById("modalInviteVerifyBtn");
      const code = input ? input.value.trim() : "";

      if (!code) {
        showToast("Please enter an invite code.", "error");
        return;
      }

      btn.disabled = true;
      btn.textContent = "Verifying...";

      try {
        await FidoAuth.verifyFreelancerInvite(code);
        closeModal("invite-code-modal");
        showToast("Invite code verified successfully!", "success");

        if (pendingTargetProjectId) {
          window.location.href = `project-details.html?id=${encodeURIComponent(pendingTargetProjectId)}`;
        } else {
          renderRoleMembershipState();
          renderProjectsList();
        }
      } catch (err) {
        showToast(err.message || "Invalid invite code.", "error");
        btn.disabled = false;
        btn.textContent = "Verify Code";
      }
    });
  }
}

async function loadProjects() {
  try {
    let projs = await FidoDB.getPublicProjects({ status: "Published" });
    if (projs.length === 0) {
      try {
        projs = await FidoDB.getProjects({ status: "Published" });
      } catch (e) {}
    }
    allProjects = projs;
    
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

  const currentUser = FidoAuth.getCurrentUser();

  if (!currentUser) {
    bannerContainer.innerHTML = `
      <div class="notice-box notice-info">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <div style="flex:1;">
          <strong>Browsing public preview</strong> — Log in or join the FidoConnect network to view complete project details and apply.
          <div style="margin-top: 0.5rem;">
            <a href="auth.html" class="btn btn-secondary btn-sm">Log In</a>
            <a href="auth.html?mode=register&role=freelancer" class="btn btn-primary btn-sm">Join as Freelancer</a>
          </div>
        </div>
      </div>
    `;
    bannerContainer.style.display = "block";
  } else if (currentUser.role === "freelancer" && !FidoAuth.isFreelancerVerified(currentUser)) {
    bannerContainer.innerHTML = `
      <div class="notice-box notice-info" style="flex-direction:column; gap:0.5rem;">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <strong style="font-size:1rem;">Freelancer access is invite-only.</strong>
        </div>
        <p style="margin:0; font-size:0.9rem; color:var(--text-color);">
          Enter your FidoConnect invite code to unlock project details and apply for work.
        </p>
        <div style="margin-top:0.25rem;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="openInviteModalForProject('')">Enter Invite Code</button>
        </div>
      </div>
    `;
    bannerContainer.style.display = "block";
  } else if (currentUser.role === "freelancer" && FidoAuth.isFreelancerVerified(currentUser)) {
    bannerContainer.innerHTML = `
      <div class="notice-box notice-success" style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span><strong>Verified Freelancer Access</strong> — You have full access to view project specifications and submit proposals.</span>
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

  const currentUser = FidoAuth.getCurrentUser();
  const isVerifiedFreelancer = currentUser && currentUser.role === "freelancer" && FidoAuth.isFreelancerVerified(currentUser);
  const isUnverifiedFreelancer = currentUser && currentUser.role === "freelancer" && !FidoAuth.isFreelancerVerified(currentUser);

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
        ${isUnverifiedFreelancer ? `
          <button type="button" class="btn btn-secondary btn-sm" onclick="openInviteModalForProject('${project.projectId || project.id}')">
            View Details
          </button>
        ` : `
          <a href="project-details.html?id=${project.projectId || project.id}" class="btn ${isVerifiedFreelancer ? "btn-primary" : "btn-secondary"} btn-sm">
            ${isVerifiedFreelancer ? "Apply for Project" : "View Details"}
          </a>
        `}
      </div>
    </div>
  `).join("");
}

window.openInviteModalForProject = function(projectId) {
  pendingTargetProjectId = projectId || null;
  const input = document.getElementById("modalInviteCodeInput");
  if (input) input.value = "";
  openModal("invite-code-modal");
};

window.handleUnverifiedDetailsClick = function(projectId) {
  openInviteModalForProject(projectId);
};
