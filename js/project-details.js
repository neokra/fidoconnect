/**
 * FidoConnect - Project Details & Application Controller
 */

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
});

async function loadProjectDetails(projectId) {
  try {
    currentProject = await window.FidoDB.getProjectById(projectId);

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

    // Populate data
    document.getElementById("proj-id").textContent = currentProject.projectId || currentProject.id;
    document.getElementById("proj-title").textContent = currentProject.title;
    document.getElementById("proj-category").textContent = currentProject.category;
    document.getElementById("proj-status-badge").innerHTML = getStatusBadge(currentProject.status);
    document.getElementById("proj-description").textContent = currentProject.description;
    document.getElementById("proj-requirements").textContent = currentProject.requirements || "Standard professional quality delivery.";
    document.getElementById("proj-budget").textContent = currentProject.budget;
    document.getElementById("proj-deadline").textContent = formatDate(currentProject.deadline);
    document.getElementById("proj-posted").textContent = formatDate(currentProject.createdAt);

    // Skills
    const skillsContainer = document.getElementById("proj-skills");
    if (skillsContainer) {
      const skills = currentProject.requiredSkills || [currentProject.category];
      skillsContainer.innerHTML = skills.map(s => `<span class="badge badge-inactive">${s}</span>`).join(" ");
    }

    // Role-dependent Action CTA
    renderApplicationCTA();

  } catch (err) {
    console.error("Error loading project:", err);
    showToast("Error loading project details.", "error");
  }
}

async function renderApplicationCTA() {
  const ctaContainer = document.getElementById("project-action-cta");
  if (!ctaContainer) return;

  const currentUser = window.FidoAuth.getCurrentUser();

  if (!currentUser) {
    ctaContainer.innerHTML = `
      <div class="card" style="background-color:var(--bg-subtle);">
        <h4>Want to work on this project?</h4>
        <p class="text-muted" style="font-size:0.9rem; margin:0.4rem 0 1rem;">Join FidoConnect or log in to submit your proposal.</p>
        <a href="auth.html?redirect=${encodeURIComponent(window.location.href)}" class="btn btn-primary btn-block">Log in to Apply</a>
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

  if (currentUser.role === "admin") {
    ctaContainer.innerHTML = `
      <div class="card" style="background-color:var(--color-accent-soft); border-color:var(--color-accent-border);">
        <h4>Admin Management</h4>
        <p class="text-muted" style="font-size:0.88rem; margin:0.4rem 0 1rem;">Manage proposals, assign freelancers, or modify status.</p>
        <a href="admin.html?project=${currentProject.projectId}" class="btn btn-primary btn-block">Open in Admin Dashboard</a>
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
  const existingApps = await window.FidoDB.getApplications({
    projectId: currentProject.projectId || currentProject.id,
    freelancerId: currentUser.uid
  });

  if (existingApps.length > 0) {
    const myApp = existingApps[0];
    ctaContainer.innerHTML = `
      <div class="card" style="background-color:#ecfdf5; border-color:#a7f3d0;">
        <div style="display:flex; align-items:center; gap:0.5rem; color:#065f46; margin-bottom:0.5rem;">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          <h4 style="color:#065f46; margin:0;">Application Submitted</h4>
        </div>
        <p style="font-size:0.88rem; color:#047857; margin-bottom:0.75rem;">
          Our agency team has received your proposal and is reviewing your profile.
        </p>
        <div style="font-size:0.8rem; color:#065f46;">
          Status: <strong>${myApp.status}</strong> (${formatDate(myApp.createdAt)})
        </div>
      </div>
    `;
    return;
  }

  // Eligible to apply
  ctaContainer.innerHTML = `
    <div class="card">
      <h4>Ready to work on this?</h4>
      <p class="text-muted" style="font-size:0.88rem; margin:0.4rem 0 1.25rem;">
        Submit a concise proposal to the FidoConnect team for review.
      </p>
      <button id="open-apply-modal-btn" class="btn btn-primary btn-block">Apply for Project</button>
    </div>
  `;

  document.getElementById("open-apply-modal-btn").addEventListener("click", () => {
    openModal("apply-modal");
  });
}

function setupApplicationForm() {
  const form = document.getElementById("application-form");
  if (!form) return;

  // Auto-fill user's portfolio if on profile
  const currentUser = window.FidoAuth.getCurrentUser();
  if (currentUser && currentUser.portfolio) {
    const portInput = document.getElementById("appPortfolio");
    if (portInput && !portInput.value) portInput.value = currentUser.portfolio;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById("submit-app-btn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting Proposal...";

    try {
      const message = document.getElementById("appMessage").value.trim();
      const portfolio = document.getElementById("appPortfolio").value.trim();
      const deliveryDays = document.getElementById("appDeliveryTime").value.trim();

      if (!message) {
        throw new Error("Please write a short proposal or message explaining your suitability.");
      }

      await window.FidoDB.createApplication({
        projectId: currentProject.projectId || currentProject.id,
        freelancerId: currentUser.uid,
        freelancerName: currentUser.name,
        freelancerEmail: currentUser.email,
        skills: currentUser.skills || [currentProject.category],
        portfolio: portfolio || currentUser.portfolio || "",
        message: message,
        deliveryDays: deliveryDays || "Flexible"
      });

      closeModal("apply-modal");
      showToast("Application submitted to FidoConnect team for review!", "success");
      await renderApplicationCTA();

    } catch (err) {
      showToast(err.message || "Failed to submit application.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Application";
    }
  });
}
