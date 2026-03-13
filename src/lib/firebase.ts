// import { initializeApp } from 'firebase/app';
// import { getFirestore } from 'firebase/firestore';
// import { getStorage } from 'firebase/storage';
// import { getAuth } from 'firebase/auth';

// // ─────────────────────────────────────────────────────────────────────────────
// // SETUP STEPS:
// // 1. Go to https://console.firebase.google.com
// // 2. Create a new project (e.g. "crunch-fitness-blog")
// // 3. Add a Web App → copy the firebaseConfig values below
// // 4. Enable Authentication → Sign-in method → Email/Password
// // 5. Create a user: Authentication → Users → Add user (your admin email + password)
// // 6. Enable Firestore Database (start in test mode, then set rules below)
// // 7. Enable Storage (start in test mode, then set rules below)
// //
// // Firestore rules (Firestore → Rules):
// //   rules_version = '2';
// //   service cloud.firestore {
// //     match /databases/{database}/documents {
// //       match /posts/{postId} {
// //         allow read: if true;
// //         allow write: if request.auth != null;
// //       }
// //     }
// //   }
// //
// // Storage rules (Storage → Rules):
// //   rules_version = '2';
// //   service firebase.storage {
// //     match /b/{bucket}/o {
// //       match /blogs/{allPaths=**} {
// //         allow read: if true;
// //         allow write: if request.auth != null;
// //       }
// //     }
// //   }
// // ─────────────────────────────────────────────────────────────────────────────

// const firebaseConfig = {
//   apiKey:            "YOUR_API_KEY",
//   authDomain:        "YOUR_AUTH_DOMAIN",
//   projectId:         "YOUR_PROJECT_ID",
//   storageBucket:     "YOUR_STORAGE_BUCKET",
//   messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
//   appId:             "YOUR_APP_ID",
// };

// const app        = initializeApp(firebaseConfig);
// export const db      = getFirestore(app);
// export const storage = getStorage(app);
// export const auth    = getAuth(app);
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyBK99gCuF9YPvYV1w-wzt_STx_9D_slgoM",
  authDomain: "crunch-fitness-blog.firebaseapp.com",
  projectId: "crunch-fitness-blog",
  storageBucket: "crunch-fitness-blog.firebasestorage.app",
  messagingSenderId: "49195456505",
  appId: "1:49195456505:web:865596e9bebe1119424f28",
  measurementId: "G-9PQSYTR6G7"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);