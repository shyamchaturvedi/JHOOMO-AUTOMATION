import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyANThDrjMQpbrIMTnYsb0BS3VPo0PYutRo',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'milo-da65c.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'milo-da65c',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'milo-da65c.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '367531407467',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:367531407467:web:80c84c1f24d776856da234',
};

export const firebaseApp = initializeApp(config);
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(firebaseApp);
