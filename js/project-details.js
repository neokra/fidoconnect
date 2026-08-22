/**
 * FidoConnect - Project Details & Application Controller
 */

import { FidoAuth } from "./auth.js";
import { FidoDB } from "./db.js";

let currentProject = null;

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get("id");

  if (!projectId) {
    showToast("No project specified.", "error");
    window.location.href = "find-work.html";
    return;
  }

  await loadProjectDetails(projectId);
  setupApplicationForm();

  FidoAuth.onAuthChange(() => {
    if (currentProject) {
      renderApplicationCTA();
    }
  });
});

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
          ${isOwner ? "Our agency team is actively coordinating this project." : "This project is managed directly by FidoConnect agency."}
        </p>
        <a href="account.html" class="btn btn-secondary btn-block">View My Account</a>
      </div>
    `;
    return;
  }

  if (FidoAuth.isAdmin()) {
    ctaContainer.innerHTML = `
      <div class="card" style="background-color:var(--color-accent-soft); border-color:var(--color-accent-border);">
        <h4>Admin Management</h4>
        <p class="text-muted" style="font-size:0.88rem; margin:0.4rem 0 1rem;">Manage proposals, assign freelancers, or modify status.</p>
        <a href="admin.html" class="btn btn-primary btn-block">Open in Admin Dashboard</a>
      </div>
    `;
    return;
  }

  // Freelancer Role
  if (currentUser.membershipStatus !== "active") {
    ctaContainer.innerHTML = `
      <div class="card" style="background-color:#fffbeb; border-color:#fde68a;">
        <h4 style="color:#92400e;">Membership Required</h4>
        <p style="font-size:0.88rem; color:#b45309; margin:0.4rem 0 1rem;">
          Active FidoConnect membership is required to apply for projects.
        </p>
        <a href="account.html#membership" class="btn btn-primary btn-block">View Membership Options</a>
        <div style="font-size:0.75rem; color:#92400e; margin-top:0.6rem;">
          * Membership provides access to project opportunities. Projects are not guaranteed.
        </div>
      </div>
    `;
    return;
  }

  // Check if freelancer already applied
  try {
    const userApps = await FidoDB.getApplications({
      projectId: currentProject.projectId || currentProject.id,
      freelancerId: currentUser.uid
    });

    if (userApps.length > 0) {
      const myApp = userApps[0];
      ctaContainer.innerHTML = `
        <div class="card" style="background-color:var(--bg-subtle);">
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
            <svg width="20" height="20" style="color:var(--color-primary);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <h4 style="margin:0;">Proposal Submitted</h4>
          </div>
          <p class="text-muted" style="font-size:0.88rem; margin:0.4rem 0 0.8rem;">
            Status: ${getStatusBadge(myApp.status)}
          </p>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">
            Our team is reviewing candidate suitability and will update your account.
          </p>
          <a href="account.html" class="btn btn-secondary btn-block">View in My Applications</a>
        </div>
      `;
      return;
    }
  } catch (err) {
    console.error("Error checking existing application:", err);
  }

  // Eligible to apply
  ctaContainer.innerHTML = `
    <div class="card" style="background-color:var(--bg-surface); border: 2px solid var(--color-primary);">
      <h4>Apply for This Project</h4>
      <p class="text-muted" style="font-size:0.88rem; margin:0.4rem 0 1.25rem;">
        Submit your proposal, delivery timeframe, and relevant experience to the FidoConnect agency team.
      </p>
      <button class="btn btn-primary btn-block btn-lg" onclick="openModal('apply-modal')">
        Submit Proposal
      </button>
      <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.75rem; text-align:center;">
        FidoConnect manages all client communication and payment milestones.
      </div>
    </div>
  `;
}

function setupApplicationForm() {
  const form = document.getElementById("apply-project-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentUser = FidoAuth.getCurrentUser();

    if (!currentUser) {
      showToast("Please log in to apply.", "error");
      return;
    }

    const message = document.getElementById("app-message").value.trim();
    const deliveryDays = document.getElementById("app-delivery").value.trim();
    const portfolio = document.getElementById("app-portfolio").value.trim();
    const submitBtn = document.getElementById("app-submit-btn");

    if (!message) {
      showToast("Please describe your suitability for this project.", "error");
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
      submitBtn.textContent = "Submit Proposal";
    }
  });
}
