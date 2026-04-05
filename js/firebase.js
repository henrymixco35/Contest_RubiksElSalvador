/**
 * firebase.js
 * ──────────────────────────────────────────────────────
 * Inicializa Firebase y exporta db + auth como globals.
 * Se carga PRIMERO antes que cualquier otro script.
 *
 * ⚠️  NO pongas la apiKey en un repo público si el proyecto
 *     es sensible. Para GitHub Pages está bien porque las
 *     reglas de Firestore son las que protegen los datos.
 */

import { initializeApp }     from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore,
         doc, getDoc, setDoc,
         collection, addDoc, getDocs,
         onSnapshot, query, orderBy,
         serverTimestamp }    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth,
         signInWithEmailAndPassword,
         signOut,
         onAuthStateChanged }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── Configuración ─────────────────────────────────────
const firebaseConfig = {
  apiKey:    "AIzaSyDqMu139URBmWqhnPPLsijs0lDQ7iR9G_o",
  authDomain: "rubik-contest-sv.firebaseapp.com",
  projectId: "rubik-contest-sv",
};

const _app  = initializeApp(firebaseConfig);

// Exponer como globales para que el resto de scripts (non-module) los usen
window.db   = getFirestore(_app);
window.auth = getAuth(_app);

// Re-exportar helpers de Firestore como globales también
window.FB = {
  doc, getDoc, setDoc,
  collection, addDoc, getDocs,
  onSnapshot, query, orderBy,
  serverTimestamp,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
};
