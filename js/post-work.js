/**
 * FidoConnect - Post a Work Form Controller
 */

import { FidoAuth } from "./auth.js";
import { FidoDB } from "./db.js";

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("post-work-form");
  const formContainer = document.getElementById("post-work-form-container");
  const confirmationContainer = document.getElementById("submission-confirmation");

  // Pre-fill fields if user is already logged in
  const fillUser = (user) => {
    if (user) {
      if (user.name && !document.getElementById("clientName").value) {
        document.getElementById("clientName").value = user.name;
      }
      if (user.email && !document.getElementById("clientEmail").value) {
        document.getElementById("clientEmail").value = user.email;
      }
      if (user.phone && !document.getElementById("clientPhone").value) {
        document.getElementById("clientPhone").value = user.phone;
      }
      if (user.businessName && !document.getElementById("clientBusiness").value) {
        document.getElementById("clientBusiness").value = user.businessName;
      }
    }
  };

  fillUser(FidoAuth.getCurrentUser());
  FidoAuth.onAuthChange(fillUser);

  // Pre-select category if passed via URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const paramCategory = urlParams.get("category");
  if (paramCategory) {
    const categorySelect = document.getElementById("projectCategory");
    if (categorySelect) {
      for (let option of categorySelect.options) {
        if (option.value.toLowerCase() === paramCategory.toLowerCase()) {
          option.selected = true;
          break;
        }
      }
    }
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById("submit-work-btn");
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting...";

      try {
        const clientName = document.getElementById("clientName").value.trim();
        const clientBusiness = document.getElementById("clientBusiness").value.trim();
        const clientEmail = document.getElementById("clientEmail").value.trim();
        const clientPhone = document.getElementById("clientPhone").value.trim();
        const title = document.getElementById("projectTitle").value.trim();
        const category = document.getElementById("projectCategory").value;
        const description = document.getElementById("projectDescription").value.trim();
        const budget = document.getElementById("projectBudget").value.trim();
        const deadline = document.getElementById("projectDeadline").value;
        const requirements = document.getElementById("projectRequirements").value.trim();

        if (!clientName || !clientEmail || !clientPhone || !title || !description) {
          throw new Error("Please fill in all required fields marked with an asterisk (*).");
        }

        const currentUser = FidoAuth.getCurrentUser();

        const projectPayload = {
          title,
          category,
          description,
          budget: budget || "Flexible",
          deadline: deadline || "Flexible",
          requirements: requirements || "",
          clientId: currentUser ? currentUser.uid : "unregistered_client",
          clientName,
          clientBusiness: clientBusiness || clientName,
          clientEmail,
          clientPhone,
          requiredSkills: [category]
        };

        const createdProject = await FidoDB.createProject(projectPayload);

        // Display Confirmation View
        formContainer.style.display = "none";
        confirmationContainer.style.display = "block";

        document.getElementById("conf-project-id").textContent = createdProject.projectId;
        document.getElementById("conf-project-title").textContent = createdProject.title;
        document.getElementById("conf-project-category").textContent = createdProject.category;
        document.getElementById("conf-project-budget").textContent = createdProject.budget;

        showToast("Project request submitted successfully!", "success");
        window.scrollTo({ top: 0, behavior: "smooth" });

      } catch (err) {
        showToast(err.message || "Failed to submit project. Please try again.", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Work";
      }
    });
  }
});
