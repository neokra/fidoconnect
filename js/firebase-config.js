/**
 * FidoConnect - Firebase Configuration & Storage Service Provider
 * 
 * Provides unified interface for Firebase Authentication & Firestore,
 * with an automatic fallback mock data layer for local preview and instant testing.
 */

// Replace the placeholder values below with your real Firebase Project credentials for production
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "fidoconnect-agency.firebaseapp.com",
  projectId: "fidoconnect-agency",
  storageBucket: "fidoconnect-agency.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

// Check if live Firebase SDK should be initialized
const isLiveFirebaseConfigured = () => {
  return window.FIREBASE_CONFIG && 
         window.FIREBASE_CONFIG.apiKey && 
         !window.FIREBASE_CONFIG.apiKey.startsWith("YOUR_FIREBASE");
};

// --- Mock / LocalStorage Seed Data Engine ---
const STORAGE_KEYS = {
  USERS: "fidoconnect_users",
  PROJECTS: "fidoconnect_projects",
  APPLICATIONS: "fidoconnect_applications",
  MEMBERSHIPS: "fidoconnect_memberships",
  PAYMENTS: "fidoconnect_payments",
  CURRENT_USER: "fidoconnect_current_user"
};

const DEFAULT_SEEDS = {
  users: [
    {
      uid: "user_admin_1",
      email: "admin@fidoconnect.com",
      name: "FidoConnect Operations",
      phone: "+1 555 019 2831",
      role: "admin",
      createdAt: "2026-01-10T10:00:00.000Z"
    },
    {
      uid: "user_client_1",
      email: "sarah@cornerbakery.com",
      name: "Sarah Jenkins",
      businessName: "Corner Bakery & Cafe",
      phone: "+1 555 382 9102",
      role: "client",
      createdAt: "2026-02-01T14:30:00.000Z"
    },
    {
      uid: "user_client_2",
      email: "mike@apexlaw.com",
      name: "Michael Chang",
      businessName: "Apex Legal Partners",
      phone: "+1 555 491 2284",
      role: "client",
      createdAt: "2026-02-10T09:15:00.000Z"
    },
    {
      uid: "user_freelancer_1",
      email: "alex.dev@gmail.com",
      name: "Alex Morgan",
      phone: "+1 555 771 9923",
      role: "freelancer",
      skills: ["Website", "HTML/CSS", "WordPress", "JavaScript"],
      portfolio: "https://alexmorgan.dev",
      membershipStatus: "active",
      membershipPlan: "Standard Member",
      membershipStart: "2026-01-15T00:00:00.000Z",
      membershipExpiry: "2027-01-15T00:00:00.000Z",
      rating: 4.9,
      completedProjectsCount: 5,
      createdAt: "2026-01-15T11:00:00.000Z"
    },
    {
      uid: "user_freelancer_2",
      email: "elena.design@gmail.com",
      name: "Elena Rostova",
      phone: "+1 555 832 1109",
      role: "freelancer",
      skills: ["Design", "Figma", "Branding", "Social Media"],
      portfolio: "https://dribbble.com/elenarostova",
      membershipStatus: "inactive",
      membershipPlan: "None",
      membershipStart: null,
      membershipExpiry: null,
      rating: 4.8,
      completedProjectsCount: 2,
      createdAt: "2026-02-05T16:00:00.000Z"
    }
  ],
  projects: [
    {
      id: "FC-2026-0001",
      projectId: "FC-2026-0001",
      title: "Menu & Catering Page Redesign",
      category: "Website",
      description: "We run a local bakery and need our digital menu and catering inquiry page updated with our new seasonal items and mobile-friendly photo layout. All copy and high-res photography are ready.",
      requirements: "Clean HTML/CSS or WordPress page update, responsive catering inquiry form, fast load times on mobile.",
      budget: "$350 - $450",
      deadline: "2026-09-15",
      clientId: "user_client_1",
      clientName: "Sarah Jenkins",
      clientBusiness: "Corner Bakery & Cafe",
      clientEmail: "sarah@cornerbakery.com",
      clientPhone: "+1 555 382 9102",
      requiredSkills: ["HTML/CSS", "Responsive Design", "WordPress"],
      status: "Published", // Published = open for freelancer applications
      visibility: "public",
      assignedFreelancerId: null,
      agencyNotes: "Reviewed requirements. Client has all assets ready. Budget confirmed.",
      createdAt: "2026-08-15T10:00:00.000Z",
      updatedAt: "2026-08-16T11:30:00.000Z"
    },
    {
      id: "FC-2026-0002",
      projectId: "FC-2026-0002",
      title: "Client Intake Spreadsheets & PDF Formatting",
      category: "Data Entry",
      description: "Need 120 customer intake paper forms digitized into a clean Google Sheet with validated phone/email formatting, and standardized intake PDF templates generated for our front desk.",
      requirements: "High attention to detail, accuracy in data extraction, confidential handling.",
      budget: "$200 - $280",
      deadline: "2026-09-05",
      clientId: "user_client_2",
      clientName: "Michael Chang",
      clientBusiness: "Apex Legal Partners",
      clientEmail: "mike@apexlaw.com",
      clientPhone: "+1 555 491 2284",
      requiredSkills: ["Excel/Google Sheets", "Data Entry", "PDF Formatting"],
      status: "Published",
      visibility: "public",
      assignedFreelancerId: null,
      agencyNotes: "Confidentiality agreement signed. Ready for suitable freelancer.",
      createdAt: "2026-08-18T14:20:00.000Z",
      updatedAt: "2026-08-18T15:00:00.000Z"
    },
    {
      id: "FC-2026-0003",
      projectId: "FC-2026-0003",
      title: "Spring Promotional Flyers & Social Media Graphics",
      category: "Design",
      description: "Design 2 printable A5 flyers and 4 Instagram/Facebook announcement graphics for our annual spring garden sale. Brand colors and vector logo provided.",
      requirements: "Print-ready PDF with bleed + Web export JPG/PNG files.",
      budget: "$250 - $320",
      deadline: "2026-09-10",
      clientId: "user_client_1",
      clientName: "Sarah Jenkins",
      clientBusiness: "Corner Bakery & Cafe",
      clientEmail: "sarah@cornerbakery.com",
      clientPhone: "+1 555 382 9102",
      requiredSkills: ["Figma / Illustrator", "Flyer Design", "Social Graphics"],
      status: "In Progress",
      visibility: "public",
      assignedFreelancerId: "user_freelancer_1",
      agencyNotes: "Alex Morgan assigned on Aug 20. First draft due Aug 28.",
      createdAt: "2026-08-10T09:00:00.000Z",
      updatedAt: "2026-08-20T16:00:00.000Z"
    },
    {
      id: "FC-2026-0004",
      projectId: "FC-2026-0004",
      title: "Employee Handbook Document Cleanup & Table of Contents",
      category: "Documents",
      description: "Convert a rough 35-page Word document into a polished, branded corporate document with automated Table of Contents, consistent headers/footers, and clean typography.",
      requirements: "Microsoft Word & PDF delivery, clean layout standards.",
      budget: "$180 - $220",
      deadline: "2026-09-08",
      clientId: "user_client_2",
      clientName: "Michael Chang",
      clientBusiness: "Apex Legal Partners",
      clientEmail: "mike@apexlaw.com",
      clientPhone: "+1 555 491 2284",
      requiredSkills: ["Microsoft Word", "Document Formatting", "Typographic Styling"],
      status: "Submitted",
      visibility: "admin_only",
      assignedFreelancerId: null,
      agencyNotes: "Received from client. Under initial agency scope review.",
      createdAt: "2026-08-22T08:30:00.000Z",
      updatedAt: "2026-08-22T08:30:00.000Z"
    }
  ],
  applications: [
    {
      id: "APP-001",
      projectId: "FC-2026-0001",
      freelancerId: "user_freelancer_1",
      freelancerName: "Alex Morgan",
      freelancerEmail: "alex.dev@gmail.com",
      skills: ["Website", "HTML/CSS", "WordPress"],
      portfolio: "https://alexmorgan.dev",
      message: "Hi FidoConnect team! I have built several local restaurant menus and catering pages with fast mobile performance. Can complete this within 3 days once assets are shared.",
      deliveryDays: "3 days",
      status: "Reviewed",
      createdAt: "2026-08-17T12:00:00.000Z"
    }
  ]
};

// Initialize LocalStorage Data if not present
function initializeSeedData() {
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_SEEDS.users));
  }
  if (!localStorage.getItem(STORAGE_KEYS.PROJECTS)) {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(DEFAULT_SEEDS.projects));
  }
  if (!localStorage.getItem(STORAGE_KEYS.APPLICATIONS)) {
    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(DEFAULT_SEEDS.applications));
  }
}

// Call seed init
initializeSeedData();

// Export Firebase mode indicator
window.FidoFirebase = {
  isLive: isLiveFirebaseConfigured(),
  storageKeys: STORAGE_KEYS
};
