/**
 * FidoConnect - Homepage Controller
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Category quick filter clicks
  document.querySelectorAll(".category-card").forEach(card => {
    card.addEventListener("click", (e) => {
      const category = card.getAttribute("data-category");
      if (category) {
        window.location.href = `find-work.html?category=${encodeURIComponent(category)}`;
      }
    });
  });

  // Load live open project counts
  try {
    const publishedProjects = await window.FidoDB.getProjects({ status: "Published" });
    const countEl = document.getElementById("hero-open-projects-count");
    if (countEl) {
      countEl.textContent = publishedProjects.length;
    }
  } catch (e) {
    console.warn("Could not load project count", e);
  }
});
