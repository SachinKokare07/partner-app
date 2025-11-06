import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin SDK
export const initializeFirebase = () => {
  try {
    // Check if already initialized
    if (admin.apps.length > 0) {
      return admin.app();
    }

    // Check if Firebase credentials are properly configured
    if (!process.env.FIREBASE_PROJECT_ID || 
        !process.env.FIREBASE_CLIENT_EMAIL || 
        !process.env.FIREBASE_PRIVATE_KEY ||
        process.env.FIREBASE_PRIVATE_KEY.includes('YOUR_PRIVATE_KEY_HERE')) {
      console.warn('⚠️  Firebase Admin credentials not configured - Some features may be limited');
      console.warn('⚠️  Email sending will still work!');
      return null;
    }

    // Decode private key if it's Base64 encoded
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    // Check if it's Base64 encoded (doesn't start with -----)
    if (privateKey && !privateKey.startsWith('-----BEGIN')) {
      try {
        privateKey = Buffer.from(privateKey, 'base64').toString('utf-8');
        console.log('✅ Decoded Base64 Firebase private key');
      } catch (err) {
        console.warn('⚠️  Failed to decode Base64 key, using as-is');
      }
    }
    
    // Replace escaped newlines with actual newlines
    privateKey = privateKey?.replace(/\\n/g, '\n');
    
    // Initialize with credentials from environment variables
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
    });

    console.log('✅ Firebase Admin initialized successfully');
    return admin.app();
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error.message);
    console.warn('⚠️  Continuing without Firebase Admin - Email sending will still work!');
    return null;
  }
};

// Initialize Firebase
initializeFirebase();

// Export Firestore and Auth instances (may be null if not initialized)
export const db = admin.apps.length > 0 ? admin.firestore() : null;
export const auth = admin.apps.length > 0 ? admin.auth() : null;
export default admin;
