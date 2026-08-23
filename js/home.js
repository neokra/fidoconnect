/**
 * FidoConnect - Homepage Controller
 */

import { FidoAuth } from "./auth.js";
import { FidoDB } from "./db.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Category quick filter clicks
  document.querySelectorAll(".category-card").forEach(card => {
    card.addEventListener("click", async () => {
      const category = card.getAttribute("data-category");
      if (!category) return;

      const target = `find-work.html?category=${encodeURIComponent(category)}`;
      const user = await FidoAuth.waitForAuth();

      if (!user) {
        if (typeof showToast === "function") {
          showToast("Please log in first", "info");
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
