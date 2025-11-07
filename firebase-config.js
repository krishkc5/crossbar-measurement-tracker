// Firebase configuration for crossbar measurement tracker
// This is a public Firebase project configured with open read/write rules for small team collaboration

const firebaseConfig = {
  apiKey: "AIzaSyDQ8X9vZ7xKj2mQYnF8L5wRpT4sU6vH3eM",
  authDomain: "crossbar-tracker.firebaseapp.com",
  databaseURL: "https://crossbar-tracker-default-rtdb.firebaseio.com",
  projectId: "crossbar-tracker",
  storageBucket: "crossbar-tracker.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456ghi789"
};

// Note: These are placeholder credentials. You'll need to:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project named "crossbar-tracker"
// 3. Enable Realtime Database
// 4. Set database rules to allow public read/write (for small team use):
//    {
//      "rules": {
//        ".read": true,
//        ".write": true
//      }
//    }
// 5. Replace the config above with your actual Firebase credentials from Project Settings > General
