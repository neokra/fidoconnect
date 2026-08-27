/**
 * FidoConnect - Payment Checkout Controller
 * 
 * Manages manual UPI checkout, dynamic plan pricing, interactive plan switching,
 * QR code rendering, UPI intent launch, duplicate UTR validation, target project
 * context, live verification status checking, and submission for admin verification.
 */

import { FidoAuth } from "./auth.js";
import { FidoDB, DEFAULT_UPI_CONFIG } from "./db.js";

let currentUser = null;
let currentPlan = null;
let allPublishedPlans = [];
let returnProject = null;
let targetProjectData = null;
let upiConfig = DEFAULT_UPI_CONFIG;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    upiConfig = await FidoDB.getUPIConfig();
  } catch (e) {
    upiConfig = DEFAULT_UPI_CONFIG;
  }

  await initPaymentPage();
});

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const planParam = params.get("plan");
  return {
    planKey: planParam ? planParam.trim().toLowerCase() : "",
    returnProject: params.get("return_project") || null,
    retry: params.get("retry") === "true"
  };
}

async function initPaymentPage() {
  const container = document.getElementById("payment-checkout-container");
  if (!container) return;

  const { planKey, returnProject: retProj, retry } = getQueryParams();
  returnProject = retProj;

  // 1. Load target project context if return_project is provided
  if (returnProject) {
    try {
      const projects = await FidoDB.getProjects();
      targetProjectData = projects.find(p => (p.projectId || p.id) === returnProject || p.id === returnProject) || null;
    } catch (e) {
      console.warn("Could not load target project details:", e);
    }
  }

  // 2. Load all published plans from Firestore
  try {
    allPublishedPlans = await FidoDB.getMembershipPlans(false);
  } catch (e) {
    allPublishedPlans = [];
  }

  // 3. Resolve requested plan from Firestore
  if (planKey) {
    currentPlan = await FidoDB.getMembershipPlanById(planKey);
  }

  // 4. If no plan specified or not found, fall back to recommended or first active plan
  if (!currentPlan && allPublishedPlans.length > 0) {
    currentPlan = allPublishedPlans.find(p => p.isRecommended) || allPublishedPlans[0];
  }

  // 5. If still no plan found in database
  if (!currentPlan) {
    container.innerHTML = `
      <div class="card text-center" style="padding: 3rem 2rem; max-width: 600px; margin: 0 auto; border-radius: var(--border-radius-lg);">
        <div style="font-size: 2.5rem; margin-bottom: 1rem;">⭐</div>
        <h2 style="font-size: 1.5rem; font-weight: 750; color: var(--color-primary); margin-bottom: 0.5rem;">No Active Membership Plans</h2>
        <p class="text-muted" style="margin-bottom: 1.5rem; line-height: 1.5;">Membership plans are currently being configured. Please check back shortly or visit your account dashboard.</p>
        <a href="account.html" class="btn btn-primary">Return to Account Dashboard &rarr;</a>
      </div>
    `;
    return;
  }

  // Update back link
  updateBackLink();

  // 6. If user happens to be logged in, check existing payment/membership state
  currentUser = FidoAuth.getCurrentUser();
  if (currentUser && !retry) {
    try {
      const pendingPayment = await FidoDB.getUserPendingMembershipPayment(currentUser.uid);
      if (pendingPayment) {
        renderPendingState(container, pendingPayment);
        return;
      }

      const isMemberActive = currentUser.membershipStatus === "active";
      if (isMemberActive && currentUser.membershipPlan === currentPlan.name) {
        renderAlreadyActiveState(container);
        return;
      }

      const latestPayment = await FidoDB.getUserLatestMembershipPayment(currentUser.uid);
      if (latestPayment && latestPayment.status === "rejected") {
        renderRejectedState(container, latestPayment);
        return;
      }
    } catch (e) {
      console.warn("Could not check user payment status:", e);
    }
  }

  // 7. Render Checkout Form
  renderCheckoutForm(container);
}

function updateBackLink() {
  const backLink = document.getElementById("payment-back-link");
  if (!backLink) return;

  if (returnProject) {
    backLink.href = `account.html?tab=membership&return_project=${encodeURIComponent(returnProject)}`;
    backLink.innerHTML = `&larr; Back to Membership Plans (Project ${returnProject})`;
  } else {
    backLink.href = "account.html?tab=membership";
    backLink.innerHTML = `&larr; Back to Membership Plans`;
  }
}

// Interactive plan switcher
window.switchPaymentPlan = async function(planId) {
  const plan = allPublishedPlans.find(p => p.id === planId) || await FidoDB.getMembershipPlanById(planId);
  if (!plan) return;

  currentPlan = plan;

  // Update URL without page reload
  const url = new URL(window.location);
  url.searchParams.set("plan", plan.id || plan.name.toLowerCase());
  window.history.replaceState({}, "", url);

  const container = document.getElementById("payment-checkout-container");
  if (container) {
    renderCheckoutForm(container);
  }
};

window.downloadQrCode = function() {
  const qrAsset = (currentPlan && currentPlan.qrImageUrl) || (upiConfig && upiConfig.qrAsset) || "images/fido-upi-qr.svg";
  const link = document.createElement("a");
  link.href = qrAsset;
  link.download = `FidoConnect-UPI-QR-${((currentPlan && currentPlan.name) || "Plan").replace(/\s+/g, "_")}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("QR Code download started!", "success");
};

function renderCheckoutForm(container) {
  const planPrice = Number(currentPlan.price !== undefined ? currentPlan.price : currentPlan.priceAmount) || 0;
  const planPriceDisplay = currentPlan.priceDisplay || `₹${planPrice.toLocaleString("en-IN")}`;
  const planDuration = currentPlan.duration || `${currentPlan.durationDays || 30} Days`;
  const planQrAsset = currentPlan.qrImageUrl || upiConfig.qrAsset || "images/fido-upi-qr.svg";
  const planUpiId = currentPlan.upiId || upiConfig.upiId || "fidoconnect@okaxis";
  const planMerchantName = currentPlan.merchantName || upiConfig.merchantName || "FidoConnect";

  // UPI Intent URI format for Smartphone (opens Google Pay, PhonePe, Paytm, BHIM, etc.)
  const intentNote = `FidoConnect ${currentPlan.name} Membership`;
  const upiIntentUri = `upi://pay?pa=${encodeURIComponent(planUpiId)}&pn=${encodeURIComponent(planMerchantName)}&am=${planPrice}&cu=INR&tn=${encodeURIComponent(intentNote)}`;

  container.innerHTML = `
    <!-- Top Summary Card: Prominent Plan & Exact Amount -->
    <div class="checkout-summary-card">
      <div class="summary-plan-info">
        <span class="summary-plan-tag">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--color-accent);"></span>
          FidoConnect Selected Freelancer
        </span>
        <h1 class="summary-plan-name">${currentPlan.name}</h1>
        <span class="summary-plan-period">${currentPlan.billingCycle || '/ ' + planDuration} (${currentPlan.durationDays || 30} Days)</span>
      </div>
      <div class="summary-amount-box">
        <span class="amount-label">Payable Amount</span>
        <div class="amount-value">${planPriceDisplay}</div>
      </div>
    </div>

    <!-- Return to Project Contextual Banner -->
    ${returnProject ? `
      <div class="card" style="background: var(--color-accent-soft); border: 1px solid var(--color-accent-border); padding: 1rem 1.25rem; margin-bottom: 1.5rem; border-radius: var(--border-radius-md);">
        <div style="display:flex; align-items:flex-start; gap:0.6rem;">
          <svg width="20" height="20" fill="none" stroke="var(--color-accent)" viewBox="0 0 24 24" style="flex-shrink:0; margin-top:2px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <div style="font-size: 0.88rem; color: var(--color-primary); line-height: 1.45;">
            <strong>Application Pending for Project ${returnProject}${targetProjectData ? `: ${targetProjectData.title || ''}` : ''}</strong> — Completing this payment enables proposal review once verified.
          </div>
        </div>
      </div>
    ` : ''}

    <!-- Interactive Plan Switcher (If multiple plans exist) -->
    ${allPublishedPlans.length > 1 ? `
      <div style="margin-bottom: 1.25rem;">
        <div style="font-size:0.75rem; font-weight:750; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.05em; margin-bottom:0.4rem;">
          Switch Plan Tier:
        </div>
        <div class="payment-plan-switcher">
          ${allPublishedPlans.map(plan => {
            const isSelected = plan.id === currentPlan.id || (plan.name && plan.name.toLowerCase() === currentPlan.name.toLowerCase());
            const priceNum = Number(plan.price !== undefined ? plan.price : plan.priceAmount) || 0;
            return `
              <button 
                type="button" 
                class="payment-plan-pill ${isSelected ? 'active' : ''}" 
                onclick="switchPaymentPlan('${plan.id}')"
              >
                <span>${plan.name}</span>
                <span class="pill-price">₹${priceNum.toLocaleString("en-IN")}</span>
                ${plan.isRecommended ? `<span style="font-size:0.75rem;">★</span>` : ''}
              </button>
            `;
          }).join("")}
        </div>
      </div>
    ` : ''}

    <!-- Dedicated Main Checkout Card -->
    <div class="payment-checkout-card">
      
      <!-- Step 1 & 2: Steps Progress Bar -->
      <div class="checkout-steps-bar">
        <div class="checkout-step-item active">
          <span class="checkout-step-num">1</span>
          <span>Pay ${planPriceDisplay}</span>
        </div>
        <div class="checkout-step-divider"></div>
        <div class="checkout-step-item">
          <span class="checkout-step-num">2</span>
          <span>Enter UTR</span>
        </div>
        <div class="checkout-step-divider"></div>
        <div class="checkout-step-item">
          <span class="checkout-step-num">3</span>
          <span>Verify</span>
        </div>
      </div>

      <!-- Smartphone ONLY CTA: Open UPI App -->
      <div class="mobile-upi-action-block">
        <a href="${upiIntentUri}" id="btn-open-upi-app" class="btn btn-primary btn-block open-upi-btn">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
          Open UPI App (${planPriceDisplay})
        </a>
        <div class="mobile-or-divider">
          <span>Or Scan / Download QR Below</span>
        </div>
      </div>

      <!-- Centered Large QR Code Display -->
      <div class="checkout-qr-wrapper" style="display:flex; flex-direction:column; align-items:center;">
        <div class="checkout-qr-card">
          <img 
            src="${planQrAsset}" 
            alt="FidoConnect UPI QR Code" 
            id="checkout-qr-image"
            class="checkout-qr-img" 
            onerror="this.onerror=null; this.src='images/fido-upi-qr.svg';" 
          />
          <div class="qr-scan-instruction">
            Scan the QR code with your UPI app to pay.
          </div>
          <div class="qr-recipient-tag">
            Recipient: <strong>${planMerchantName}</strong> &bull; Amount: <strong>${planPriceDisplay}</strong>
          </div>
        </div>

        <!-- QR Actions: Download QR Code + Copy UPI ID -->
        <div class="qr-actions-row">
          <button type="button" class="btn btn-secondary btn-sm btn-download-qr" onclick="downloadQrCode()">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Download QR Code
          </button>
          <button type="button" id="btn-copy-upi" class="btn btn-secondary btn-sm" onclick="copyUpiId()">
            📋 Copy UPI ID
          </button>
        </div>

        <!-- UPI ID Text Box -->
        <div class="upi-copy-box">
          <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">UPI ID:</span>
          <span id="upi-id-text" class="font-mono" style="font-weight:750; color:var(--color-primary);">${planUpiId}</span>
        </div>

        <!-- Accepted Apps List -->
        <div class="accepted-apps-container">
          <span class="accepted-apps-label">Accepted in all UPI Applications</span>
          <div class="accepted-apps-grid">
            <span class="accepted-app-tag">Google Pay</span>
            <span class="accepted-app-tag">PhonePe</span>
            <span class="accepted-app-tag">Paytm</span>
            <span class="accepted-app-tag">BHIM</span>
            <span class="accepted-app-tag">Cred</span>
            <span class="accepted-app-tag">Amazon Pay</span>
            <span class="accepted-app-tag">Any Bank UPI</span>
          </div>
        </div>
      </div>

      <!-- Step 3 & 4: Transaction ID / UTR Form Section -->
      <div style="border-top: 2px dashed var(--border-color); padding-top: 2rem;">
        <h3 style="font-size: 1.25rem; font-weight: 750; color: var(--color-primary); margin-bottom: 0.35rem;">
          Step 3: Enter Transaction ID / UTR
        </h3>
        <p class="text-muted" style="font-size: 0.88rem; margin-bottom: 1.25rem;">
          After completing the payment in your UPI app, enter the 12-digit UPI Reference Number / UTR below to submit for verification.
        </p>

        <form id="payment-verification-form">
          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label for="payment-utr-input" class="form-label form-label-required" style="font-weight: 700;">
              Transaction ID / UPI Reference Number (UTR)
            </label>
            <input 
              type="text" 
              id="payment-utr-input" 
              class="form-control font-mono" 
              placeholder="e.g. 423189201948 or UPI Ref No." 
              required 
              autocomplete="off"
              maxlength="30"
              style="font-size: 1.05rem; padding: 0.75rem 1rem;"
            />
            <span class="form-hint" style="margin-top: 0.35rem; display:block;">
              Found in your payment receipt details (Google Pay, PhonePe, Paytm, BHIM, Bank App).
            </span>
          </div>

          <div id="payment-submit-error" style="display:none; color: var(--color-danger); font-size: 0.88rem; margin-bottom: 1rem; padding: 0.75rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--border-radius-sm);"></div>

          <button type="submit" id="btn-submit-payment" class="btn btn-primary btn-block btn-lg" style="margin-bottom: 1.25rem; font-weight:750; font-size:1.05rem;">
            Submit Payment &rarr;
          </button>

          <!-- Security Note -->
          <div class="checkout-security-notice">
            <svg width="20" height="20" fill="none" stroke="var(--color-teal)" viewBox="0 0 24 24" style="flex-shrink:0; margin-top:2px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            <div>
              <strong>Secure Verification:</strong> Your membership will be activated after our team verifies the transaction reference against our bank records. Verification typically takes a few hours during standard business hours.
            </div>
          </div>
        </form>
      </div>

    </div>
  `;

  // Attach submit handler
  const form = document.getElementById("payment-verification-form");
  if (form) {
    form.addEventListener("submit", handlePaymentSubmit);
  }
}

async function handlePaymentSubmit(e) {
  e.preventDefault();
  const utrInput = document.getElementById("payment-utr-input");
  const submitBtn = document.getElementById("btn-submit-payment");
  const errorBox = document.getElementById("payment-submit-error");
  if (!utrInput || !submitBtn) return;

  const txnId = utrInput.value.trim();
  if (!txnId) {
    showToast("Please enter your UPI transaction ID / UTR.", "error");
    return;
  }

  if (txnId.length < 6) {
    showToast("Please enter a valid UPI transaction ID (at least 6 characters).", "error");
    return;
  }

  if (errorBox) errorBox.style.display = "none";
  currentUser = currentUser || FidoAuth.getCurrentUser();
  if (!currentUser) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Payment for Verification →";
    if (errorBox) {
      errorBox.textContent = "Please log in to submit your payment transaction ID for verification.";
      errorBox.style.display = "block";
    }
    showToast("Please log in to submit your transaction ID.", "info");
    const currentUrl = window.location.pathname + window.location.search;
    setTimeout(() => {
      window.location.href = `auth.html?redirect=${encodeURIComponent(currentUrl)}`;
    }, 1200);
    return;
  }

  try {
    const payment = await FidoDB.submitMembershipPayment({
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userName: currentUser.name || "Freelancer",
      planId: currentPlan.id,
      transactionId: txnId,
      returnProject: returnProject
    });

    showToast("✓ Payment submitted for verification!", "success");
    const container = document.getElementById("payment-checkout-container");
    if (container) {
      renderPendingState(container, payment);
    }
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Payment for Verification →";
    if (errorBox) {
      errorBox.textContent = err.message || "Failed to submit payment.";
      errorBox.style.display = "block";
    }
    showToast(err.message || "Submission failed", "error");
  }
}

function renderPendingState(container, payment) {
  container.innerHTML = `
    <div class="card text-center" style="padding: 3rem 2rem; border-radius: var(--border-radius-lg); border: 1px solid var(--border-color); max-width: 640px; margin: 0 auto;">
      
      <!-- Icon -->
      <div style="width: 64px; height: 64px; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; font-size: 2rem;">
        ⏳
      </div>

      <div style="display:inline-block; margin-bottom: 0.75rem;">
        <span class="badge" style="background:#fef3c7; color:#92400e; font-size:0.85rem; padding: 0.35rem 0.85rem; border:1px solid #fde68a;">
          🟡 Verification Pending
        </span>
      </div>

      <h2 style="font-size: 1.65rem; font-weight: 750; color: var(--color-primary); margin-bottom: 0.5rem;">
        Payment Submitted for Verification
      </h2>
      <p class="text-muted" style="font-size: 0.95rem; margin-bottom: 2rem; line-height: 1.5;">
        Your payment reference has been submitted. Our team is verifying the transaction against our account records.
      </p>

      <!-- Details Summary Box -->
      <div style="background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); padding: 1.5rem; text-align: left; margin-bottom: 1.75rem;">
        
        <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem; font-size:0.9rem; padding-bottom:0.75rem; border-bottom:1px solid var(--border-color);">
          <span class="text-muted">Selected Plan</span>
          <strong style="color:var(--color-primary);">${payment.planName || (currentPlan && currentPlan.name) || "Membership"}</strong>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem; font-size:0.9rem; padding-bottom:0.75rem; border-bottom:1px solid var(--border-color);">
          <span class="text-muted">Amount</span>
          <strong style="color:var(--color-accent); font-size:1.05rem;">₹${payment.amount || (currentPlan && (currentPlan.price || currentPlan.priceAmount)) || 0}</strong>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem; font-size:0.9rem; padding-bottom:0.75rem; border-bottom:1px solid var(--border-color);">
          <span class="text-muted">Transaction ID / UTR</span>
          <strong class="font-mono" style="color:var(--color-primary);">${payment.transactionId}</strong>
        </div>

        <div style="display:flex; justify-content:space-between; font-size:0.9rem; ${payment.returnProject ? 'padding-bottom:0.75rem; border-bottom:1px solid var(--border-color);' : ''}">
          <span class="text-muted">Submitted Date</span>
          <span style="color:var(--color-primary);">${formatDate(payment.submittedAt || payment.createdAt)}</span>
        </div>

        ${payment.returnProject ? `
          <div style="display:flex; justify-content:space-between; font-size:0.9rem; padding-top:0.75rem;">
            <span class="text-muted">Prepared Proposal</span>
            <strong style="color:var(--color-primary);">Project ${payment.returnProject}</strong>
          </div>
        ` : ''}

      </div>

      <!-- Live Status Check Button -->
      <div style="margin-bottom: 1.75rem;">
        <button type="button" id="btn-check-status" class="btn btn-secondary btn-sm" onclick="checkLivePaymentStatus('${payment.id}')" style="display:inline-flex; align-items:center; gap:6px;">
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          <span>Check Verification Status</span>
        </button>
      </div>

      <!-- Trust Note -->
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--border-radius-md); padding: 1rem 1.25rem; font-size: 0.88rem; color: #1e40af; margin-bottom: 2rem; line-height: 1.5; text-align: left;">
        <strong>Your membership will be activated automatically once verified.</strong><br/>
        You will receive full access to apply for matching project opportunities as soon as the transaction is confirmed.
      </div>

      <!-- Actions -->
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${payment.returnProject ? `
          <a href="project-details.html?id=${encodeURIComponent(payment.returnProject)}" class="btn btn-secondary">
            View Project ${payment.returnProject} Draft
          </a>
        ` : ''}
        <a href="account.html" class="btn btn-primary btn-lg">
          Go to Account Dashboard &rarr;
        </a>
        <a href="find-work.html" class="btn btn-secondary">
          Browse Matching Projects
        </a>
      </div>

    </div>
  `;
}

window.checkLivePaymentStatus = async function(paymentId) {
  const btn = document.getElementById("btn-check-status");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="preloader-spinner" style="width:14px; height:14px; margin:0; display:inline-block; vertical-align:middle;"></span> Checking...`;
  }

  try {
    // Refresh user profile
    const updatedUser = await FidoAuth.waitForAuth();
    currentUser = updatedUser;

    const pendingPayment = await FidoDB.getUserPendingMembershipPayment(currentUser.uid);
    const container = document.getElementById("payment-checkout-container");

    if (!pendingPayment) {
      // Payment might be verified or rejected!
      if (currentUser.membershipStatus === "active") {
        showToast("🎉 Payment verified! Your membership is active.", "success");
        if (container) renderAlreadyActiveState(container);
      } else {
        const latest = await FidoDB.getUserLatestMembershipPayment(currentUser.uid);
        if (latest && latest.status === "rejected") {
          showToast("Payment verification was not approved.", "error");
          if (container) renderRejectedState(container, latest);
        } else {
          showToast("No active payment found.", "info");
          if (container) renderCheckoutForm(container);
        }
      }
    } else {
      showToast("Payment is currently still under verification.", "info");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          <span>Check Verification Status</span>
        `;
      }
    }
  } catch (err) {
    showToast("Error checking status: " + err.message, "error");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>Check Verification Status</span>`;
    }
  }
};

function renderAlreadyActiveState(container) {
  container.innerHTML = `
    <div class="card text-center" style="padding: 3rem 2rem; border-radius: var(--border-radius-lg); border: 1px solid var(--border-color); max-width: 640px; margin: 0 auto;">
      <div style="width: 64px; height: 64px; border-radius: 50%; background: #ecfdf5; color: #059669; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; font-size: 2rem;">
        ✓
      </div>

      <span class="badge badge-active" style="font-size:0.85rem; padding: 0.35rem 0.85rem; margin-bottom: 0.75rem;">
        Active Membership
      </span>

      <h2 style="font-size: 1.65rem; font-weight: 750; color: var(--color-primary); margin-bottom: 0.5rem;">
        ${currentUser.membershipPlan || "Membership"} is Active
      </h2>
      <p class="text-muted" style="font-size: 0.95rem; margin-bottom: 2rem; line-height: 1.5;">
        Your membership is active until <strong>${formatDate(currentUser.membershipExpiry)}</strong>. You have full access to apply for eligible project opportunities.
      </p>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${returnProject ? `
          <a href="project-details.html?id=${encodeURIComponent(returnProject)}&from_plan=true" class="btn btn-primary btn-lg">
            Return to Project ${returnProject} & Submit Proposal &rarr;
          </a>
        ` : ''}
        <a href="find-work.html" class="btn btn-primary btn-lg">Find & Apply for Work &rarr;</a>
        <a href="account.html" class="btn btn-secondary">Go to Account Dashboard</a>
        <a href="payment.html?plan=${(currentPlan && currentPlan.id) || 'basic'}&retry=true${returnProject ? '&return_project=' + encodeURIComponent(returnProject) : ''}" class="btn btn-link btn-sm" style="color:var(--text-muted); margin-top:0.5rem;">
          Upgrade / Extend Membership &rarr;
        </a>
      </div>
    </div>
  `;
}

function renderRejectedState(container, payment) {
  container.innerHTML = `
    <div class="card text-center" style="padding: 3rem 2rem; border-radius: var(--border-radius-lg); border: 1px solid var(--border-color); max-width: 640px; margin: 0 auto;">
      <div style="width: 64px; height: 64px; border-radius: 50%; background: #fef2f2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; font-size: 2rem;">
        ✕
      </div>

      <span class="badge badge-rejected" style="font-size:0.85rem; padding: 0.35rem 0.85rem; margin-bottom: 0.75rem;">
        Verification Failed / Rejected
      </span>

      <h2 style="font-size: 1.65rem; font-weight: 750; color: var(--color-primary); margin-bottom: 0.5rem;">
        Payment Verification Unsuccessful
      </h2>
      <p class="text-muted" style="font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.5;">
        Your previous payment submission (Txn ID: <strong>${payment.transactionId}</strong>) could not be verified against our bank statement.
      </p>

      ${payment.adminNote ? `
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--border-radius-md); padding: 1rem; font-size: 0.88rem; color: #991b1b; margin-bottom: 1.75rem; text-align: left;">
          <strong>Admin Note:</strong> ${payment.adminNote}
        </div>
      ` : ''}

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <a href="payment.html?plan=${(currentPlan && currentPlan.id) || (payment && payment.planId) || 'basic'}&retry=true${returnProject ? '&return_project=' + encodeURIComponent(returnProject) : ''}" class="btn btn-primary btn-lg">
          Start New Payment Attempt &rarr;
        </a>
        <a href="account.html" class="btn btn-secondary">
          Return to Account Dashboard
        </a>
      </div>
    </div>
  `;
}

function renderClientView(container) {
  container.innerHTML = `
    <div class="card text-center" style="padding: 3rem 2rem; border-radius: var(--border-radius-lg); border: 1px solid var(--border-color); max-width: 640px; margin: 0 auto;">
      <div style="width: 64px; height: 64px; border-radius: 50%; background: #eff6ff; color: var(--color-accent); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; font-size: 2rem;">
        💼
      </div>

      <span class="badge badge-proposal" style="font-size:0.85rem; padding: 0.35rem 0.85rem; margin-bottom: 0.75rem;">
        Client Account
      </span>

      <h2 style="font-size: 1.65rem; font-weight: 750; color: var(--color-primary); margin-bottom: 0.5rem;">
        Client Account Detected
      </h2>
      <p class="text-muted" style="font-size: 0.95rem; margin-bottom: 2rem; line-height: 1.6;">
        FidoConnect membership plans are for <strong>Freelancers</strong> to access curated project applications. As a Client, posting projects and collaborating with verified specialists is completely free with zero subscription fees!
      </p>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <a href="post-work.html" class="btn btn-primary btn-lg">Post a Work (Free) &rarr;</a>
        <a href="account.html" class="btn btn-secondary">Go to Client Dashboard</a>
      </div>
    </div>
  `;
}

function renderUnverifiedFreelancerView(container) {
  container.innerHTML = `
    <div class="card text-center" style="padding: 3rem 2rem; border-radius: var(--border-radius-lg); border: 1px solid var(--border-color); max-width: 640px; margin: 0 auto;">
      <div style="width: 64px; height: 64px; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; font-size: 2rem;">
        🔐
      </div>

      <span class="badge" style="background:#fef3c7; color:#92400e; font-size:0.85rem; padding: 0.35rem 0.85rem; margin-bottom: 0.75rem;">
        Invite-Only Access
      </span>

      <h2 style="font-size: 1.65rem; font-weight: 750; color: var(--color-primary); margin-bottom: 0.5rem;">
        Freelancer Access is Invite-Only
      </h2>
      <p class="text-muted" style="font-size: 0.95rem; margin-bottom: 2rem; line-height: 1.6;">
        You must verify an official FidoConnect invitation code before selecting a membership tier and unlocking project proposals.
      </p>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <a href="account.html" class="btn btn-primary btn-lg">Go to Account & Enter Invite Code &rarr;</a>
        <a href="find-work.html" class="btn btn-secondary">Browse Public Preview</a>
      </div>
    </div>
  `;
}

window.copyUpiId = function() {
  const upiId = (currentPlan && currentPlan.upiId) || (upiConfig && upiConfig.upiId) || "fidoconnect@okaxis";
  const btn = document.getElementById("btn-copy-upi");

  const onSuccess = () => {
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = "✓ Copied!";
      btn.classList.replace("btn-secondary", "btn-primary");
      setTimeout(() => {
        btn.textContent = orig;
        btn.classList.replace("btn-primary", "btn-secondary");
      }, 2000);
    }
    showToast("UPI ID copied to clipboard!", "success");
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(upiId).then(onSuccess).catch(() => {
      fallbackCopy(upiId, onSuccess);
    });
  } else {
    fallbackCopy(upiId, onSuccess);
  }
};

function fallbackCopy(text, cb) {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    if (successful && cb) {
      cb();
    } else {
      showToast("UPI ID: " + text, "info");
    }
  } catch (err) {
    showToast("UPI ID: " + text, "info");
  }
}
