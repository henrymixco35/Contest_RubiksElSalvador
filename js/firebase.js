/**
 * firebase.js
 */

import { initializeApp }     from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore,
         doc, getDoc, setDoc,
         collection, addDoc, getDocs,
         onSnapshot, query, orderBy,
         updateDoc, deleteDoc,
         serverTimestamp }    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth,
         signInWithEmailAndPassword,
         signOut,
         onAuthStateChanged }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:    "AIzaSyDqMu139URBmWqhnPPLsijs0lDQ7iR9G_o",
  authDomain: "rubik-contest-sv.firebaseapp.com",
  projectId: "rubik-contest-sv",
};

const _app  = initializeApp(firebaseConfig);

window.db   = getFirestore(_app);
window.auth = getAuth(_app);

window.FB = {
  doc, getDoc, setDoc,
  collection, addDoc, getDocs,
  onSnapshot, query, orderBy,
  updateDoc, deleteDoc,
  serverTimestamp,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
};