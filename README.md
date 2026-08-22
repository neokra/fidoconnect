# FidoConnect — Digital Agency Platform

**Trusted work. Simply connected.**

FidoConnect is a modern digital agency platform that connects local businesses with reliable freelancers and specialists for small projects. FidoConnect coordinates project requirements, manages communications, oversees deliverables, and ensures quality handover.

---

## 🌟 Key Features

1. **Clean Agency Branding & Positioning**: Designed specifically as a professional project coordination service rather than an open freelance marketplace or bidding platform.
2. **Fully Responsive Layout**:
   - **Desktop**: Top navigation with logo, direct links, dynamic account state, and CTA button.
   - **Mobile**: Fixed bottom navigation bar (`Home`, `Find Work`, `Post`, `Account`) designed for smartphones with safe-area spacing.
3. **Unified Single-Page Authentication (`auth.html`)**:
   - **Methods**: Google Sign-In (`signInWithPopup`) and Email/Password.
   - **Roles**: Client or Freelancer (Admin is never shown as a registration option).
   - **Password Reset**: Direct Firebase reset links.
   - **Zero Storage Hacks**: Uses real Firebase Authentication sessions exclusively without `localStorage` or `sessionStorage`.
4. **Automatic Admin Detection**:
   - Authenticated user with email `thecard.primary@gmail.com` is automatically recognized as the FidoConnect Administrator.
   - Shows the **Admin Panel** card inside `account.html` and grants access to `admin.html`.
5. **Comprehensive 11-Module Admin Dashboard (`admin.html`)**:
   - Overview KPIs, Projects Pipeline, Freelancer Proposals, User Directory, Freelancer Network, Client Directory, Memberships, Payments, Reviews, Messages, Settings.
6. **Client Privacy Protection**: Sensitive client contact details (email, phone, private address) are never displayed on public or freelancer project cards.
7. **Production Firebase Backend**: Connected directly to the Firebase `fidoconnect` project for Authentication and Cloud Firestore.

---

## 📁 Streamlined Project Architecture

```
firebase-config.js
      ↓
   auth.js
      ↓
auth.html / account.html / admin.html / other pages
```

```
d:/fidoconnect/
├── index.html                  # Homepage (Hero, Services, How it Works, Trust CTA)
├── post-work.html              # Post a Work form with confirmation view & sequential IDs
├── find-work.html              # Public/Member project browsing with membership gate
├── project-details.html        # Detailed project view & freelancer proposal modal
├── account.html                # Dynamic Client / Freelancer / Admin portal
├── auth.html                   # Unified Sign In, Registration, Google Auth & Reset
├── admin.html                  # 11-Module Admin Dashboard (Exclusive to thecard.primary@gmail.com)
├── css/
│   ├── style.css               # Main design system, typography, responsive rules, mobile bottom nav
│   └── admin.css               # Admin layout, tables, metric cards
├── js/
│   ├── firebase-config.js      # Central Firebase Web SDK v10 initialization
│   ├── auth.js                 # Unified Firebase Auth service (Google + Email/Password)
│   ├── db.js                   # Firestore database service layer (CRUD)
│   ├── ui.js                   # Toast alerts, modals, status badges, formatters
│   ├── home.js                 # Homepage category filtering & stats
│   ├── post-work.js            # Client project submission controller
│   ├── find-work.js            # Find work search, filters, and membership banner
│   ├── project-details.js      # Single project view & proposal submission
│   ├── account.js              # Freelancer/Client profile & membership manager
│   └── admin.js                # 11-Module Admin Dashboard controller
├── firestore.rules             # Comprehensive Firebase Security Rules
├── netlify.toml                # Netlify deployment and security headers
└── README.md                   # Documentation and setup guide
```

---

## 🚀 Running the Website

You can open `index.html` in any web browser or launch a local HTTP server:

```powershell
python -m http.server 8080
```

Then visit `http://localhost:8080`.

---

## 🔒 Firebase Configuration

The platform is configured with Firebase Authentication and Cloud Firestore in `js/firebase-config.js`:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyB30w_VAz5L1JCAS3gpgqigghk4Z2R3-MA",
  authDomain: "fidoconnect.firebaseapp.com",
  projectId: "fidoconnect",
  storageBucket: "fidoconnect.firebasestorage.app",
  messagingSenderId: "1055200422697",
  appId: "1:1055200422697:web:facdf29084c93427612538"
};
```

---

## 📜 Agency Workflow Stages

1. **Submitted**: Client submits project request.
2. **Under Review**: Agency team reviews scope, feasibility, and budget.
3. **Approved / Published**: Admin publishes the project to **Find Work**.
4. **Proposals**: Active network members submit proposals.
5. **Freelancer Selected**: Admin selects and assigns the most suitable specialist.
6. **In Progress**: Work is in progress under agency coordination.
7. **Completed**: Agency reviews deliverables and hands over to client.
