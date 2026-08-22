/**
 * FidoConnect - Homepage Controller
 */

import { FidoDB } from "./db.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Category quick filter clicks
  document.querySelectorAll(".category-card").forEach(card => {
    card.addEventListener("click", () => {
      const category = card.getAttribute("data-category");
      if (category) {
        window.location.href = `find-work.html?category=${encodeURIComponent(category)}`;
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
