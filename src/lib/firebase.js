import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase only if config is valid
let auth = null;
let googleProvider = null;

if (firebaseConfig.apiKey) {
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        googleProvider = new GoogleAuthProvider();
        googleProvider.setCustomParameters({ prompt: 'select_account' });
    } catch (err) {
        console.error("Firebase initialization failed:", err);
    }
} else {
    console.warn("Firebase API key is missing. Google Sign-In will not be available.");
}

export { auth, googleProvider };
