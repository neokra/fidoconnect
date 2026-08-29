/**
 * FidoConnect - Guided Website Planner & Post a Work Controller
 */

import { FidoAuth } from "./auth.js";
import { FidoDB } from "./db.js";

document.addEventListener("DOMContentLoaded", async () => {
  const isAuth = await FidoAuth.requireAuth();
  if (!isAuth) return;

  const categorySelect = document.getElementById("projectCategory");
  const categoryHint = document.getElementById("category-hint-text");
  const websiteBuilder = document.getElementById("website-guided-builder");
  const standardForm = document.getElementById("post-work-form");
  const formContainer = document.getElementById("post-work-form-container");
  const confirmationContainer = document.getElementById("submission-confirmation");

  // State for Guided Website Builder
  const guidedState = {
    customPages: [],
    primaryColor: "#2563eb",
    primaryColorName: "Royal Blue"
  };

  // ---------------------------------------------------------------------------
  // 1. Pre-fill Logged-in User Information
  // ---------------------------------------------------------------------------
  const fillUser = (user) => {
    if (!user) return;
    const name = user.name || "";
    const email = user.email || "";
    const phone = user.phone || "";
    const business = user.businessName || "";

    // Standard Form Inputs
    const cName = document.getElementById("clientName");
    const cEmail = document.getElementById("clientEmail");
    const cPhone = document.getElementById("clientPhone");
    const cBus = document.getElementById("clientBusiness");
    if (cName && !cName.value) cName.value = name;
    if (cEmail && !cEmail.value) cEmail.value = email;
    if (cPhone && !cPhone.value) cPhone.value = phone;
    if (cBus && !cBus.value) cBus.value = business;

    // Guided Form Inputs
    const wName = document.getElementById("web-client-name");
    const wEmail = document.getElementById("web-email");
    const wPhone = document.getElementById("web-phone");
    const wWhatsapp = document.getElementById("web-whatsapp");
    const wBus = document.getElementById("web-business-name");
    if (wName && !wName.value) wName.value = name;
    if (wEmail && !wEmail.value) wEmail.value = email;
    if (wPhone && !wPhone.value) wPhone.value = phone;
    if (wWhatsapp && !wWhatsapp.value) wWhatsapp.value = phone;
    if (wBus && !wBus.value) wBus.value = business;
  };

  fillUser(FidoAuth.getCurrentUser());
  FidoAuth.onAuthChange(fillUser);

  // ---------------------------------------------------------------------------
  // 2. Category Switcher (Website Development vs Non-Website Categories)
  // ---------------------------------------------------------------------------
  function syncCategoryUI() {
    const selectedCategory = categorySelect ? categorySelect.value : "Website";
    const isWebsite = selectedCategory.toLowerCase() === "website";

    if (isWebsite) {
      if (websiteBuilder) websiteBuilder.style.display = "block";
      if (standardForm) standardForm.style.display = "none";
      if (categoryHint) {
        categoryHint.textContent = "✨ Guided Website Planner activated — plan your website visually in minutes. No technical knowledge required!";
        categoryHint.style.color = "var(--color-accent)";
      }
    } else {
      if (websiteBuilder) websiteBuilder.style.display = "none";
      if (standardForm) standardForm.style.display = "block";
      if (categoryHint) {
        categoryHint.textContent = `Standard project request form for ${categorySelect.options[categorySelect.selectedIndex]?.text || selectedCategory}.`;
        categoryHint.style.color = "var(--text-muted)";
      }
    }
  }

  // Pre-select category if passed via URL
  const urlParams = new URLSearchParams(window.location.search);
  const paramCategory = urlParams.get("category");
  if (paramCategory && categorySelect) {
    for (let opt of categorySelect.options) {
      if (opt.value.toLowerCase() === paramCategory.toLowerCase() || opt.value.toLowerCase().includes(paramCategory.toLowerCase())) {
        opt.selected = true;
        break;
      }
    }
  }

  if (categorySelect) {
    categorySelect.addEventListener("change", syncCategoryUI);
    syncCategoryUI();
  }

  // ---------------------------------------------------------------------------
  // 3. Multi-Select Handlers: Cards, Chips, Color Swatches
  // ---------------------------------------------------------------------------
  function setupSelectionToggles() {
    // 3a. Choice Cards (Website Types, Design Styles)
    document.querySelectorAll(".choice-card").forEach(card => {
      card.addEventListener("click", () => {
        card.classList.toggle("selected");
        evaluateConditionalSections();
      });
    });

    // 3b. Choice Chips (Pages, Actions, Feelings, Sections, Features, Assets)
    document.querySelectorAll(".choice-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const isSelected = chip.classList.toggle("selected");
        const statusEl = chip.querySelector(".choice-chip-status");
        if (statusEl) {
          statusEl.textContent = isSelected ? "✓" : "+";
        }
        evaluateConditionalSections();
      });
    });

    // 3c. Color Swatches
    document.querySelectorAll(".color-swatch-card").forEach(swatch => {
      swatch.addEventListener("click", () => {
        document.querySelectorAll(".color-swatch-card").forEach(s => s.classList.remove("selected"));
        swatch.classList.add("selected");
        const colorName = swatch.getAttribute("data-color");
        const hex = swatch.getAttribute("data-hex");
        guidedState.primaryColor = hex || "#2563eb";
        guidedState.primaryColorName = colorName || "Custom";

        const colorPicker = document.getElementById("web-color-picker");
        const customColorInput = document.getElementById("web-custom-color");
        if (colorPicker && hex) colorPicker.value = hex;
        if (customColorInput && hex) customColorInput.value = hex;
      });
    });

    // Color picker input
    const colorPicker = document.getElementById("web-color-picker");
    const customColorInput = document.getElementById("web-custom-color");
    if (colorPicker) {
      colorPicker.addEventListener("input", (e) => {
        guidedState.primaryColor = e.target.value;
        guidedState.primaryColorName = "Custom Color";
        if (customColorInput) customColorInput.value = e.target.value;
        document.querySelectorAll(".color-swatch-card").forEach(s => s.classList.remove("selected"));
      });
    }
    if (customColorInput) {
      customColorInput.addEventListener("input", (e) => {
        const val = e.target.value.trim();
        if (val.startsWith("#") && (val.length === 4 || val.length === 7)) {
          guidedState.primaryColor = val;
          guidedState.primaryColorName = "Custom Color";
          if (colorPicker) colorPicker.value = val;
        }
      });
    }
  }

  setupSelectionToggles();

  // ---------------------------------------------------------------------------
  // 4. Conditional Sections: E-Commerce & Booking Questions
  // ---------------------------------------------------------------------------
  function evaluateConditionalSections() {
    // Check if E-Commerce is selected in types, pages, or actions
    const selectedTypes = getSelectedValues("#website-types-grid .choice-card");
    const selectedPages = getSelectedValues("#common-pages-chips .choice-chip, #advanced-pages-chips .choice-chip");
    const selectedActions = getSelectedValues("#actions-products-chips .choice-chip");

    const hasEcommerce = selectedTypes.some(t => t.toLowerCase().includes("e-commerce") || t.toLowerCase().includes("store")) ||
      selectedPages.some(p => p.toLowerCase().includes("cart") || p.toLowerCase().includes("checkout") || p.toLowerCase().includes("product")) ||
      selectedActions.some(a => a.toLowerCase().includes("cart") || a.toLowerCase().includes("checkout") || a.toLowerCase().includes("payment"));

    const ecomBox = document.getElementById("conditional-ecommerce-box");
    if (ecomBox) {
      ecomBox.style.display = hasEcommerce ? "block" : "none";
    }

    // Check if Booking is selected in types, pages, or actions
    const hasBooking = selectedTypes.some(t => t.toLowerCase().includes("booking") || t.toLowerCase().includes("appointment") || t.toLowerCase().includes("salon") || t.toLowerCase().includes("clinic") || t.toLowerCase().includes("hotel")) ||
      selectedPages.some(p => p.toLowerCase().includes("booking") || p.toLowerCase().includes("appointment")) ||
      getSelectedValues("#actions-booking-chips .choice-chip").length > 0;

    const bookingBox = document.getElementById("conditional-booking-box");
    if (bookingBox) {
      bookingBox.style.display = hasBooking ? "block" : "none";
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Custom Pages Multi-Item Adder
  // ---------------------------------------------------------------------------
  const addCustomPageBtn = document.getElementById("btn-add-custom-page");
  const customPageNameInput = document.getElementById("custom-page-name-input");
  const customPageDescInput = document.getElementById("custom-page-desc-input");
  const customPagesListContainer = document.getElementById("custom-pages-list-container");

  function renderCustomPages() {
    if (!customPagesListContainer) return;
    if (guidedState.customPages.length === 0) {
      customPagesListContainer.innerHTML = "";
      return;
    }

    customPagesListContainer.innerHTML = guidedState.customPages.map((page, index) => `
      <div class="custom-page-item">
        <div class="custom-page-item-info">
          <div class="custom-page-item-name">📄 ${escapeHtml(page.name)}</div>
          ${page.description ? `<div class="custom-page-item-desc">${escapeHtml(page.description)}</div>` : ''}
        </div>
        <button type="button" class="btn btn-secondary btn-sm" style="color:#ef4444; border-color:#fca5a5; padding:3px 8px;" data-index="${index}" title="Remove page">
          &times;
        </button>
      </div>
    `).join("");

    customPagesListContainer.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-index"), 10);
        guidedState.customPages.splice(idx, 1);
        renderCustomPages();
      });
    });
  }

  if (addCustomPageBtn) {
    addCustomPageBtn.addEventListener("click", () => {
      const name = customPageNameInput ? customPageNameInput.value.trim() : "";
      const desc = customPageDescInput ? customPageDescInput.value.trim() : "";

      if (!name) {
        if (typeof showToast === "function") showToast("Please enter a page name.", "info");
        if (customPageNameInput) customPageNameInput.focus();
        return;
      }

      guidedState.customPages.push({ name, description: desc });
      if (customPageNameInput) customPageNameInput.value = "";
      if (customPageDescInput) customPageDescInput.value = "";
      renderCustomPages();
      if (typeof showToast === "function") showToast(`Added page "${name}"`, "success");
    });
  }

  // ---------------------------------------------------------------------------
  // 6. Smart Business Presets Engine
  // ---------------------------------------------------------------------------
  const PRESET_CONFIGS = {
    salon: {
      types: ["Salon / Beauty Website", "Booking / Appointment Website", "Service Website"],
      pages: ["Home", "About Us", "Services", "Pricing", "Gallery", "Testimonials / Reviews", "Contact", "Booking", "Offers / Promotions"],
      actions: ["WhatsApp the business", "Call the business", "Book an appointment", "View services", "View pricing", "View opening hours", "View customer reviews", "View location & directions"],
      styles: ["Luxury", "Elegant", "Modern"],
      color: "Pink",
      colorHex: "#db2777",
      feelings: ["Luxury & Exclusive", "Friendly", "Trustworthy"],
      sections: ["Hero Banner with Call-to-Action", "Services Overview", "Photo Gallery", "Customer Testimonials & Reviews", "Special Offers & Discounts", "Floating WhatsApp Chat Button", "Location & Interactive Map", "Opening Hours", "Contact Form"],
      features: ["WhatsApp Integration", "Google Maps Location", "Google Reviews Embed", "Instagram Integration", "Appointment / Booking System"],
      bookingFeatures: ["Service Selection", "Date & Time Selection", "Staff / Stylist Selection", "WhatsApp Booking Confirmation"]
    },
    restaurant: {
      types: ["Restaurant / Food Website", "Business Website"],
      pages: ["Home", "About Us", "Menu", "Gallery", "Offers / Promotions", "Testimonials / Reviews", "Contact", "Locations"],
      actions: ["Call the business", "WhatsApp the business", "View pricing", "View location & directions", "View opening hours", "View customer reviews", "Download files / Brochure"],
      styles: ["Warm & Friendly", "Modern", "Bold"],
      color: "Orange",
      colorHex: "#ea580c",
      feelings: ["Friendly", "Trustworthy", "Youthful & Vibrant"],
      sections: ["Hero Banner with Call-to-Action", "Business Introduction", "Photo Gallery", "Customer Testimonials & Reviews", "Special Offers & Discounts", "Floating WhatsApp Chat Button", "Location & Interactive Map", "Opening Hours", "Contact Form"],
      features: ["WhatsApp Integration", "Google Maps Location", "Google Reviews Embed", "Instagram Integration", "Downloadable PDF / Menu"]
    },
    photographer: {
      types: ["Photography Website", "Portfolio Website", "Service Website"],
      pages: ["Home", "About Us", "Portfolio", "Gallery", "Services", "Pricing", "Testimonials / Reviews", "Contact", "Booking"],
      actions: ["WhatsApp the business", "View services", "View pricing", "Request a quote", "Book an appointment", "View social media"],
      styles: ["Creative", "Minimal", "Dark Mode"],
      color: "Black",
      colorHex: "#0f172a",
      feelings: ["Artistic", "Premium", "Professional"],
      sections: ["Hero Banner with Call-to-Action", "Portfolio Showcase", "Photo Gallery", "Services Overview", "Customer Testimonials & Reviews", "Floating WhatsApp Chat Button", "Contact Form", "Instagram Live Feed"],
      features: ["WhatsApp Integration", "Instagram Integration", "Video Gallery / YouTube Embed", "Google Reviews Embed", "Appointment / Booking System"]
    },
    retail: {
      types: ["E-commerce / Online Store", "Business Website"],
      pages: ["Home", "About Us", "Products", "Product Categories", "Shopping Cart", "Checkout", "Offers / Promotions", "Testimonials / Reviews", "Contact", "FAQ", "Privacy Policy", "Terms & Conditions"],
      actions: ["Browse products", "Search & filter products", "Add to cart", "Checkout & Online payment", "Order confirmation & tracking", "WhatsApp the business"],
      styles: ["Modern", "Colorful", "Bold"],
      color: "Blue",
      colorHex: "#2563eb",
      feelings: ["Trustworthy", "Simple & Fast", "Youthful & Vibrant"],
      sections: ["Hero Banner with Call-to-Action", "Featured Products", "Special Offers & Discounts", "Customer Testimonials & Reviews", "Floating WhatsApp Chat Button", "FAQ Accordion", "Contact Form"],
      features: ["WhatsApp Integration", "Product Management & Catalog", "Payment Gateway (UPI/Cards)", "Coupon & Discount Codes", "Basic SEO & Google Indexing", "Customer Accounts & Login"]
    },
    clinic: {
      types: ["Clinic / Healthcare Website", "Booking / Appointment Website", "Business Website"],
      pages: ["Home", "About Us", "Services", "Team", "Booking", "Testimonials / Reviews", "Contact", "Locations", "FAQ"],
      actions: ["Call the business", "WhatsApp the business", "Book an appointment", "View services", "View team & staff", "View location & directions", "View opening hours"],
      styles: ["Professional", "Trustworthy", "Minimal"],
      color: "Teal",
      colorHex: "#0d9488",
      feelings: ["Trustworthy", "Professional", "Friendly"],
      sections: ["Hero Banner with Call-to-Action", "Business Introduction", "Services Overview", "Customer Testimonials & Reviews", "Floating WhatsApp Chat Button", "Location & Interactive Map", "Opening Hours", "Contact Form", "Frequently Asked Questions (FAQ)"],
      features: ["WhatsApp Integration", "Google Maps Location", "Google Reviews Embed", "Appointment / Booking System", "Basic SEO & Google Indexing"]
    },
    tuition: {
      types: ["Educational / Coaching Website", "Business Website"],
      pages: ["Home", "About Us", "Services", "Pricing", "Testimonials / Reviews", "FAQ", "Contact", "Locations"],
      actions: ["WhatsApp the business", "Call the business", "Send an enquiry", "Request a callback", "View services", "View pricing", "Download files / Brochure"],
      styles: ["Professional", "Modern", "Warm & Friendly"],
      color: "Blue",
      colorHex: "#2563eb",
      feelings: ["Trustworthy", "Professional", "Friendly"],
      sections: ["Hero Banner with Call-to-Action", "Business Introduction", "Services Overview", "Customer Testimonials & Reviews", "Frequently Asked Questions (FAQ)", "Floating WhatsApp Chat Button", "Contact Form", "Location & Interactive Map"],
      features: ["WhatsApp Integration", "Google Maps Location", "Contact Form with Email Alerts", "Downloadable PDF / Menu", "Basic SEO & Google Indexing"]
    },
    realestate: {
      types: ["Real Estate Website", "Business Website"],
      pages: ["Home", "About Us", "Services", "Gallery", "Portfolio", "Testimonials / Reviews", "Contact", "Locations"],
      actions: ["Call the business", "WhatsApp the business", "Request a callback", "View services", "View location & directions", "Download files / Brochure"],
      styles: ["Luxury", "Professional", "Modern"],
      color: "Gold",
      colorHex: "#d97706",
      feelings: ["Trustworthy", "Luxury & Exclusive", "Professional"],
      sections: ["Hero Banner with Call-to-Action", "Portfolio Showcase", "Photo Gallery", "Services Overview", "Customer Testimonials & Reviews", "Floating WhatsApp Chat Button", "Location & Interactive Map", "Contact Form"],
      features: ["WhatsApp Integration", "Google Maps Location", "Video Gallery / YouTube Embed", "Contact Form with Email Alerts", "Basic SEO & Google Indexing"]
    },
    gym: {
      types: ["Business Website", "Service Website", "Booking / Appointment Website"],
      pages: ["Home", "About Us", "Services", "Pricing", "Gallery", "Team", "Offers / Promotions", "Testimonials / Reviews", "Contact"],
      actions: ["WhatsApp the business", "Call the business", "View services", "View pricing", "Book an appointment", "View opening hours"],
      styles: ["Bold", "Modern", "Dark Mode"],
      color: "Red",
      colorHex: "#dc2626",
      feelings: ["Youthful & Vibrant", "Bold", "Professional"],
      sections: ["Hero Banner with Call-to-Action", "Services Overview", "Pricing Packages", "Special Offers & Discounts", "Photo Gallery", "Customer Testimonials & Reviews", "Floating WhatsApp Chat Button", "Location & Interactive Map", "Opening Hours"],
      features: ["WhatsApp Integration", "Google Maps Location", "Instagram Integration", "Appointment / Booking System"]
    },
    agency: {
      types: ["Agency / Corporate Website", "Portfolio Website"],
      pages: ["Home", "About Us", "Services", "Portfolio", "Pricing", "Team", "Testimonials / Reviews", "FAQ", "Contact", "Privacy Policy"],
      actions: ["Request a quote", "Send an enquiry", "Contact form", "Email the business", "View services", "View customer reviews"],
      styles: ["Modern", "Professional", "Minimal"],
      color: "Blue",
      colorHex: "#2563eb",
      feelings: ["Professional", "Trustworthy", "Premium"],
      sections: ["Hero Banner with Call-to-Action", "Business Introduction", "Services Overview", "Portfolio Showcase", "Customer Testimonials & Reviews", "Frequently Asked Questions (FAQ)", "Contact Form", "Floating WhatsApp Chat Button"],
      features: ["WhatsApp Integration", "Contact Form with Email Alerts", "Google Reviews Embed", "Basic SEO & Google Indexing", "Analytics"]
    },
    services: {
      types: ["Service Website", "Business Website"],
      pages: ["Home", "About Us", "Services", "Pricing", "Gallery", "Testimonials / Reviews", "Contact", "Locations", "FAQ"],
      actions: ["Call the business", "WhatsApp the business", "Request a quote", "View services", "View pricing", "View customer reviews", "View location & directions"],
      styles: ["Trustworthy", "Modern", "Warm & Friendly"],
      color: "Green",
      colorHex: "#059669",
      feelings: ["Trustworthy", "Friendly", "Professional"],
      sections: ["Hero Banner with Call-to-Action", "Services Overview", "Pricing Packages", "Photo Gallery", "Customer Testimonials & Reviews", "Location & Interactive Map", "Opening Hours", "Floating WhatsApp Chat Button", "Contact Form"],
      features: ["WhatsApp Integration", "Google Maps Location", "Google Reviews Embed", "Contact Form with Email Alerts", "Basic SEO & Google Indexing"]
    },
    custom: {
      types: ["Business Website"],
      pages: ["Home", "About Us", "Services", "Contact"],
      actions: ["WhatsApp the business", "Call the business", "Send an enquiry", "View services"],
      styles: ["Modern", "Professional"],
      color: "Blue",
      colorHex: "#2563eb",
      feelings: ["Trustworthy", "Professional"],
      sections: ["Hero Banner with Call-to-Action", "Business Introduction", "Services Overview", "Contact Form", "Floating WhatsApp Chat Button"],
      features: ["WhatsApp Integration", "Google Maps Location", "Contact Form with Email Alerts", "Basic SEO & Google Indexing"]
    }
  };

  function applyPreset(presetKey) {
    const config = PRESET_CONFIGS[presetKey];
    if (!config) return;

    // Highlight active preset button
    document.querySelectorAll(".smart-preset-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-preset") === presetKey);
    });

    // Helper: Select matching elements
    const setSelection = (selector, values, isCard = false) => {
      document.querySelectorAll(selector).forEach(el => {
        const val = el.getAttribute("data-val");
        const match = values.includes(val);
        el.classList.toggle("selected", match);
        if (!isCard) {
          const status = el.querySelector(".choice-chip-status");
          if (status) status.textContent = match ? "✓" : "+";
        }
      });
    };

    setSelection("#website-types-grid .choice-card", config.types, true);
    setSelection("#common-pages-chips .choice-chip, #advanced-pages-chips .choice-chip", config.pages);
    setSelection("#actions-comm-chips .choice-chip, #actions-services-chips .choice-chip, #actions-booking-chips .choice-chip, #actions-products-chips .choice-chip, #actions-info-chips .choice-chip", config.actions);
    setSelection("#design-styles-grid .choice-card", config.styles, true);
    setSelection("#website-feelings-chips .choice-chip", config.feelings);
    setSelection("#homepage-sections-chips .choice-chip", config.sections);
    setSelection("#features-chips .choice-chip", config.features);

    // Color Swatch
    document.querySelectorAll(".color-swatch-card").forEach(s => {
      const match = s.getAttribute("data-color") === config.color;
      s.classList.toggle("selected", match);
    });
    guidedState.primaryColor = config.colorHex || "#2563eb";
    guidedState.primaryColorName = config.color;
    const colorPicker = document.getElementById("web-color-picker");
    const customColorInput = document.getElementById("web-custom-color");
    if (colorPicker) colorPicker.value = config.colorHex;
    if (customColorInput) customColorInput.value = config.colorHex;

    evaluateConditionalSections();
    if (typeof showToast === "function") {
      showToast(`Applied ${presetKey.toUpperCase()} recommendations! Feel free to customize any option.`, "info");
    }
  }

  document.querySelectorAll(".smart-preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const preset = btn.getAttribute("data-preset");
      applyPreset(preset);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Helper: Gather Selected Values
  // ---------------------------------------------------------------------------
  function getSelectedValues(selector) {
    const selected = [];
    document.querySelectorAll(selector).forEach(el => {
      if (el.classList.contains("selected")) {
        const val = el.getAttribute("data-val") || el.getAttribute("data-color");
        if (val) selected.push(val);
      }
    });
    return selected;
  }

  // ---------------------------------------------------------------------------
  // 8. Dynamic Live Website Preview Generator & Simulator
  // ---------------------------------------------------------------------------
  const openPreviewBtn = document.getElementById("btn-open-preview");
  const mockContainer = document.getElementById("mock-browser-container");
  const mockContent = document.getElementById("mock-site-content");
  const mockAddress = document.getElementById("mock-address-text");
  const prevDesktopBtn = document.getElementById("prev-view-desktop");
  const prevMobileBtn = document.getElementById("prev-view-mobile");

  // Device Toggle
  if (prevDesktopBtn && prevMobileBtn && mockContainer) {
    prevDesktopBtn.addEventListener("click", () => {
      prevDesktopBtn.classList.add("active");
      prevMobileBtn.classList.remove("active");
      mockContainer.classList.remove("mode-mobile");
    });
    prevMobileBtn.addEventListener("click", () => {
      prevMobileBtn.classList.add("active");
      prevDesktopBtn.classList.remove("active");
      mockContainer.classList.add("mode-mobile");
    });
  }

  function generateMockWebsite() {
    const businessName = (document.getElementById("web-business-name")?.value || "").trim() || "Your Business Name";
    const businessDesc = (document.getElementById("web-business-desc")?.value || "").trim() || "Providing high-quality services and trusted solutions tailored for your needs.";
    const location = (document.getElementById("web-location")?.value || "").trim() || "City, State";
    const whatsapp = (document.getElementById("web-whatsapp")?.value || "").trim() || "+91 79023 01205";
    const phone = (document.getElementById("web-phone")?.value || "").trim() || whatsapp;
    const email = (document.getElementById("web-email")?.value || "").trim() || "hello@example.com";

    const selectedTypes = getSelectedValues("#website-types-grid .choice-card");
    const selectedPages = getSelectedValues("#common-pages-chips .choice-chip, #advanced-pages-chips .choice-chip");
    const selectedStyles = getSelectedValues("#design-styles-grid .choice-card");
    const selectedSections = getSelectedValues("#homepage-sections-chips .choice-chip");
    const selectedActions = getSelectedValues("#actions-comm-chips .choice-chip, #actions-services-chips .choice-chip, #actions-booking-chips .choice-chip, #actions-products-chips .choice-chip, #actions-info-chips .choice-chip");
    const selectedFeatures = getSelectedValues("#features-chips .choice-chip");

    const colorHex = guidedState.primaryColor || "#2563eb";
    const isDark = selectedStyles.includes("Dark Mode");
    const isLuxury = selectedStyles.includes("Luxury");

    // Mock URL
    const cleanDomain = businessName.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (mockAddress) {
      mockAddress.textContent = `https://${cleanDomain || "mybrand"}.com`;
    }

    // Prepare Pages for Nav
    const navPages = ["Home", ...selectedPages.filter(p => p !== "Home").slice(0, 5)];
    guidedState.customPages.forEach(cp => {
      if (navPages.length < 7) navPages.push(cp.name);
    });

    const hasServices = selectedPages.includes("Services") || selectedSections.some(s => s.toLowerCase().includes("services"));
    const hasGallery = selectedPages.includes("Gallery") || selectedSections.some(s => s.toLowerCase().includes("gallery"));
    const hasReviews = selectedPages.includes("Testimonials / Reviews") || selectedSections.some(s => s.toLowerCase().includes("testimonials") || s.toLowerCase().includes("reviews"));
    const hasProducts = selectedPages.includes("Products") || selectedSections.some(s => s.toLowerCase().includes("products"));
    const hasBooking = selectedPages.includes("Booking") || selectedTypes.some(t => t.toLowerCase().includes("booking") || t.toLowerCase().includes("appointment"));
    const hasMenu = selectedPages.includes("Menu");
    const hasMap = selectedSections.some(s => s.toLowerCase().includes("map") || s.toLowerCase().includes("location"));
    const hasHours = selectedSections.some(s => s.toLowerCase().includes("hours"));
    const hasPricing = selectedPages.includes("Pricing") || selectedSections.some(s => s.toLowerCase().includes("pricing"));

    // Theme Styles
    const bgStyle = isDark ? "background:#0f172a; color:#f8fafc;" : (isLuxury ? "background:#fafaf9; color:#1c1917;" : "background:#ffffff; color:#0f172a;");
    const cardBgStyle = isDark ? "background:#1e293b; border-color:#334155; color:#f8fafc;" : "background:#ffffff; border-color:#e2e8f0; color:#0f172a;";
    const mutedStyle = isDark ? "color:#94a3b8;" : "color:#64748b;";
    const heroBg = isDark
      ? `background: radial-gradient(circle at center, rgba(37, 99, 235, 0.15) 0%, #0f172a 100%);`
      : `background: linear-gradient(180deg, rgba(${hexToRgb(colorHex)}, 0.08) 0%, rgba(255, 255, 255, 0) 100%);`;

    let html = `
      <div style="font-family: var(--font-sans); ${bgStyle} min-height: 550px; display:flex; flex-direction:column; position:relative;">
        
        <!-- Mock Navigation Bar -->
        <header class="mock-nav" style="border-bottom: 1px solid ${isDark ? '#334155' : '#f1f5f9'};">
          <div class="mock-brand-title" style="color: ${colorHex};">
            <span>✨</span>
            <span>${escapeHtml(businessName)}</span>
          </div>
          <div class="mock-nav-links" style="${mutedStyle}">
            ${navPages.map((p, idx) => `
              <span style="${idx === 0 ? `color:${colorHex}; font-weight:700; border-bottom:2px solid ${colorHex}; padding-bottom:2px;` : ''}">${escapeHtml(p)}</span>
            `).join("")}
          </div>
          <div>
            <a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}" target="_blank" style="background:${colorHex}; color:white; padding:6px 14px; border-radius:6px; font-size:0.8rem; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:5px;">
              <span>💬</span> WhatsApp
            </a>
          </div>
        </header>

        <!-- Mock Hero Section -->
        <section class="mock-hero-section" style="${heroBg}">
          <span style="font-size:0.78rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:3px 10px; border-radius:20px; background:rgba(${hexToRgb(colorHex)}, 0.12); color:${colorHex};">
            ${selectedTypes[0] || 'Verified Business'}
          </span>
          <h1 class="mock-hero-title">
            Welcome to ${escapeHtml(businessName)}
          </h1>
          <p class="mock-hero-subtitle" style="${mutedStyle}">
            ${escapeHtml(businessDesc)}
          </p>
          <div class="mock-hero-cta-group">
            <button type="button" style="background:${colorHex}; color:white; border:none; padding:10px 20px; border-radius:6px; font-weight:700; font-size:0.92rem; cursor:pointer; box-shadow:0 3px 10px rgba(${hexToRgb(colorHex)}, 0.3);">
              ${hasBooking ? '📅 Book Appointment' : (hasProducts ? '🛍️ Shop Now' : (hasMenu ? '📜 View Menu' : 'Get in Touch'))}
            </button>
            <button type="button" style="background:transparent; border:1.5px solid ${isDark ? '#475569' : '#cbd5e1'}; ${isDark ? 'color:#f8fafc' : 'color:#334155'}; padding:10px 18px; border-radius:6px; font-weight:600; font-size:0.92rem; cursor:pointer;">
              Explore Services &rarr;
            </button>
          </div>
        </section>

        <!-- Mock Services / Offerings Grid -->
        ${hasServices || hasMenu ? `
          <section class="mock-section">
            <h2 class="mock-section-title" style="color:${isDark ? '#f8fafc' : '#0f172a'};">
              ${hasMenu ? 'Our Special Menu' : 'Our Featured Services'}
            </h2>
            <div class="mock-grid-3">
              <div class="mock-card" style="${cardBgStyle}">
                <div style="font-size:1.8rem; margin-bottom:0.5rem;">✨</div>
                <h3 style="font-size:1rem; font-weight:700; margin:0 0 0.25rem;">Popular Service 1</h3>
                <p style="font-size:0.82rem; ${mutedStyle} margin:0 0 0.75rem;">Premium customized service delivered by our trained professionals.</p>
                <strong style="color:${colorHex}; font-size:0.95rem;">Starting at ₹999</strong>
              </div>
              <div class="mock-card" style="${cardBgStyle}">
                <div style="font-size:1.8rem; margin-bottom:0.5rem;">⭐</div>
                <h3 style="font-size:1rem; font-weight:700; margin:0 0 0.25rem;">Special Package 2</h3>
                <p style="font-size:0.82rem; ${mutedStyle} margin:0 0 0.75rem;">Complete end-to-end package with verified satisfaction guarantee.</p>
                <strong style="color:${colorHex}; font-size:0.95rem;">Starting at ₹2,499</strong>
              </div>
              <div class="mock-card" style="${cardBgStyle}">
                <div style="font-size:1.8rem; margin-bottom:0.5rem;">💎</div>
                <h3 style="font-size:1rem; font-weight:700; margin:0 0 0.25rem;">Exclusive Service 3</h3>
                <p style="font-size:0.82rem; ${mutedStyle} margin:0 0 0.75rem;">Signature offering tailored specifically for premium client requirements.</p>
                <strong style="color:${colorHex}; font-size:0.95rem;">Starting at ₹4,999</strong>
              </div>
            </div>
          </section>
        ` : ''}

        <!-- Mock Products Section (if E-Commerce) -->
        ${hasProducts ? `
          <section class="mock-section" style="background:${isDark ? '#131f37' : '#f8fafc'};">
            <h2 class="mock-section-title">Trending Products</h2>
            <div class="mock-grid-3">
              <div class="mock-card" style="${cardBgStyle}; text-align:center;">
                <div style="height:110px; background:${isDark ? '#334155' : '#e2e8f0'}; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:2rem; margin-bottom:0.75rem;">🛍️</div>
                <h3 style="font-size:0.95rem; font-weight:700; margin:0 0 0.25rem;">Product Item A</h3>
                <span style="color:${colorHex}; font-weight:700; font-size:0.95rem; display:block; margin-bottom:0.5rem;">₹1,499</span>
                <button type="button" style="background:${colorHex}; color:white; border:none; padding:5px 12px; border-radius:4px; font-size:0.8rem; font-weight:700; width:100%; cursor:pointer;">Add to Cart</button>
              </div>
              <div class="mock-card" style="${cardBgStyle}; text-align:center;">
                <div style="height:110px; background:${isDark ? '#334155' : '#e2e8f0'}; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:2rem; margin-bottom:0.75rem;">🎁</div>
                <h3 style="font-size:0.95rem; font-weight:700; margin:0 0 0.25rem;">Product Item B</h3>
                <span style="color:${colorHex}; font-weight:700; font-size:0.95rem; display:block; margin-bottom:0.5rem;">₹2,299</span>
                <button type="button" style="background:${colorHex}; color:white; border:none; padding:5px 12px; border-radius:4px; font-size:0.8rem; font-weight:700; width:100%; cursor:pointer;">Add to Cart</button>
              </div>
              <div class="mock-card" style="${cardBgStyle}; text-align:center;">
                <div style="height:110px; background:${isDark ? '#334155' : '#e2e8f0'}; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:2rem; margin-bottom:0.75rem;">📦</div>
                <h3 style="font-size:0.95rem; font-weight:700; margin:0 0 0.25rem;">Product Item C</h3>
                <span style="color:${colorHex}; font-weight:700; font-size:0.95rem; display:block; margin-bottom:0.5rem;">₹3,499</span>
                <button type="button" style="background:${colorHex}; color:white; border:none; padding:5px 12px; border-radius:4px; font-size:0.8rem; font-weight:700; width:100%; cursor:pointer;">Add to Cart</button>
              </div>
            </div>
          </section>
        ` : ''}

        <!-- Mock Photo Gallery -->
        ${hasGallery ? `
          <section class="mock-section">
            <h2 class="mock-section-title">Photo Gallery & Highlights</h2>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:0.6rem;">
              <div style="height:100px; background:${isDark ? '#334155' : '#e2e8f0'}; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">📸</div>
              <div style="height:100px; background:${isDark ? '#334155' : '#e2e8f0'}; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">✨</div>
              <div style="height:100px; background:${isDark ? '#334155' : '#e2e8f0'}; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">🎉</div>
              <div style="height:100px; background:${isDark ? '#334155' : '#e2e8f0'}; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">🏢</div>
            </div>
          </section>
        ` : ''}

        <!-- Mock Testimonials & Reviews -->
        ${hasReviews ? `
          <section class="mock-section" style="background:${isDark ? '#162238' : '#f8fafc'};">
            <h2 class="mock-section-title">What Our Clients Say</h2>
            <div class="mock-grid-3">
              <div class="mock-card" style="${cardBgStyle}">
                <div style="color:#f59e0b; margin-bottom:0.4rem;">⭐⭐⭐⭐⭐</div>
                <p style="font-size:0.84rem; ${mutedStyle} line-height:1.5; margin:0 0 0.5rem;">"Outstanding service and quality! The entire experience was smooth and beyond our expectations."</p>
                <strong style="font-size:0.82rem;">— Priya S., Local Customer</strong>
              </div>
              <div class="mock-card" style="${cardBgStyle}">
                <div style="color:#f59e0b; margin-bottom:0.4rem;">⭐⭐⭐⭐⭐</div>
                <p style="font-size:0.84rem; ${mutedStyle} line-height:1.5; margin:0 0 0.5rem;">"Highly recommended! Friendly staff, prompt response, and transparent pricing."</p>
                <strong style="font-size:0.82rem;">— Rahul M., Verified Client</strong>
              </div>
              <div class="mock-card" style="${cardBgStyle}">
                <div style="color:#f59e0b; margin-bottom:0.4rem;">⭐⭐⭐⭐⭐</div>
                <p style="font-size:0.84rem; ${mutedStyle} line-height:1.5; margin:0 0 0.5rem;">"Super convenient to book and communicate directly on WhatsApp. 10/10!"</p>
                <strong style="font-size:0.82rem;">— Ananya K., Regular Client</strong>
              </div>
            </div>
          </section>
        ` : ''}

        <!-- Mock Contact, Hours & Map -->
        <section class="mock-section">
          <h2 class="mock-section-title">Visit & Connect With Us</h2>
          <div class="mock-grid-3">
            <div class="mock-card" style="${cardBgStyle}">
              <div style="font-size:1.5rem; margin-bottom:0.4rem;">📍</div>
              <h3 style="font-size:0.95rem; font-weight:700; margin:0 0 0.25rem;">Our Location</h3>
              <p style="font-size:0.84rem; ${mutedStyle}; margin:0;">${escapeHtml(location)}</p>
              ${hasMap ? `<span style="display:inline-block; font-size:0.78rem; color:${colorHex}; font-weight:600; margin-top:0.4rem;">🗺️ Google Maps Directions Active</span>` : ''}
            </div>

            <div class="mock-card" style="${cardBgStyle}">
              <div style="font-size:1.5rem; margin-bottom:0.4rem;">⏰</div>
              <h3 style="font-size:0.95rem; font-weight:700; margin:0 0 0.25rem;">Opening Hours</h3>
              <p style="font-size:0.84rem; ${mutedStyle}; margin:0;">Mon – Sat: 9:30 AM – 8:00 PM<br>Sunday: By Appointment</p>
            </div>

            <div class="mock-card" style="${cardBgStyle}">
              <div style="font-size:1.5rem; margin-bottom:0.4rem;">💬</div>
              <h3 style="font-size:0.95rem; font-weight:700; margin:0 0 0.25rem;">Direct Inquiries</h3>
              <p style="font-size:0.84rem; ${mutedStyle}; margin:0;">WhatsApp: ${escapeHtml(whatsapp)}<br>Phone: ${escapeHtml(phone)}</p>
            </div>
          </div>
        </section>

        <!-- Floating WhatsApp Widget -->
        <div class="mock-floating-whatsapp" title="WhatsApp Us">
          💬
        </div>

        <!-- Mock Footer -->
        <footer class="mock-footer">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
            <div>
              <strong>${escapeHtml(businessName)}</strong>
              <div style="color:#94a3b8; font-size:0.76rem; margin-top:3px;">&copy; 2026 ${escapeHtml(businessName)}. All rights reserved.</div>
            </div>
            <div style="display:flex; gap:0.85rem; font-size:0.78rem; color:#94a3b8;">
              ${navPages.map(p => `<span>${escapeHtml(p)}</span>`).join("")}
            </div>
          </div>
        </footer>

      </div>
    `;

    if (mockContent) {
      mockContent.innerHTML = html;
    }
  }

  function hexToRgb(hex) {
    if (!hex) return "37, 99, 235";
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map(x => x + x).join("");
    const num = parseInt(c, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  if (openPreviewBtn) {
    openPreviewBtn.addEventListener("click", () => {
      generateMockWebsite();
      if (typeof openModal === "function") {
        openModal("website-preview-modal");
      } else {
        const modal = document.getElementById("website-preview-modal");
        if (modal) modal.classList.add("active");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 9. Form Submissions
  // ---------------------------------------------------------------------------

  // 9A. Guided Website Form Submission (`#website-guided-form`)
  const guidedForm = document.getElementById("website-guided-form");
  if (guidedForm) {
    guidedForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById("submit-guided-btn");
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting Website Request...";

      try {
        const businessName = (document.getElementById("web-business-name")?.value || "").trim();
        const businessDesc = (document.getElementById("web-business-desc")?.value || "").trim();
        const location = (document.getElementById("web-location")?.value || "").trim();
        const whatsapp = (document.getElementById("web-whatsapp")?.value || "").trim();
        const phone = (document.getElementById("web-phone")?.value || "").trim();
        const email = (document.getElementById("web-email")?.value || "").trim();
        const clientName = (document.getElementById("web-client-name")?.value || "").trim();
        const instagram = (document.getElementById("web-instagram")?.value || "").trim();
        const facebook = (document.getElementById("web-facebook")?.value || "").trim();
        const googleMaps = (document.getElementById("web-google-maps")?.value || "").trim();
        const existingWebsite = (document.getElementById("web-existing-site")?.value || "").trim();
        const logoUrl = (document.getElementById("web-logo-url")?.value || "").trim();
        const photosUrl = (document.getElementById("web-photos-url")?.value || "").trim();
        const businessOther = (document.getElementById("web-business-other")?.value || "").trim();

        const websiteTypes = getSelectedValues("#website-types-grid .choice-card");
        const typeOther = (document.getElementById("web-type-other")?.value || "").trim();
        if (typeOther) websiteTypes.push(typeOther);

        const commonPages = getSelectedValues("#common-pages-chips .choice-chip");
        const advancedPages = getSelectedValues("#advanced-pages-chips .choice-chip");
        const selectedPages = [...commonPages, ...advancedPages];

        const commActions = getSelectedValues("#actions-comm-chips .choice-chip");
        const serviceActions = getSelectedValues("#actions-services-chips .choice-chip");
        const bookingActions = getSelectedValues("#actions-booking-chips .choice-chip");
        const productActions = getSelectedValues("#actions-products-chips .choice-chip");
        const infoActions = getSelectedValues("#actions-info-chips .choice-chip");
        const customerActions = [...commActions, ...serviceActions, ...bookingActions, ...productActions, ...infoActions];
        const actionsOther = (document.getElementById("web-actions-other")?.value || "").trim();
        if (actionsOther) customerActions.push(actionsOther);

        const designStyles = getSelectedValues("#design-styles-grid .choice-card");
        const preferredColors = getSelectedValues("#color-swatches-grid .color-swatch-card");
        const customColor = (document.getElementById("web-custom-color")?.value || "").trim();
        const websiteFeelings = getSelectedValues("#website-feelings-chips .choice-chip");
        const homepageSections = getSelectedValues("#homepage-sections-chips .choice-chip");
        const features = getSelectedValues("#features-chips .choice-chip");
        const featuresOther = (document.getElementById("web-features-other")?.value || "").trim();
        if (featuresOther) features.push(featuresOther);

        const ecommerceSelling = getSelectedValues("#ecommerce-sell-chips .choice-chip");
        const ecommerceFeatures = getSelectedValues("#ecommerce-features-chips .choice-chip");
        const bookingFeatures = getSelectedValues("#booking-features-chips .choice-chip");

        const contentAssets = getSelectedValues("#assets-available-chips .choice-chip");
        const contentHelp = getSelectedValues("#content-help-chips .choice-chip")[0] || "Not sure yet";

        const budgetChips = getSelectedValues("#budget-chips .choice-chip");
        const customBudget = (document.getElementById("web-custom-budget")?.value || "").trim();
        const finalBudget = customBudget || budgetChips[0] || "₹5,000 – ₹10,000";

        const deadlineChips = getSelectedValues("#deadline-chips .choice-chip");
        const customDeadline = (document.getElementById("web-custom-deadline")?.value || "").trim();
        const finalDeadline = customDeadline || deadlineChips[0] || "1–2 weeks";

        const customRequirements = (document.getElementById("web-custom-requirements")?.value || "").trim();

        if (!businessName || !businessDesc || !whatsapp || !email || !clientName) {
          throw new Error("Please complete the required business details (Name, Description, WhatsApp, Email, Your Name).");
        }

        const currentUser = FidoAuth.getCurrentUser();

        // Build Comprehensive Human-Readable Legacy Summary for Description
        const legacySummary = [
          `**Business / Brand**: ${businessName}`,
          `**What Business Does**: ${businessDesc}`,
          `**Location**: ${location || 'Not specified'}`,
          `**WhatsApp**: ${whatsapp}`,
          `**Phone**: ${phone || whatsapp}`,
          `**Instagram**: ${instagram || 'None'} | **Facebook**: ${facebook || 'None'}`,
          `**Existing Site**: ${existingWebsite || 'None'}`,
          ``,
          `**Website Type**: ${websiteTypes.join(", ") || 'Business Website'}`,
          `**Requested Pages**: ${selectedPages.join(", ")}${guidedState.customPages.length > 0 ? ` + Custom Pages: ${guidedState.customPages.map(cp => cp.name).join(", ")}` : ''}`,
          `**Customer Features / Actions**: ${customerActions.join(", ")}`,
          `**Design Preferences**: ${designStyles.join(", ")} | Colors: ${preferredColors.join(", ")} (${customColor || guidedState.primaryColor}) | Feelings: ${websiteFeelings.join(", ")}`,
          `**Homepage Layout**: ${homepageSections.join(", ")}`,
          `**Key Integrations**: ${features.join(", ")}`,
          ecommerceFeatures.length > 0 ? `**E-Commerce Specs**: Selling (${ecommerceSelling.join(", ")}), Features (${ecommerceFeatures.join(", ")})` : '',
          bookingFeatures.length > 0 ? `**Booking Specs**: ${bookingFeatures.join(", ")}` : '',
          `**Content Assets Available**: ${contentAssets.join(", ")} (Help Level: ${contentHelp})`,
          customRequirements ? `\n**Additional Client Requirements**: ${customRequirements}` : ''
        ].filter(Boolean).join("\n");

        const projectPayload = {
          title: `Website Development: ${businessName}`,
          category: "Website",
          projectType: "Website Development",
          description: legacySummary,
          requirements: customRequirements || "Full responsive website with custom branding, WhatsApp integration, and SEO setup.",
          budget: finalBudget,
          deadline: finalDeadline,
          clientId: currentUser ? currentUser.uid : "unregistered_client",
          clientName: clientName,
          clientBusiness: businessName,
          clientEmail: email,
          clientPhone: whatsapp,
          requiredSkills: ["Website", "Web Development", "UI/UX Design", "Frontend"],

          // Structured Website Specific Data
          websiteTypes,
          businessDetails: {
            name: businessName,
            description: businessDesc,
            location,
            whatsapp,
            phone,
            email,
            clientName,
            instagram,
            facebook,
            googleMaps,
            existingWebsite,
            logoUrl,
            photosUrl,
            otherNotes: businessOther
          },
          selectedPages,
          customPages: guidedState.customPages,
          customerActions,
          designPreferences: {
            styles: designStyles,
            colors: preferredColors,
            customColor: customColor || guidedState.primaryColor,
            feelings: websiteFeelings
          },
          homepageSections,
          features,
          ecommerceDetails: {
            sellingTypes: ecommerceSelling,
            features: ecommerceFeatures
          },
          bookingDetails: {
            features: bookingFeatures
          },
          contentAssets: {
            available: contentAssets,
            helpNeeded: contentHelp
          },
          customRequirements,
          previewConfiguration: {
            primaryColor: guidedState.primaryColor,
            primaryColorName: guidedState.primaryColorName,
            styles: designStyles,
            navPages: selectedPages
          }
        };

        const createdProject = await FidoDB.createProject(projectPayload);

        // Display Confirmation Screen
        formContainer.style.display = "none";
        confirmationContainer.style.display = "block";

        document.getElementById("conf-project-id").textContent = createdProject.projectId;
        document.getElementById("conf-project-title").textContent = createdProject.title;
        document.getElementById("conf-project-category").textContent = createdProject.category;
        document.getElementById("conf-project-budget").textContent = createdProject.budget;

        if (typeof showToast === "function") {
          showToast("Website project submitted successfully! Our agency team will review your specifications.", "success");
        }
        window.scrollTo({ top: 0, behavior: "smooth" });

      } catch (err) {
        if (typeof showToast === "function") {
          showToast(err.message || "Failed to submit project. Please try again.", "error");
        }
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Website Project for Review →";
      }
    });
  }

  // 9B. Standard Concise Form Submission (`#post-work-form` for non-website categories)
  if (standardForm) {
    standardForm.addEventListener("submit", async (e) => {
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
          projectType: category,
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

        formContainer.style.display = "none";
        confirmationContainer.style.display = "block";

        document.getElementById("conf-project-id").textContent = createdProject.projectId;
        document.getElementById("conf-project-title").textContent = createdProject.title;
        document.getElementById("conf-project-category").textContent = createdProject.category;
        document.getElementById("conf-project-budget").textContent = createdProject.budget;

        if (typeof showToast === "function") {
          showToast("Project request submitted successfully!", "success");
        }
        window.scrollTo({ top: 0, behavior: "smooth" });

      } catch (err) {
        if (typeof showToast === "function") {
          showToast(err.message || "Failed to submit project. Please try again.", "error");
        }
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Work for Review";
      }
    });
  }
});
