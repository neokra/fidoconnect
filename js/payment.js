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

function renderCheckoutForm(container) {
  const planPrice = Number(currentPlan.price !== undefined ? currentPlan.price : currentPlan.priceAmount) || 0;
  const planPriceDisplay = currentPlan.priceDisplay || `₹${planPrice.toLocaleString("en-IN")}`;
  const planDuration = currentPlan.duration || `${currentPlan.durationDays || 30} Days`;
  const planQrAsset = currentPlan.qrImageUrl || upiConfig.qrAsset || "images/fido-upi-qr.svg";
  const planUpiId = currentPlan.upiId || upiConfig.upiId || "fidoconnect@okaxis";
  const planMerchantName = currentPlan.merchantName || upiConfig.merchantName || "FidoConnect";
  const isAdminUser = FidoAuth.isAdmin();

  // UPI Intent URI format: upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...
  const intentNote = `FidoConnect ${currentPlan.name} Membership`;
  const upiIntentUri = `upi://pay?pa=${encodeURIComponent(planUpiId)}&pn=${encodeURIComponent(planMerchantName)}&am=${planPrice}&cu=INR&tn=${encodeURIComponent(intentNote)}`;

  container.innerHTML = `
    <!-- Header -->
    <div style="margin-bottom: 1.75rem;">
      <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--color-accent);"></span>
        <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.06em; font-weight:700; color:var(--color-accent);">Selected Freelancer Program (India)</span>
      </div>
      <h1 style="font-size: 2rem; font-weight: 750; margin-bottom: 0.5rem; color: var(--color-primary); letter-spacing: -0.02em;">Complete Membership Payment</h1>
      <p class="text-muted" style="font-size: 1rem; margin: 0; line-height: 1.5;">
        Activate your <strong>${currentPlan.name}</strong> access via UPI. Verification is processed manually by FidoConnect within business hours.
      </p>
    </div>

    <!-- Admin Preview Banner (if admin) -->
    ${isAdminUser ? `
      <div class="card" style="background:#f0fdf4; border:1px solid #bbf7d0; padding:1rem 1.25rem; margin-bottom:1.5rem; border-radius:var(--border-radius-md);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
          <div style="display:flex; align-items:center; gap:0.6rem; font-size:0.88rem; color:#166534;">
            <span style="font-size:1.1rem;">👑</span>
            <span><strong>Admin Mode:</strong> Viewing freelancer payment checkout. You can test submissions or manage incoming payments.</span>
          </div>
          <a href="admin.html#sec-payments" class="btn btn-secondary btn-sm" style="background:#ffffff; border-color:#86efac; color:#166534;">
            Go to Admin Payment Verifications &rarr;
          </a>
        </div>
      </div>
    ` : ''}

    <!-- Return to Project Contextual Banner -->
    ${returnProject ? `
      <div class="card" style="background: var(--color-accent-soft); border: 1px solid var(--color-accent-border); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; border-radius: var(--border-radius-md);">
        <div style="display:flex; align-items:flex-start; gap:0.75rem;">
          <svg width="22" height="22" fill="none" stroke="var(--color-accent)" viewBox="0 0 24 24" style="flex-shrink:0; margin-top:2px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <div style="font-size: 0.92rem; color: var(--color-primary); line-height: 1.5;">
            <strong>Application Pending for Project ${returnProject}${targetProjectData ? `: ${targetProjectData.title || ''}` : ''}</strong><br/>
            Completing this membership payment will enable final submission and client review of your prepared proposal once verified.
            <div style="margin-top:0.35rem;">
              <a href="project-details.html?id=${encodeURIComponent(returnProject)}" style="color:var(--color-accent); font-weight:600; text-decoration:none; font-size:0.85rem;">
                View Project Details & Draft &rarr;
              </a>
            </div>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- Interactive Plan Switcher Pills (If multiple plans available) -->
    ${allPublishedPlans.length > 1 ? `
      <div style="margin-bottom: 1.25rem;">
        <div style="font-size:0.8rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em; margin-bottom:0.5rem;">
          Select Membership Plan:
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

    <div style="display: grid; grid-template-columns: 1fr; gap: 1.75rem;">
      
      <!-- 1. Selected Plan Details Card -->
      <div class="payment-checkout-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom: 1.25rem;">
          <div>
            <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.25rem;">
              <span class="badge ${currentPlan.isRecommended ? 'badge-active' : 'badge-proposal'}" style="font-size:0.75rem;">Selected Plan</span>
              ${currentPlan.isRecommended ? `<span style="font-size:0.78rem; font-weight:700; color:var(--color-accent);">★ ${currentPlan.badge || 'Recommended'}</span>` : ''}
            </div>
            <h2 style="font-size: 1.5rem; font-weight: 750; color: var(--color-primary); margin-bottom: 0.25rem;">${currentPlan.name}</h2>
            <p class="text-muted" style="font-size: 0.9rem; margin: 0;">${currentPlan.description || 'Access to selected freelancer opportunities.'}</p>
          </div>
          
          <div style="text-align: right; min-width: 140px;">
            <div style="font-size: 2rem; font-weight: 800; color: var(--color-accent); line-height: 1;">${planPriceDisplay}</div>
            <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 600; margin-top: 4px;">${currentPlan.billingCycle || '/ ' + planDuration} (${currentPlan.durationDays || 30} Days)</div>
          </div>
        </div>

        ${Array.isArray(currentPlan.features) && currentPlan.features.length > 0 ? `
          <div style="background:var(--bg-subtle); border-radius:var(--border-radius-md); padding:0.85rem 1rem; margin-bottom:1rem;">
            <div style="font-size:0.78rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em; margin-bottom:0.4rem;">Plan Includes:</div>
            <ul style="list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:0.4rem; font-size:0.85rem; color:var(--color-primary);">
              ${currentPlan.features.map(f => `
                <li style="display:flex; align-items:center; gap:6px;">
                  <span style="color:var(--color-teal); font-weight:bold;">✓</span>
                  <span>${f}</span>
                </li>
              `).join("")}
            </ul>
          </div>
        ` : ''}

        <div style="border-top: 1px solid var(--border-color); padding-top: 1rem; display:flex; justify-content:space-between; align-items:center; font-size:0.88rem; flex-wrap:wrap; gap:0.5rem;">
          <span class="text-muted">Freelancer Account: <strong style="color:var(--color-primary);">${currentUser.name || currentUser.email}</strong></span>
          <a href="account.html?tab=membership${returnProject ? '&return_project=' + encodeURIComponent(returnProject) : ''}" style="color:var(--color-accent); font-weight:600; text-decoration:none;">
            Compare All Plans &rarr;
          </a>
        </div>
      </div>

      <!-- 2. Pay using UPI Section Card -->
      <div class="payment-checkout-card">
        <h3 style="font-size: 1.3rem; font-weight: 750; color: var(--color-primary); margin-bottom: 0.4rem;">
          Step 1: Pay using UPI
        </h3>
        <p class="text-muted" style="font-size: 0.92rem; margin-bottom: 1.75rem;">
          Scan the QR code with any UPI application (Google Pay, PhonePe, Paytm, BHIM, Bank Apps) and transfer exactly <strong>${planPriceDisplay}</strong>.
        </p>

        <!-- Centered QR Container -->
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 2rem;">
          
          <!-- QR Card -->
          <div class="upi-qr-card">
            <img 
              src="${planQrAsset}" 
              alt="FidoConnect UPI QR Code" 
              style="width: 100%; max-height: 240px; height: auto; display: block; border-radius: 8px; margin: 0 auto 0.75rem; object-fit: contain;" 
              onerror="this.onerror=null; this.src='images/fido-upi-qr.svg';" 
            />
            <div style="font-size: 0.88rem; font-weight: 750; color: var(--color-primary);">Scan to Pay ${planPriceDisplay}</div>
            <div style="font-size: 0.76rem; color: var(--text-muted); margin-top:2px;">Recipient: <strong>${planMerchantName}</strong></div>
          </div>

          <!-- UPI ID Copy Box -->
          <div class="upi-copy-box" style="margin-top: 1.25rem;">
            <div>
              <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">UPI ID</div>
              <div id="upi-id-text" style="font-family: var(--font-mono); font-size: 0.95rem; font-weight: 700; color: var(--color-primary);">${planUpiId}</div>
            </div>
            <button type="button" id="btn-copy-upi" class="btn btn-secondary btn-sm" style="padding: 4px 12px; font-size: 0.8rem;" onclick="copyUpiId()">
              📋 Copy
            </button>
          </div>

          <!-- Direct UPI Intent Button (Mobile & Supported Browsers) -->
          <div style="margin-top: 1.25rem; width: 100%; max-width: 380px; text-align: center;">
            <a href="${upiIntentUri}" id="btn-upi-app" class="btn btn-primary btn-block btn-lg" style="display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none;">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
              Pay with UPI App (${planPriceDisplay})
            </a>
            <span style="display:block; font-size: 0.75rem; color: var(--text-muted); margin-top: 6px;">
              Opens Google Pay, PhonePe, Paytm, or BHIM directly on your smartphone.
            </span>
          </div>

          <!-- Accepted Apps Badges -->
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

        <!-- 3. Payment Confirmation Section -->
        <div style="border-top: 2px dashed var(--border-color); padding-top: 2rem;">
          <h4 style="font-size: 1.2rem; font-weight: 750; color: var(--color-primary); margin-bottom: 0.35rem;">
            Step 2: Submit Transaction ID / UTR
          </h4>
          <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 1.25rem;">
            Once you complete the payment in your UPI app, copy the 12-digit UPI Reference Number / UTR from your receipt and paste it below.
          </p>

          <form id="payment-verification-form">
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label for="payment-utr-input" class="form-label form-label-required" style="font-weight: 700;">
                Transaction ID / UPI Ref Number / UTR
              </label>
              <input 
                type="text" 
                id="payment-utr-input" 
                class="form-control font-mono" 
                placeholder="e.g. 423189201948 or UPI Ref No." 
                required 
                autocomplete="off"
                style="font-size: 1.05rem; padding: 0.75rem 1rem;"
              />
              <span class="form-hint" style="margin-top: 0.35rem; display:block;">
                Found in payment receipt details in Google Pay, PhonePe, Paytm, BHIM, or your bank app.
              </span>
            </div>

            <div id="payment-submit-error" style="display:none; color: var(--color-danger); font-size: 0.88rem; margin-bottom: 1rem; padding: 0.75rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--border-radius-sm);"></div>

            <button type="submit" id="btn-submit-payment" class="btn btn-primary btn-block btn-lg" style="margin-bottom: 1.25rem;">
              Submit Payment for Verification &rarr;
            </button>

            <!-- Explanation & Disclaimer -->
            <div style="background: var(--bg-subtle); border-radius: var(--border-radius-md); padding: 1rem 1.25rem; font-size: 0.84rem; color: var(--text-muted); line-height: 1.55;">
              <div style="font-weight: 600; color: var(--color-primary); margin-bottom: 0.25rem;">Verification Timeline:</div>
              Your membership will be activated after FidoConnect verifies the transaction reference against our bank records. Verification typically takes a few hours during standard business hours.
              <div style="margin-top: 0.4rem; font-size: 0.78rem;">
                FidoConnect membership provides access to eligible project opportunities. Project availability depends on client demand and verified skill match. Membership does not guarantee specific projects or income.
              </div>
            </div>
          </form>
        </div>

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
