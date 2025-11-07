# Firebase Setup Instructions

This application uses Firebase Realtime Database for real-time synchronization across users. Follow these steps to complete the setup:

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter project name: `crossbar-tracker` (or any name you prefer)
4. You can disable Google Analytics (not needed for this project)
5. Click "Create project"

## Step 2: Enable Realtime Database

1. In your Firebase project, click on "Realtime Database" in the left sidebar
2. Click "Create Database"
3. Choose a location closest to you (e.g., `us-central1`)
4. Start in **test mode** for now (we'll set proper rules next)
5. Click "Enable"

## Step 3: Configure Database Rules

For a small team (you and your advisor), set public read/write access:

1. In the Realtime Database section, click on the "Rules" tab
2. Replace the existing rules with:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

3. Click "Publish"

**Note:** These rules allow anyone with the URL to read/write. For a small research team, this is acceptable. For larger deployments, implement proper authentication.

## Step 4: Get Your Firebase Configuration

1. Click on the gear icon next to "Project Overview" in the sidebar
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click on the web icon `</>` to add a web app
5. Register app with nickname: `crossbar-tracker-web`
6. You'll see a configuration object like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456ghi789"
};
```

7. Copy this configuration

## Step 5: Update firebase-config.js

1. Open `firebase-config.js` in your project
2. Replace the placeholder `firebaseConfig` object with your actual configuration
3. Save the file

## Step 6: Deploy to GitHub Pages

Once you've updated the configuration:

```bash
git add .
git commit -m "Configure Firebase backend for real-time sync"
git push origin main
```

The changes will automatically deploy to GitHub Pages.

## Step 7: Share with Your Advisor

Simply share the URL with your advisor:
```
https://krishkc5.github.io/crossbar-measurement-tracker/
```

Both of you will see changes in real-time!

## Troubleshooting

### "Firebase not loaded" error
- Check that you have internet connection
- Verify Firebase SDK URLs in index.html are accessible
- Check browser console for specific errors

### Changes not syncing
- Verify database rules are set to allow read/write
- Check connection status indicator in the app
- Ensure both users are online
- Check Firebase Console > Realtime Database > Data to see if entries are being saved

### Security Considerations

For production use with sensitive data, consider:
- Implementing Firebase Authentication
- Restricting database rules to authenticated users only
- Adding user-specific data access controls

Example secure rules:
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

## Alternative: Keep It Simple

If you prefer to avoid setting up Firebase, you can:
1. Use the Export/Import JSON feature for sharing data
2. Keep entries in localStorage (single-user mode)
3. Use a different backend service like Supabase (similar setup)
