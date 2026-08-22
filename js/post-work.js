/**
 * FidoConnect - Post a Work Form Controller
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("post-work-form");
  const formContainer = document.getElementById("post-work-form-container");
  const confirmationContainer = document.getElementById("submission-confirmation");

  // Pre-fill fields if user is already logged in as a client
  const currentUser = window.FidoAuth.getCurrentUser();
  if (currentUser) {
    if (currentUser.name) document.getElementById("clientName").value = currentUser.name;
    if (currentUser.email) document.getElementById("clientEmail").value = currentUser.email;
    if (currentUser.phone) document.getElementById("clientPhone").value = currentUser.phone;
    if (currentUser.businessName) document.getElementById("clientBusiness").value = currentUser.businessName;
  }

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

        const projectPayload = {
          title,
          category,
          description,
          budget: budget || "Flexible",
          deadline: deadline || "Flexible",
          requirements: requirements || "",
          clientId: currentUser ? currentUser.uid : `guest_${Date.now()}`,
          clientName,
          clientBusiness: clientBusiness || clientName,
          clientEmail,
          clientPhone,
          requiredSkills: [category]
        };

        const createdProject = await window.FidoDB.createProject(projectPayload);

        // Display Confirmation View
        formContainer.style.display = "none";
        confirmationContainer.style.display = "block";

        document.getElementById("conf-project-id").textContent = createdProject.projectId;
        document.getElementById("conf-project-title").textContent = createdProject.title;
        document.getElementById("conf-project-category").textContent = createdProject.category;
        document.getElementById("conf-project-budget").textContent = createdProject.budget;

        showToast("Project request submitted successfully!", "success");

        // Scroll to top of confirmation
        window.scrollTo({ top: 0, behavior: "smooth" });

      } catch (err) {
        showToast(err.message || "Failed to submit project. Please try again.", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Work";
      }
    });
  }
});
