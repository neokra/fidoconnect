/**
 * FidoConnect - Payment Checkout Controller
 * 
 * Manages manual UPI checkout, dynamic plan pricing, QR code rendering,
 * UPI intent launch, duplicate UTR validation, and submission for admin verification.
 */

import { FidoAuth } from "./auth.js";
import { FidoDB, DEFAULT_UPI_CONFIG } from "./db.js";
import { showToast, formatDate } from "./ui.js";

let currentUser = null;
let currentPlan = null;
let returnProject = null;
let upiConfig = DEFAULT_UPI_CONFIG;

document.addEventListener("DOMContentLoaded", () => {
  // Preloader removal
  const preloader = document.getElementById("page-preloader");
  if (preloader) {
    window.addEventListener("load", () => {
      preloader.style.opacity = "0";
      setTimeout(() => preloader.remove(), 300);
    });
  }

  // Auth observer
  FidoAuth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (!currentUser) {
      const currentUrl = window.location.pathname + window.location.search;
      window.location.href = `auth.html?redirect=${encodeURIComponent(currentUrl)}`;
      return;
    }

    try {
      upiConfig = await FidoDB.getUPIConfig();
    } catch (e) {
      upiConfig = DEFAULT_UPI_CONFIG;
    }

    initPaymentPage();
  });
});

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    planKey: (params.get("plan") || "basic").toLowerCase(),
    returnProject: params.get("return_project") || null,
    retry: params.get("retry") === "true"
  };
}

async function initPaymentPage() {
  const container = document.getElementById("payment-checkout-container");
  if (!container) return;

  const { planKey, returnProject: retProj, retry } = getQueryParams();
  returnProject = retProj;

  // Validate and load plan dynamically from Firestore (Single source of truth)
  currentPlan = await FidoDB.getMembershipPlanById(planKey);

  if (!currentPlan) {
    container.innerHTML = `
      <div class="card text-center" style="padding: 3rem 2rem; max-width: 600px; margin: 0 auto;">
        <div style="font-size: 2.5rem; margin-bottom: 1rem;">⚠️</div>
        <h2 style="font-size: 1.5rem; font-weight: 750; color: var(--color-primary); margin-bottom: 0.5rem;">Plan Not Found</h2>
        <p class="text-muted" style="margin-bottom: 1.5rem;">The selected membership plan does not exist or has been disabled.</p>
        <a href="account.html?tab=membership" class="btn btn-primary">View Available Membership Plans &rarr;</a>
      </div>
    `;
    return;
  }

  // Update back link if returning to a project
  const backLink = document.getElementById("payment-back-link");
  if (backLink) {
    if (returnProject) {
      backLink.href = `account.html?tab=membership&return_project=${encodeURIComponent(returnProject)}`;
      backLink.innerHTML = `&larr; Back to Membership Plans (Project ${returnProject})`;
    } else {
      backLink.href = "account.html?tab=membership";
      backLink.innerHTML = `&larr; Back to Membership Plans`;
    }
  }

  // 1. Check if user already has an active pending payment
  if (!retry) {
    const pendingPayment = await FidoDB.getUserPendingMembershipPayment(currentUser.uid);
    if (pendingPayment) {
      renderPendingState(container, pendingPayment);
      return;
    }
  }

  // 2. Check if user is already an active member on the SAME plan
  const isMemberActive = currentUser.membershipStatus === "active";
  if (isMemberActive && currentUser.membershipPlan === currentPlan.name && !retry) {
    renderAlreadyActiveState(container);
    return;
  }

  // 3. Check for recently rejected payment
  if (!retry) {
    const latestPayment = await FidoDB.getUserLatestMembershipPayment(currentUser.uid);
    if (latestPayment && latestPayment.status === "rejected") {
      renderRejectedState(container, latestPayment);
      return;
    }
  }

  // 4. Render Checkout Form
  renderCheckoutForm(container);
}

function renderCheckoutForm(container) {
  const planPrice = Number(currentPlan.price !== undefined ? currentPlan.price : currentPlan.priceAmount) || 0;
  const planPriceDisplay = currentPlan.priceDisplay || `₹${planPrice.toLocaleString("en-IN")}`;
  const planDuration = currentPlan.duration || `${currentPlan.durationDays || 30} Days`;
  const planQrAsset = currentPlan.qrImageUrl || upiConfig.qrAsset || "images/fido-upi-qr.svg";
  const planUpiId = currentPlan.upiId || upiConfig.upiId || "fidoconnect@okaxis";
  const planMerchantName = currentPlan.merchantName || upiConfig.merchantName || "FidoConnect";

  // UPI Intent URI format: upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...
  const intentNote = `FidoConnect ${currentPlan.name} Membership`;
  const upiIntentUri = `upi://pay?pa=${encodeURIComponent(planUpiId)}&pn=${encodeURIComponent(planMerchantName)}&am=${planPrice}&cu=INR&tn=${encodeURIComponent(intentNote)}`;

  container.innerHTML = `
    <!-- Header -->
    <div style="margin-bottom: 2rem;">
      <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--color-accent);"></span>
        <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.06em; font-weight:700; color:var(--color-accent);">Manual UPI Checkout (India)</span>
      </div>
      <h1 style="font-size: 2rem; font-weight: 750; margin-bottom: 0.5rem; color: var(--color-primary); letter-spacing: -0.02em;">Complete Membership Payment</h1>
      <p class="text-muted" style="font-size: 1rem; margin: 0; line-height: 1.5;">
        Activate your <strong>${currentPlan.name}</strong> access via UPI. Verification is processed manually by FidoConnect within business hours.
      </p>
    </div>

    ${returnProject ? `
      <div class="card" style="background: var(--color-accent-soft); border: 1px solid var(--color-accent-border); padding: 1.25rem 1.5rem; margin-bottom: 1.75rem; border-radius: var(--border-radius-md);">
        <div style="display:flex; align-items:flex-start; gap:0.75rem;">
          <svg width="22" height="22" fill="none" stroke="var(--color-accent)" viewBox="0 0 24 24" style="flex-shrink:0; margin-top:2px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <div style="font-size: 0.92rem; color: var(--color-primary); line-height: 1.5;">
            <strong>Application Pending for Project ${returnProject}:</strong> Completing this membership payment will enable final submission of your prepared proposal once verified.
          </div>
        </div>
      </div>
    ` : ''}

    <div style="display: grid; grid-template-columns: 1fr; gap: 1.75rem;">
      
      <!-- 1. Selected Plan Details Card -->
      <div class="card" style="padding: 1.75rem; border-radius: var(--border-radius-lg); border: 1px solid var(--border-color);">
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

        <div style="border-top: 1px solid var(--border-color); padding-top: 1rem; display:flex; justify-content:space-between; align-items:center; font-size:0.88rem; flex-wrap:wrap; gap:0.5rem;">
          <span class="text-muted">Freelancer Account: <strong style="color:var(--color-primary);">${currentUser.name || currentUser.email}</strong></span>
          <a href="account.html?tab=membership" style="color:var(--color-accent); font-weight:600; text-decoration:none;">Change Plan &rarr;</a>
        </div>
      </div>

      <!-- 2. Pay using UPI Section Card -->
      <div class="card" style="padding: 2rem; border-radius: var(--border-radius-lg); border: 1px solid var(--border-color);">
        <h3 style="font-size: 1.3rem; font-weight: 750; color: var(--color-primary); margin-bottom: 0.4rem;">
          Pay using UPI
        </h3>
        <p class="text-muted" style="font-size: 0.92rem; margin-bottom: 1.75rem;">
          Scan the QR code using any UPI app (Google Pay, PhonePe, Paytm, BHIM) and complete the exact payment of <strong>${planPriceDisplay}</strong>.
        </p>

        <!-- Centered QR Container -->
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 2rem;">
          
          <!-- QR Card -->
          <div style="background: #ffffff; padding: 1.25rem; border-radius: var(--border-radius-lg); border: 2px solid var(--border-color); box-shadow: var(--shadow-md); max-width: 280px; width: 100%; text-align: center;">
            <img src="${planQrAsset}" alt="FidoConnect UPI QR Code" style="width: 100%; height: auto; display: block; border-radius: 8px; margin-bottom: 0.75rem;" onerror="this.src='images/fido-upi-qr.svg'" />
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--color-primary);">Scan to Pay ${planPriceDisplay}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Recipient: ${planMerchantName}</div>
          </div>

          <!-- UPI ID Copy Box -->
          <div style="margin-top: 1.25rem; background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); padding: 0.75rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; max-width: 380px; width: 100%;">
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

        </div>

        <!-- 3. Payment Confirmation Section -->
        <div style="border-top: 2px dashed var(--border-color); padding-top: 2rem;">
          <h4 style="font-size: 1.15rem; font-weight: 750; color: var(--color-primary); margin-bottom: 0.35rem;">
            Payment completed?
          </h4>
          <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 1.25rem;">
            Enter the 12-digit UPI Reference Number / UTR from your payment confirmation screen to submit for verification.
          </p>

          <form id="payment-verification-form">
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label for="payment-utr-input" class="form-label form-label-required" style="font-weight: 700;">
                Transaction ID / UTR
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
                Found under payment details in your UPI app receipt (Google Pay, PhonePe, Paytm, BHIM, Bank App).
              </span>
            </div>

            <div id="payment-submit-error" style="display:none; color: var(--color-danger); font-size: 0.88rem; margin-bottom: 1rem; padding: 0.75rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--border-radius-sm);"></div>

            <button type="submit" id="btn-submit-payment" class="btn btn-primary btn-block btn-lg" style="margin-bottom: 1.25rem;">
              Submit Payment for Verification &rarr;
            </button>

            <!-- Explanation & Disclaimer -->
            <div style="background: var(--bg-subtle); border-radius: var(--border-radius-md); padding: 1rem 1.25rem; font-size: 0.84rem; color: var(--text-muted); line-height: 1.55;">
              <div style="font-weight: 600; color: var(--color-primary); margin-bottom: 0.25rem;">Important Note:</div>
              Your membership will be activated after FidoConnect verifies your payment receipt against our bank records. Verification typically takes a few hours during standard business hours.
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
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting for verification...";

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
        <span class="badge" style="background:#fef3c7; color:#92400e; font-size:0.85rem; padding: 0.35rem 0.85rem;">
          🟡 Verification Pending
        </span>
      </div>

      <h2 style="font-size: 1.65rem; font-weight: 750; color: var(--color-primary); margin-bottom: 0.5rem;">
        Payment Submitted
      </h2>
      <p class="text-muted" style="font-size: 0.95rem; margin-bottom: 2rem; line-height: 1.5;">
        Your payment details have been submitted for manual verification. Our team will verify the transaction against our account records.
      </p>

      <!-- Details Summary Box -->
      <div style="background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); padding: 1.5rem; text-align: left; margin-bottom: 2rem;">
        
        <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem; font-size:0.9rem; padding-bottom:0.75rem; border-bottom:1px solid var(--border-color);">
          <span class="text-muted">Selected Plan</span>
          <strong style="color:var(--color-primary);">${payment.planName || currentPlan.name}</strong>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem; font-size:0.9rem; padding-bottom:0.75rem; border-bottom:1px solid var(--border-color);">
          <span class="text-muted">Amount</span>
          <strong style="color:var(--color-accent); font-size:1.05rem;">₹${payment.amount || currentPlan.priceAmount}</strong>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem; font-size:0.9rem; padding-bottom:0.75rem; border-bottom:1px solid var(--border-color);">
          <span class="text-muted">Transaction ID / UTR</span>
          <strong class="font-mono" style="color:var(--color-primary);">${payment.transactionId}</strong>
        </div>

        <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
          <span class="text-muted">Submitted Date</span>
          <span style="color:var(--color-primary);">${formatDate(payment.submittedAt || payment.createdAt)}</span>
        </div>

      </div>

      <!-- Trust Note -->
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--border-radius-md); padding: 1rem 1.25rem; font-size: 0.88rem; color: #1e40af; margin-bottom: 2rem; line-height: 1.5;">
        <strong>Your membership will be activated after payment verification.</strong><br/>
        Once verified by an administrator, your Selected Freelancer privileges will be enabled immediately.
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
        ${currentUser.membershipPlan || "Selected Basic"} is Active
      </h2>
      <p class="text-muted" style="font-size: 0.95rem; margin-bottom: 2rem; line-height: 1.5;">
        Your membership is already active until <strong>${formatDate(currentUser.membershipExpiry)}</strong>. You have full access to apply for eligible project opportunities.
      </p>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <a href="find-work.html" class="btn btn-primary btn-lg">Find & Apply for Work &rarr;</a>
        <a href="account.html" class="btn btn-secondary">Go to Account Dashboard</a>
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
        Your previous payment submission (Txn ID: <strong>${payment.transactionId}</strong>) could not be verified.
      </p>

      ${payment.adminNote ? `
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--border-radius-md); padding: 1rem; font-size: 0.88rem; color: #991b1b; margin-bottom: 1.75rem; text-align: left;">
          <strong>Admin Note:</strong> ${payment.adminNote}
        </div>
      ` : ''}

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <a href="payment.html?plan=${currentPlan.id}&retry=true${returnProject ? '&return_project=' + encodeURIComponent(returnProject) : ''}" class="btn btn-primary btn-lg">
          Start New Payment Attempt &rarr;
        </a>
        <a href="account.html" class="btn btn-secondary">
          Return to Account
        </a>
      </div>
    </div>
  `;
}

window.copyUpiId = function() {
  const upiId = (currentPlan && currentPlan.upiId) || upiConfig.upiId;
  navigator.clipboard.writeText(upiId).then(() => {
    const btn = document.getElementById("btn-copy-upi");
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
  }).catch(() => {
    showToast("Could not copy UPI ID automatically.", "error");
  });
};
