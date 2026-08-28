/**
 * FidoConnect - UI Components & Notification Helper
 */

// Toast Notifications
function showToast(message, type = "info", duration = 3500) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let iconSvg = "";
  if (type === "success") {
    iconSvg = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
  } else if (type === "error") {
    iconSvg = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
  } else {
    iconSvg = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  }

  toast.innerHTML = `${iconSvg}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// Modal Management
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

// Formatters
function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch (e) {
    return dateStr;
  }
}

function getStatusBadge(status) {
  const s = (status || "").toLowerCase();
  let className = "badge-inactive";
  
  if (s === "submitted") className = "badge-submitted";
  else if (s === "under review" || s === "reviewed") className = "badge-review";
  else if (s === "approved") className = "badge-approved";
  else if (s === "published" || s === "applications open") className = "badge-published";
  else if (s === "in progress" || s === "freelancer selected") className = "badge-progress";
  else if (s === "completed") className = "badge-completed";
  else if (s === "cancelled" || s === "rejected") className = "badge-cancelled";
  else if (s === "active") className = "badge-active";
  else if (s === "expired") className = "badge-expired";

  return `<span class="badge ${className}">${status || "Draft"}</span>`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Active Nav Link Highlighter
function highlightActiveNav() {
  const currentPath = window.location.pathname.split("/").pop() || "index.html";
  
  // Desktop links
  document.querySelectorAll(".desktop-nav .nav-link").forEach(link => {
    const href = link.getAttribute("href");
    if (href === currentPath || (currentPath === "" && href === "index.html")) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  // Mobile bottom nav links
  document.querySelectorAll(".mobile-bottom-nav .mobile-nav-item").forEach(link => {
    const href = link.getAttribute("href");
    if (href === currentPath || (currentPath === "" && href === "index.html")) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

// Global Page Preloader Management (1-2s screen loader)
function initPagePreloader() {
  let preloader = document.getElementById("page-preloader");
  if (!preloader) {
    preloader = document.createElement("div");
    preloader.id = "page-preloader";
    preloader.innerHTML = '<div class="preloader-spinner"></div>';
    document.body.prepend(preloader);
  }

  // Remove loader after ~1.2 seconds
  setTimeout(() => {
    preloader.classList.add("fade-out");
    setTimeout(() => {
      if (preloader && preloader.parentNode) {
        preloader.remove();
      }
    }, 400);
  }, 1200);
}

// Document Ready Initialization
document.addEventListener("DOMContentLoaded", () => {
  initPagePreloader();
  highlightActiveNav();
  // Close modals when clicking backdrop
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("active");
        document.body.style.overflow = "";
      }
    });
  });
});
