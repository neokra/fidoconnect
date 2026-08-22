/**
 * FidoConnect - Central Firebase Web SDK Initialization
 * 
 * Initializes Firebase App, Firebase Authentication, and Cloud Firestore
 * using the Firebase Modular Web SDK v10.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  runTransaction 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase configuration for FidoConnect
const firebaseConfig = {
  apiKey: "AIzaSyB30w_VAz5L1JCAS3gpgqigghk4Z2R3-MA",
  authDomain: "fidoconnect.firebaseapp.com",
  projectId: "fidoconnect",
  storageBucket: "fidoconnect.firebasestorage.app",
  messagingSenderId: "1055200422697",
  appId: "1:1055200422697:web:facdf29084c93427612538"
};

// Initialize Firebase exactly once
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Expose on window for unified access across FidoConnect
window.FidoFirebase = {
  app,
  auth,
  db,
  firestore: {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    addDoc,
    serverTimestamp,
    runTransaction
  },
  authMethods: {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    onAuthStateChanged
  }
};

// Signal that Firebase SDK is initialized
window.dispatchEvent(new CustomEvent("firebase-initialized", { detail: { app, auth, db } }));

export { app, auth, db };
