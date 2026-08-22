/**
 * FidoConnect - Central Firebase Web SDK Initialization
 * 
 * Initializes Firebase App, Firebase Authentication (with Google Sign-In),
 * and Cloud Firestore using the Firebase Modular Web SDK v10.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB30w_VAz5L1JCAS3gpgqigghk4Z2R3-MA",
  authDomain: "fidoconnect.firebaseapp.com",
  projectId: "fidoconnect",
  storageBucket: "fidoconnect.firebasestorage.app",
  messagingSenderId: "1055200422697",
  appId: "1:1055200422697:web:facdf29084c93427612538"
};

// Initialize Firebase App, Auth, Firestore, and Google Provider
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Expose on window for convenience
window.FidoFirebase = { app, auth, db, googleProvider };
