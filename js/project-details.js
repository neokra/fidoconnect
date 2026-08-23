/**
 * FidoConnect - Project Details & Application Controller
 */

import { FidoAuth } from "./auth.js";
import { FidoDB } from "./db.js";

let currentProject = null;

document.addEventListener("DOMContentLoaded", async () => {
  const isAuth = await FidoAuth.requireAuth();
  if (!isAuth) return;

  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get("id");

  if (!projectId) {
    showToast("No project specified.", "error");
    window.location.href = "find-work.html";
    return;
  }

  const currentUser = FidoAuth.getCurrentUser();
  const isUnverifiedFreelancer = currentUser && currentUser.role === "freelancer" && !FidoAuth.isFreelancerVerified(currentUser);

  setupInviteModal(projectId);

  if (isUnverifiedFreelancer) {
    openModal("invite-code-modal");
  } else {
    await loadProjectDetails(projectId);
    setupApplicationForm();
  }

  FidoAuth.onAuthChange(() => {
    if (currentProject) {
      renderApplicationCTA();
    }
  });
});

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

      await loadProjectDetails(projectId);
      setupApplicationForm();
    } catch (err) {
      showToast(err.message || "Invalid invite code.", "error");
      btn.disabled = false;
      btn.textContent = "Verify Code";
    }
  });
}

async function loadProjectDetails(projectId) {
  try {
    currentProject = await FidoDB.getProjectById(projectId);

    if (!currentProject) {
      document.getElementById("project-content-container").innerHTML = `
        <div class="card text-center" style="padding: 3rem 1rem;">
          <h3>Project Not Found</h3>
          <p class="text-muted" style="margin: 0.5rem 0 1.5rem;">The requested project could not be located or has been archived.</p>
          <a href="find-work.html" class="btn btn-secondary">Back to Find Work</a>
        </div>
      `;
      return;
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
  const ctaContainer = document.getElementById("application-cta-container");
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

  const apps = await FidoDB.getApplications({
    projectId: currentProject.projectId || currentProject.id,
    freelancerId: currentUser.uid
  });

  const hasApplied = apps.length > 0;

  if (hasApplied) {
    const app = apps[0];
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
          Status: <strong>${app.status || "Submitted"}</strong><br/>
          Submitted: ${formatDate(app.createdAt)}
        </div>
        <a href="account.html" class="btn btn-secondary btn-sm btn-block">View in Account</a>
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
        ${isMemberActive ? "✓ Active Member Account" : "Agency managed coordination"}
      </div>
    </div>
  `;
}

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

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting Proposal...";

    try {
      await FidoDB.createApplication({
        projectId: currentProject.projectId || currentProject.id,
        freelancerId: currentUser.uid,
        freelancerName: currentUser.name,
        freelancerEmail: currentUser.email,
        skills: currentUser.skills || [],
        portfolio: portfolio || currentUser.portfolio || "",
        message: message,
        deliveryDays: deliveryDays || "Flexible"
      });

      closeModal("apply-modal");
      showToast("Proposal submitted successfully!", "success");
      await renderApplicationCTA();

    } catch (err) {
      showToast(err.message || "Failed to submit proposal.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Application";
    }
  });
}
