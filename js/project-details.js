/**
 * FidoConnect - Project Details & Application Controller
 * 
 * Access Enforcement:
 * - Admin: Unrestricted access
 * - Client: Project owner & general client overview
 * - Freelancer: Requires invite verification, completed skill profile, AND matched skill category
 */

import { FidoAuth } from "./auth.js";
import { FidoDB, SKILL_TAXONOMY } from "./db.js";

let currentProject = null;
let currentProjectId = "";

// Skill modal state
let selectedModalCategories = new Set();
let selectedModalSubcategories = new Set();

document.addEventListener("DOMContentLoaded", async () => {
  const isAuth = await FidoAuth.requireAuth();
  if (!isAuth) return;

  const urlParams = new URLSearchParams(window.location.search);
  currentProjectId = urlParams.get("id");

  if (!currentProjectId) {
    showToast("No project specified.", "error");
    window.location.href = "find-work.html";
    return;
  }

  setupInviteModal(currentProjectId);
  setupSkillProfileModal();
  await evaluateAndLoadProject();

  // Check if returning from plans page after membership activation
  const fromPlan = urlParams.get("from_plan");
  const membershipActivated = urlParams.get("membership_activated");
  const currentUser = FidoAuth.getCurrentUser();

  if ((fromPlan === "true" || membershipActivated === "true") && currentUser && currentUser.membershipStatus === "active") {
    showToast("✓ Membership active! You can now submit your proposal.", "success");
    restoreApplicationDraft(currentProjectId);
    setTimeout(() => {
      openModal("apply-modal");
    }, 400);
  }

  FidoAuth.onAuthChange(async () => {
    await evaluateAndLoadProject();
  });
});

async function evaluateAndLoadProject() {
  const currentUser = FidoAuth.getCurrentUser();
  if (!currentUser) return;

  const isAdmin = FidoAuth.isAdmin();
  const isClient = currentUser.role === "client";
  const isFreelancer = currentUser.role === "freelancer";

  if (isAdmin || isClient) {
    await loadProjectDetails(currentProjectId);
    setupApplicationForm();
    return;
  }

  if (isFreelancer) {
    if (!FidoAuth.isFreelancerVerified(currentUser)) {
      openModal("invite-code-modal");
      return;
    }

    if (!FidoAuth.isSkillProfileComplete(currentUser)) {
      openSkillProfileModal();
      return;
    }

    // Verified & skill profile complete -> load and verify match
    await loadProjectDetails(currentProjectId);
    setupApplicationForm();
    restoreApplicationDraft(currentProjectId);
  }
}

function setupInviteModal(projectId) {
  const inviteForm = document.getElementById("invite-verify-form");
  if (!inviteForm) return;

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
      if (!FidoAuth.isSkillProfileComplete(currentUser)) {
        openSkillProfileModal();
      } else {
        await loadProjectDetails(projectId);
        setupApplicationForm();
      }
    } catch (err) {
      showToast(err.message || "Invalid invite code.", "error");
      btn.disabled = false;
      btn.textContent = "Verify Code";
    }
  });
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
        showToast("Skill profile updated successfully!", "success");

        await evaluateAndLoadProject();
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
  const currentUser = FidoAuth.getCurrentUser();

  selectedModalCategories = new Set(currentUser && Array.isArray(currentUser.categories) ? currentUser.categories : []);
  selectedModalSubcategories = new Set(currentUser && Array.isArray(currentUser.subcategories) ? currentUser.subcategories : []);

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
  if (bioInput) bioInput.value = (currentUser && currentUser.bio) || "";

  const customSkillsInput = document.getElementById("modalCustomSkillsInput");
  if (customSkillsInput) customSkillsInput.value = (currentUser && currentUser.customSkills) || "";

  renderModalSubcategories();
  openModal("skill-profile-modal");
}
window.openSkillProfileModal = openSkillProfileModal;

async function loadProjectDetails(projectId) {
  try {
    currentProject = await FidoDB.getProjectById(projectId);

    if (!currentProject) {
      document.getElementById("project-content-container").innerHTML = `
        <div class="card text-center" style="grid-column: 1 / -1; padding: 3rem 1rem;">
          <h3>Project Not Found</h3>
          <p class="text-muted" style="margin: 0.5rem 0 1.5rem;">The requested project could not be located or has been archived.</p>
          <a href="find-work.html" class="btn btn-secondary">Back to Find Work</a>
        </div>
      `;
      return;
    }

    const currentUser = FidoAuth.getCurrentUser();
    const isAdmin = FidoAuth.isAdmin();

    // Security Check: Match check for Freelancers
    if (!isAdmin && currentUser && currentUser.role === "freelancer") {
      const isMatch = FidoDB.checkProjectSkillMatch(currentProject, currentUser);
      if (!isMatch) {
        const userCats = (currentUser.categories || []).join(", ") || "None";
        document.getElementById("project-content-container").innerHTML = `
          <div class="card text-center" style="grid-column: 1 / -1; padding: 3rem 1.5rem; max-width: 680px; margin: 0 auto;">
            <div style="width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #991b1b; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem;">
              <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            </div>
            <h2 style="font-size: 1.6rem; margin-bottom: 0.5rem;">Project Locked — Skill Mismatch</h2>
            <p class="text-muted" style="max-width: 520px; margin: 0 auto 1.5rem; font-size: 0.95rem; line-height: 1.6;">
              Project <strong>${currentProject.projectId || currentProject.id}</strong> requires skills in <strong>${currentProject.category}</strong>, which is outside your verified skill profile (${userCats}).
            </p>
            <div style="display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
              <a href="find-work.html" class="btn btn-primary">Browse Matching Projects</a>
              <button type="button" class="btn btn-secondary" onclick="openSkillProfileModal()">Update Your Skills</button>
            </div>
          </div>
        `;
        return;
      }
    }

    document.getElementById("proj-id").textContent = currentProject.projectId || currentProject.id;
    document.getElementById("proj-title").textContent = currentProject.title;
    document.getElementById("proj-category").textContent = currentProject.category;
    document.getElementById("proj-status-badge").innerHTML = getStatusBadge(currentProject.status);
    document.getElementById("proj-description").textContent = currentProject.description;
    document.getElementById("proj-requirements").textContent = currentProject.requirements || "Standard professional quality delivery.";
    document.getElementById("proj-budget").textContent = currentProject.budget;
    document.getElementById("proj-deadline").textContent = formatDate(currentProject.deadline);
    document.getElementById("proj-posted").textContent = formatDate(currentProject.createdAt);

    const skillsContainer = document.getElementById("proj-skills");
    if (skillsContainer) {
      const skills = currentProject.requiredSkills || [currentProject.category];
      skillsContainer.innerHTML = skills.map(s => `<span class="badge badge-inactive">${s}</span>`).join(" ");
    }

    await renderApplicationCTA();

  } catch (err) {
    console.error("Error loading project:", err);
    showToast("Failed to load project details.", "error");
  }
}

async function renderApplicationCTA() {
  const ctaContainer = document.getElementById("project-action-cta");
  if (!ctaContainer || !currentProject) return;

  const currentUser = FidoAuth.getCurrentUser();

  if (!currentUser) {
    ctaContainer.innerHTML = `
      <div class="card text-center" style="padding: 1.5rem;">
        <h4>Want to work on this project?</h4>
        <p class="text-muted" style="font-size:0.9rem; margin:0.4rem 0 1rem;">Join FidoConnect or log in to submit your proposal.</p>
        <a href="auth.html?redirect=${encodeURIComponent(window.location.href)}" class="btn btn-primary btn-block">Log In to Apply</a>
      </div>
    `;
    return;
  }

  if (currentUser.role === "client") {
    const isOwner = currentProject.clientId === currentUser.uid;
    ctaContainer.innerHTML = `
      <div class="card" style="background-color:var(--bg-subtle);">
        <h4>${isOwner ? "Your Submitted Project" : "Client Account View"}</h4>
        <p class="text-muted" style="font-size:0.88rem; margin:0.4rem 0 1rem;">
          ${isOwner ? "You posted this project request. FidoConnect coordinates candidate vetting and delivery." : "This project was posted by a FidoConnect client."}
        </p>
        <div style="font-size:0.85rem; color:var(--text-muted);">
          Status: <strong>${currentProject.status}</strong>
        </div>
      </div>
    `;
    return;
  }

  if (currentUser.role === "admin") {
    ctaContainer.innerHTML = `
      <div class="card" style="background-color:var(--bg-subtle);">
        <h4>Administrator View</h4>
        <p class="text-muted" style="font-size:0.85rem; margin:0.4rem 0 1rem;">
          Manage status, review submitted proposals, and assign professionals from the admin panel.
        </p>
        <a href="admin.html#projects" class="btn btn-primary btn-sm btn-block">Open in Admin Console</a>
      </div>
    `;
    return;
  }

  // Role is Freelancer
  const isVerified = FidoAuth.isFreelancerVerified(currentUser);
  if (!isVerified) {
    ctaContainer.innerHTML = `
      <div class="card text-center" style="padding: 1.5rem;">
        <h4>Invite Verification Required</h4>
        <p class="text-muted" style="font-size:0.88rem; margin:0.4rem 0 1rem;">
          Freelancer access is invite-only. Enter your FidoConnect invite code to apply for work.
        </p>
        <button type="button" class="btn btn-primary btn-block" onclick="openModal('invite-code-modal')">
          Enter Invite Code
        </button>
      </div>
    `;
    return;
  }

  const userApps = await FidoDB.getApplications({
    freelancerId: currentUser.uid
  });

  const thisProjId = currentProject.projectId || currentProject.id;
  const thisProjectApp = userApps.find(a => a.projectId === thisProjId || a.projectId === currentProject.id || a.projectId === currentProject.projectId);

  if (thisProjectApp) {
    ctaContainer.innerHTML = `
      <div class="card" style="border: 2px solid var(--color-primary-light); background-color: var(--bg-surface);">
        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.6rem;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--color-primary);"></span>
          <h4 style="margin:0; font-size:1rem;">Application Submitted</h4>
        </div>
        <p class="text-muted" style="font-size:0.85rem; margin-bottom:0.75rem;">
          Your proposal is under agency review.
        </p>
        <div style="font-size:0.82rem; color:var(--text-muted); background:var(--bg-subtle); padding:0.6rem; border-radius:var(--radius-sm); margin-bottom:0.75rem;">
          Status: <strong>${thisProjectApp.status || "Submitted"}</strong><br/>
          Submitted: ${formatDate(thisProjectApp.createdAt)}
        </div>
        <a href="account.html" class="btn btn-secondary btn-sm btn-block">View in Account</a>
      </div>
    `;
    return;
  }

  // Check if freelancer has an active application on another project (1 active application rule)
  const activeAppOther = userApps.find(a => 
    !["Rejected", "Withdrawn", "Closed", "Completed", "Cancelled"].includes(a.status)
  );

  if (activeAppOther) {
    ctaContainer.innerHTML = `
      <div class="card" style="background-color: var(--bg-subtle); border-left: 4px solid var(--status-submitted);">
        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--status-submitted);"></span>
          <h4 style="margin:0; font-size:0.98rem;">Active Application in Progress</h4>
        </div>
        <p class="text-muted" style="font-size:0.84rem; line-height:1.5; margin-bottom:0.75rem;">
          You currently have an active proposal for project <strong>${activeAppOther.projectId}</strong> (Status: <strong>${activeAppOther.status || "Submitted"}</strong>, Submitted: ${formatDate(activeAppOther.createdAt)}). Freelancers can have one active application at a time.
        </p>
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          <a href="account.html" class="btn btn-secondary btn-sm btn-block">View Active Application in Account</a>
        </div>
      </div>
    `;
    return;
  }

  const isMemberActive = currentUser.membershipStatus === "active";

  ctaContainer.innerHTML = `
    <div class="card" style="background-color:var(--bg-subtle);">
      <h4 style="margin-bottom:0.4rem;">Submit Proposal</h4>
      <p class="text-muted" style="font-size:0.85rem; margin-bottom:1.25rem;">
        FidoConnect coordinates deliverables and manages client payments directly.
      </p>
      
      <button id="btn-open-apply-modal" class="btn btn-primary btn-block btn-lg" onclick="openModal('apply-modal')">
        Apply for this Project
      </button>

      <div style="margin-top:0.75rem; font-size:0.78rem; color:var(--text-muted); text-align:center;">
        ${isMemberActive ? '<span style="color:var(--color-teal); font-weight:600;">✓ Active FidoConnect Member</span>' : 'Membership required to submit your application'}
      </div>
    </div>
  `;
}

function restoreApplicationDraft(projectId) {
  if (!projectId) return;
  try {
    const raw = sessionStorage.getItem("fc_app_draft_" + projectId);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (draft.message) {
      const msgEl = document.getElementById("appMessage");
      if (msgEl) msgEl.value = draft.message;
    }
    if (draft.deliveryDays) {
      const delEl = document.getElementById("appDeliveryTime");
      if (delEl) delEl.value = draft.deliveryDays;
    }
    if (draft.portfolio) {
      const portEl = document.getElementById("appPortfolio");
      if (portEl) portEl.value = draft.portfolio;
    }
  } catch (e) {
    console.warn("Could not restore application draft:", e);
  }
}

window.handleMembershipModalClose = function() {
  closeModal("membership-required-modal");
  openModal("apply-modal");
};

window.handleViewMembershipPlans = function() {
  const msg = document.getElementById("appMessage") ? document.getElementById("appMessage").value.trim() : "";
  const delivery = document.getElementById("appDeliveryTime") ? document.getElementById("appDeliveryTime").value.trim() : "";
  const portfolio = document.getElementById("appPortfolio") ? document.getElementById("appPortfolio").value.trim() : "";

  if (currentProjectId) {
    sessionStorage.setItem("fc_app_draft_" + currentProjectId, JSON.stringify({
      message: msg,
      deliveryDays: delivery,
      portfolio: portfolio
    }));
  }

  closeModal("membership-required-modal");
  window.location.href = `account.html?tab=membership&return_project=${encodeURIComponent(currentProjectId)}`;
};

function setupApplicationForm() {
  const form = document.getElementById("application-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentUser = FidoAuth.getCurrentUser();

    if (!currentUser) {
      showToast("Please log in to apply.", "error");
      return;
    }

    if (currentUser.role === "freelancer" && !FidoAuth.isFreelancerVerified(currentUser)) {
      showToast("Freelancer verification is required to submit proposals.", "error");
      return;
    }

    const message = document.getElementById("appMessage").value.trim();
    const deliveryDays = document.getElementById("appDeliveryTime") ? document.getElementById("appDeliveryTime").value.trim() : "Flexible";
    const portfolio = document.getElementById("appPortfolio") ? document.getElementById("appPortfolio").value.trim() : "";
    const submitBtn = document.getElementById("submit-app-btn");

    if (!message) {
      showToast("Please write a short proposal.", "error");
      return;
    }

    // Save draft in session
    const targetProjId = currentProject.projectId || currentProject.id;
    sessionStorage.setItem("fc_app_draft_" + targetProjId, JSON.stringify({
      message,
      deliveryDays,
      portfolio
    }));

    // Step 1: Check Membership Gate BEFORE Application Submission
    if (currentUser.role === "freelancer" && currentUser.membershipStatus !== "active") {
      closeModal("apply-modal");
      openModal("membership-required-modal");
      return;
    }

    // Step 2: One active application check
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "Verifying...";

      const userApps = await FidoDB.getApplications({ freelancerId: currentUser.uid });
      const activeApp = userApps.find(a => 
        !["Rejected", "Withdrawn", "Closed", "Completed", "Cancelled"].includes(a.status)
      );

      if (activeApp && activeApp.projectId !== targetProjId) {
        showToast(`You already have an active application for project ${activeApp.projectId}. Freelancers can have one active application at a time.`, "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Application";
        return;
      }

      submitBtn.textContent = "Submitting Proposal...";

      await FidoDB.createApplication({
        projectId: targetProjId,
        freelancerId: currentUser.uid,
        freelancerName: currentUser.name,
        freelancerEmail: currentUser.email,
        skills: currentUser.skills || [],
        portfolio: portfolio || currentUser.portfolio || "",
        message: message,
        deliveryDays: deliveryDays || "Flexible"
      });

      sessionStorage.removeItem("fc_app_draft_" + targetProjId);

      closeModal("apply-modal");
      showToast("Proposal submitted successfully!", "success");
      await renderApplicationCTA();

    } catch (err) {
      showToast(err.message || "Failed to submit proposal.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Application";
    }
  });
}
