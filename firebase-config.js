// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCnBJTK5KOuauyeS76nbJtn9kNKMe2ArMg",
  authDomain: "crossbar-tracker.firebaseapp.com",
  databaseURL: "https://crossbar-tracker-default-rtdb.firebaseio.com",
  projectId: "crossbar-tracker",
  storageBucket: "crossbar-tracker.firebasestorage.app",
  messagingSenderId: "959133316967",
  appId: "1:959133316967:web:dffa64c39de004dd29a1c2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);