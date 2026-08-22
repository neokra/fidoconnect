# FidoConnect — Digital Agency Platform

**Trusted work. Simply connected.**

FidoConnect is a modern digital agency platform that connects local businesses with reliable freelancers and specialists for small projects. FidoConnect coordinates project requirements, manages communications, oversees deliverables, and ensures quality handover.

---

## 🌟 Key Features

1. **Clean Agency Branding & Positioning**: Designed specifically as a professional project coordination service rather than an open freelance marketplace or bidding platform.
2. **Fully Responsive Layout**:
   - **Desktop**: Top navigation with logo, direct links, dynamic account state, and CTA button.
   - **Mobile**: Fixed bottom navigation bar (`Home`, `Find Work`, `Post`, `Account`) designed for smartphones with safe-area spacing.
3. **Role-Based Workflows**:
   - **Client**: Submit work requests with auto-generated Project IDs (`FC-2026-XXXX`), view live agency updates, and manage project statuses.
   - **Freelancer**: Browse published projects, membership status checks, submit single proposals per project, and manage portfolio & skills.
   - **Admin**: Full agency control dashboard (overview KPIs, approve/reject/publish projects, review proposals, assign freelancers, manage memberships, and view client directories).
4. **Client Privacy Protection**: Sensitive client contact details (email, phone, private address) are never displayed on public or freelancer project cards.
5. **Membership Gate**: Realistic agency membership terminology (*"Membership gives you access to FidoConnect project opportunities. Projects are not guaranteed."*).
6. **Dual Mode (Instant Local Preview + Live Firebase SDK)**:
   - Works immediately out of the box with pre-seeded sample projects and instant role switcher toolbar.
   - Production-ready for Firebase Auth, Firestore, and Netlify deployment.

---

## 📁 Project Structure

```
d:/fidoconnect/
├── index.html                  # Homepage (Hero, Services, How it Works, Trust CTA)
├── post-work.html              # Post a Work form with confirmation view & sequential IDs
├── find-work.html              # Public/Member project browsing with membership gate
├── project-details.html        # Detailed project view & freelancer proposal modal
├── account.html                # Dynamic Client / Freelancer / Admin portal
├── auth.html                   # Sign In, Role Registration (Client / Freelancer), Reset Password
├── admin.html                  # Admin Dashboard (KPIs, Project Pipeline, Applications, Members)
├── css/
│   ├── style.css               # Main design system, typography, responsive rules, mobile bottom nav
│   └── admin.css               # Admin layout, tables, metric cards
├── js/
│   ├── firebase-config.js      # Firebase SDK config + fallback data seed engine
│   ├── auth.js                 # Authentication, role session management, nav sync
│   ├── db.js                   # Firestore data service layer (CRUD)
│   ├── ui.js                   # Toast alerts, modals, status badges, formatters, preview toolbar
│   ├── home.js                 # Homepage category filtering & stats
│   ├── post-work.js            # Client project submission controller
│   ├── find-work.js            # Find work search, filters, and membership banner
│   ├── project-details.js      # Single project view & proposal submission
│   ├── account.js              # Freelancer/Client profile & membership manager
│   ├── auth-page.js            # Auth page tabs, role card selector, and form submit
│   └── admin.js                # Admin approval pipeline, assignment, and membership toggles
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

## 🔒 Firebase Configuration (For Production)

To connect live Firebase:

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Email/Password** under **Authentication > Sign-in method**.
3. Enable **Cloud Firestore** in production mode.
4. Deploy the security rules from `firestore.rules` using the Firebase CLI:
   ```bash
   firebase deploy --only firestore:rules
   ```
5. In `js/firebase-config.js`, update the `window.FIREBASE_CONFIG` object with your Firebase app keys:
   ```javascript
   window.FIREBASE_CONFIG = {
     apiKey: "YOUR_ACTUAL_API_KEY",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

---

## 🌐 Netlify Deployment

This repository is ready for zero-configuration Netlify deployment:

1. Drag and drop the `fidoconnect` folder into the [Netlify Dashboard](https://app.netlify.com/drop), OR
2. Link your Git repository in Netlify with:
   - **Publish directory**: `.` (root directory)
   - The included `netlify.toml` file will configure all security headers and cache policies automatically.

---

## 📜 Agency Workflow Stages

1. **Submitted**: Client submits project request.
2. **Under Review**: Agency team reviews scope, feasibility, and budget.
3. **Approved / Published**: Admin publishes the project to **Find Work**.
4. **Proposals**: Active network members submit proposals.
5. **Freelancer Selected**: Admin selects and assigns the most suitable specialist.
6. **In Progress**: Work is in progress under agency coordination.
7. **Completed**: Agency reviews deliverables and hands over to client.
