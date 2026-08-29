/**
 * FidoConnect - Homepage Controller
 */

import { FidoAuth } from "./auth.js";
import { FidoDB } from "./db.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Category quick filter clicks: Redirect clients & visitors to post-work, freelancers to find-work
  document.querySelectorAll(".category-card").forEach(card => {
    card.addEventListener("click", async () => {
      const category = card.getAttribute("data-category");
      if (!category) return;

      const user = FidoAuth.getCurrentUser() || (await FidoAuth.waitForAuth());
      const isFreelancer = FidoAuth.isFreelancer(user);
      const target = isFreelancer
        ? `find-work.html?category=${encodeURIComponent(category)}`
        : `post-work.html?category=${encodeURIComponent(category)}`;

      if (!user) {
        if (typeof showToast === "function") {
          showToast("Please log in to post your work request", "info");
        }
        setTimeout(() => {
          window.location.href = `auth.html?redirect=${encodeURIComponent(target)}`;
        }, 300);
      } else {
        window.location.href = target;
      }
    });
  });

  // Load live open project count
  try {
    const publishedProjects = await FidoDB.getProjects({ status: "Published" });
    const countEl = document.getElementById("hero-open-projects-count");
    if (countEl) {
      countEl.textContent = publishedProjects.length;
    }
  } catch (e) {
    console.warn("Could not load project count", e);
  }
});
