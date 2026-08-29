/**
 * FidoConnect - Find Work Controller
 * 
 * Features:
 * - Public & Verified project browsing
 * - Invite-only verification gate
 * - One-time Freelancer Skill Profile onboarding
 * - Dynamic Category & Subcategory taxonomy
 * - Skill-matched project unlocking & locked card indicators
 */

import { FidoAuth } from "./auth.js";
import { FidoDB, SKILL_TAXONOMY } from "./db.js";

let allProjects = [];
let currentCategoryFilter = "all";
let currentSearchQuery = "";
let pendingTargetProjectId = null;

// Modal skill selection state
let selectedModalCategories = new Set();
let selectedModalSubcategories = new Set();

document.addEventListener("DOMContentLoaded", async () => {
  const isAuth = await FidoAuth.requireAuth();
  if (!isAuth) return;

  const currentUser = FidoAuth.getCurrentUser();
  const role = FidoAuth.getUserRole(currentUser);
  const isAdmin = role === "admin";
  const isClient = role === "client" && Boolean(currentUser);

  // If the logged-in user is a client (and not admin), redirect to post-work
  if (isClient && !isAdmin) {
    if (typeof showToast === "function") {
      showToast("Find Work is for freelancers. As a client, you can post a work request.", "info");
    }
    window.location.href = "post-work.html";
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const paramCategory = urlParams.get("category");
  if (paramCategory) {
    currentCategoryFilter = paramCategory;
  }

  setupEventListeners();
  await loadProjects();
  renderRoleMembershipState();

  FidoAuth.onAuthChange((user) => {
    const r = FidoAuth.getUserRole(user);
    if (r === "client" && Boolean(user) && !FidoAuth.isAdmin()) {
      if (typeof showToast === "function") {
        showToast("Find Work is for freelancers. As a client, you can post a work request.", "info");
      }
      window.location.href = "post-work.html";
      return;
    }
    renderRoleMembershipState();
    renderProjectsList();
  });
});

function setupEventListeners() {
  // Category filter pills on the main page
  document.querySelectorAll(".category-pill").forEach(pill => {
    pill.addEventListener("click", () => {
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

  // Invite code verification form
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

        const currentUser = FidoAuth.getCurrentUser();
        // Check if skill profile is completed
        if (!FidoAuth.isSkillProfileComplete(currentUser)) {
          openSkillProfileModal(pendingTargetProjectId);
        } else if (pendingTargetProjectId) {
          handleTargetProjectNavigation(pendingTargetProjectId);
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

  // Skill Profile Modal setup
  setupSkillProfileModal();
}

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
        // Remove subcategories of this category
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
      const currentUser = FidoAuth.getCurrentUser();
      if (!currentUser) return;

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
        await FidoDB.saveSkillProfile(currentUser.uid, {
          categories,
          subcategories,
          bio,
          customSkills
        });

        closeModal("skill-profile-modal");
        showToast("Skill profile saved successfully!", "success");

        renderRoleMembershipState();
        renderProjectsList();

        if (pendingTargetProjectId) {
          handleTargetProjectNavigation(pendingTargetProjectId);
          pendingTargetProjectId = null;
        }
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

  // Attach chip click handlers
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

export function openSkillProfileModal(targetProjectId = "") {
  pendingTargetProjectId = targetProjectId || null;
  const currentUser = FidoAuth.getCurrentUser();

  selectedModalCategories = new Set(currentUser && Array.isArray(currentUser.categories) ? currentUser.categories : []);
  selectedModalSubcategories = new Set(currentUser && Array.isArray(currentUser.subcategories) ? currentUser.subcategories : []);

  // Set checkboxes
  document.querySelectorAll(".skill-category-option").forEach(opt => {
    const checkbox = opt.querySelector("input[type='checkbox']");
    if (checkbox) {
      const isChecked = selectedModalCategories.has(checkbox.value);
      checkbox.checked = isChecked;
      if (isChecked) opt.classList.add("selected");
      else opt.classList.remove("selected");
    }
  });

  // Set bio & custom skills
  const bioInput = document.getElementById("modalBioInput");
  if (bioInput) bioInput.value = (currentUser && currentUser.bio) || "";

  const customSkillsInput = document.getElementById("modalCustomSkillsInput");
  if (customSkillsInput) customSkillsInput.value = (currentUser && currentUser.customSkills) || "";

  renderModalSubcategories();
  openModal("skill-profile-modal");
}
window.openSkillProfileModal = openSkillProfileModal;

function handleTargetProjectNavigation(projectId) {
  const currentUser = FidoAuth.getCurrentUser();
  const project = allProjects.find(p => (p.projectId || p.id) === projectId || p.id === projectId);

  if (!project) {
    window.location.href = `project-details.html?id=${encodeURIComponent(projectId)}`;
    return;
  }

  const isMatch = FidoDB.checkProjectSkillMatch(project, currentUser);
  if (isMatch || FidoAuth.isAdmin()) {
    window.location.href = `project-details.html?id=${encodeURIComponent(projectId)}`;
  } else {
    showToast(`Project ${project.projectId || project.id} requires ${project.category} skills, which are outside your verified profile.`, "info");
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
    const hasSkillProfile = FidoAuth.isSkillProfileComplete(currentUser);

    if (!hasSkillProfile) {
      bannerContainer.innerHTML = `
        <div class="notice-box notice-warning" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <div>
              <strong>Skill Profile Setup Required</strong> — Tell us what you can do so we can match you with the right projects.
            </div>
          </div>
          <div>
            <button type="button" class="btn btn-primary btn-sm" onclick="openSkillProfileModal('')">Complete Skill Profile</button>
          </div>
        </div>
      `;
    } else {
      const cats = (currentUser.categories || []).join(", ");
      bannerContainer.innerHTML = `
        <div class="notice-box notice-success" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <div>
              <strong>Verified Skill Profile:</strong> Unlocked projects match your selected services (${cats}).
            </div>
          </div>
          <div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="openSkillProfileModal('')">Update Skills</button>
          </div>
        </div>
      `;
    }
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
  const isAdmin = FidoAuth.isAdmin();
  const isFreelancer = currentUser && currentUser.role === "freelancer";
  const isVerifiedFreelancer = isFreelancer && FidoAuth.isFreelancerVerified(currentUser);
  const hasSkillProfile = isVerifiedFreelancer && FidoAuth.isSkillProfileComplete(currentUser);

  container.innerHTML = filtered.map(project => {
    const projId = project.projectId || project.id;
    let cardClass = "project-card";
    let matchBadge = "";
    let actionButton = "";

    if (isAdmin) {
      actionButton = `
        <a href="project-details.html?id=${projId}" class="btn btn-secondary btn-sm">
          View Details
        </a>
      `;
    } else if (!currentUser || !isVerifiedFreelancer) {
      actionButton = `
        <button type="button" class="btn btn-secondary btn-sm" onclick="handleProjectActionClick('${projId}')">
          Unlock Details
        </button>
      `;
    } else if (!hasSkillProfile) {
      // Verified but hasn't completed skill profile yet
      matchBadge = `<span class="badge badge-inactive" style="font-size:0.75rem;">Profile Setup</span>`;
      actionButton = `
        <button type="button" class="btn btn-primary btn-sm" onclick="handleProjectActionClick('${projId}')">
          View Details & Apply
        </button>
      `;
    } else {
      // Verified with completed skill profile
      const isMatch = FidoDB.checkProjectSkillMatch(project, currentUser);

      if (isMatch) {
        matchBadge = `<span class="badge badge-active" style="font-size:0.75rem;">✓ Matches your skills</span>`;
        actionButton = `
          <a href="project-details.html?id=${projId}" class="btn btn-primary btn-sm">
            View Details & Apply
          </a>
        `;
      } else {
        cardClass += " project-card-locked";
        matchBadge = `<span class="badge" style="background:#fee2e2; color:#991b1b; font-size:0.75rem;">🔒 Skill mismatch</span>`;
        actionButton = `
          <button type="button" class="btn btn-secondary btn-sm" onclick="handleLockedProjectClick('${project.category}')" style="cursor:not-allowed; opacity:0.8;">
            🔒 Locked
          </button>
        `;
      }
    }

    return `
      <div class="${cardClass}">
        <div class="project-card-header">
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span class="project-id-badge">${projId}</span>
            <span class="project-category-badge">${project.category}</span>
          </div>
          ${matchBadge}
        </div>

        <div>
          <h3 class="project-title">${project.title}</h3>
          ${Array.isArray(project.customFields) && project.customFields.length > 0 ? `
            <div class="project-custom-fields" style="display:flex; flex-wrap:wrap; gap:0.35rem 0.5rem; margin-top:0.45rem; margin-bottom:0.45rem;">
              ${project.customFields.map(f => {
                const heading = (f.heading || '').trim();
                const val = (f.value || '').trim();
                if (!heading && !val) return '';
                let displayText = '';
                if (heading && val) {
                  if (heading.toLowerCase().endsWith(' on') || heading.toLowerCase().endsWith(' on ')) {
                    displayText = `${heading} ${val}`;
                  } else {
                    displayText = `${heading}: ${val}`;
                  }
                } else {
                  displayText = heading || val;
                }
                return `
                  <span class="project-custom-field-badge" style="display:inline-flex; align-items:center; gap:5px; font-size:0.8rem; font-weight:600; padding:0.2rem 0.6rem; background:#f1f5f9; color:var(--color-primary, #0f172a); border:1px solid #cbd5e1; border-radius:4px; letter-spacing:0.01em;">
                    <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--color-accent, #6366f1);"></span>
                    <span>${escapeHtml(displayText)}</span>
                  </span>
                `;
              }).join('')}
            </div>
          ` : ''}
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
          ${actionButton}
        </div>
      </div>
    `;
  }).join("");
}

window.handleProjectActionClick = function(projectId) {
  const currentUser = FidoAuth.getCurrentUser();

  if (!currentUser) {
    window.location.href = `auth.html?redirect=${encodeURIComponent("find-work.html")}`;
    return;
  }

  if (currentUser.role === "freelancer") {
    if (!FidoAuth.isFreelancerVerified(currentUser)) {
      openInviteModalForProject(projectId);
      return;
    }

    if (!FidoAuth.isSkillProfileComplete(currentUser)) {
      openSkillProfileModal(projectId);
      return;
    }

    handleTargetProjectNavigation(projectId);
  } else {
    window.location.href = `project-details.html?id=${encodeURIComponent(projectId)}`;
  }
};

window.handleLockedProjectClick = function(categoryName) {
  showToast(`🔒 Locked — This project requires ${categoryName} skills, which are outside your verified profile.`, "info");
};

window.openInviteModalForProject = function(projectId) {
  pendingTargetProjectId = projectId || null;
  const input = document.getElementById("modalInviteCodeInput");
  if (input) input.value = "";
  openModal("invite-code-modal");
};

window.handleUnverifiedDetailsClick = function(projectId) {
  openInviteModalForProject(projectId);
};
