import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase/config"; // single import for both auth and db
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  sendEmailVerification,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  query,
  collection,
  where,
  getDocs,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [partner, setPartner] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false); // Track OTP verification state
  const isVerifyingRef = useRef(false); // Use ref to avoid dependency issues

  // 🔥 Firebase Auth State Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        // Don't clear state if user is in verification process
        if (!isVerifyingRef.current) {
          setUser(null);
          setPartner(null);
        }
        setLoading(false);
        return;
      }
      
      const ref = doc(db, "users", currentUser.uid);
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const userData = { id: currentUser.uid, ...snap.data() };
          
          // Check and update login streak
          await checkAndUpdateLoginStreak(currentUser.uid, userData);
          
          setUser(userData);
          
          // Load partner data if partner exists
          if (userData.partner) {
            await loadPartnerData(userData.partner);
          }
          
          // Load pending requests
          if (userData.pendingRequests && userData.pendingRequests.length > 0) {
            await loadPendingRequests(userData.pendingRequests);
          }
          
          setLoading(false);
          return;
        }
        
        // If profile doesn't exist, check if we're in registration flow
        if (!isVerifyingRef.current) {
          // Not registering - this is an error, sign out
          console.error('User profile not found in Firestore. Signing out...');
          await signOut(auth);
          setUser(null);
        }
        setLoading(false);
        return;
      } catch (err) {
        // Handle offline/cache scenario gracefully
        if (err?.code === 'unavailable' || /offline/i.test(err?.message || '')) {
          // Fallback: Try to get cached data, but if none exists, sign out
          console.error('Firestore offline and no cached profile. Signing out...');
          await signOut(auth);
          setUser(null);
        } else {
          console.error('Failed to fetch user profile:', err);
          // Sign out on any other error to prevent "Anonymous" state
          await signOut(auth);
          setUser(null);
        }
        setLoading(false);
      }
    });
    return () => unsub();
  }, []); // Empty dependency array - listener only needs to be set up once

  // Check and update login streak
  const checkAndUpdateLoginStreak = async (userId, userData) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      const lastLogin = userData.lastLoginDate;
      const lastLoginStr = lastLogin ? new Date(lastLogin).toISOString().split('T')[0] : null;

      // If already logged in today, do nothing
      if (lastLoginStr === todayStr) {
        console.log('Already logged in today');
        return;
      }

      const userRef = doc(db, "users", userId);

      // Calculate new streak
      let newStreak = userData.streak || 0;
      
      if (lastLoginStr) {
        const lastDate = new Date(lastLoginStr);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (lastLoginStr === yesterdayStr) {
          // Consecutive day - increment streak
          newStreak += 1;
        } else {
          // Streak broken - reset to 1
          newStreak = 1;
        }
      } else {
        // First login ever
        newStreak = 1;
      }

      // Update last login date and streak
      await updateDoc(userRef, {
        lastLoginDate: today.toISOString(),
        streak: newStreak
      });

      // Update local state
      setUser(prev => ({
        ...prev,
        lastLoginDate: today.toISOString(),
        streak: newStreak
      }));

    } catch (err) {
      console.error('Error updating login streak:', err);
    }
  };

  // Load partner data
  const loadPartnerData = async (partnerId) => {
    try {
      const partnerRef = doc(db, "users", partnerId);
      const partnerSnap = await getDoc(partnerRef);
      if (partnerSnap.exists()) {
        const partnerData = { id: partnerSnap.id, ...partnerSnap.data() };
        setPartner(partnerData);
      }
    } catch (err) {
      console.error('Error loading partner:', err);
    }
  };

  // Load pending requests with user info
  const loadPendingRequests = async (requestIds) => {
    try {
      const requestsData = await Promise.all(
        requestIds.map(async (userId) => {
          const userRef = doc(db, "users", userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            return {
              from: userId,
              fromName: userData.name,
              fromEmail: userData.email
            };
          }
          return null;
        })
      );
      setRequests(requestsData.filter(req => req !== null));
    } catch (err) {
      console.error('Error loading requests:', err);
    }
  };

  const login = async (email, password) => {
    try {
      console.log('🔐 Attempting login for:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Firebase Auth successful');
      
      // Check if email is verified in Firestore
      const userRef = doc(db, 'users', userCredential.user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        console.error('❌ User profile not found in Firestore');
        await signOut(auth);
        return { 
          success: false, 
          message: 'Account profile not found. Please contact support or register again.'
        };
      }
      
      const userData = userSnap.data();
      console.log('📄 User profile loaded:', userData);
      
      if (!userData.emailVerified) {
        console.error('❌ Email not verified');
        // Sign out the user and show error
        await signOut(auth);
        return { 
          success: false, 
          message: 'Please verify your email with OTP before logging in.',
          needsVerification: true
        };
      }
      
      console.log('✅ Login successful!');
      return { success: true };
    } catch (err) {
      console.error("Login error:", err);
      // Map common Firebase auth errors
      let message = 'Login failed';
      if (err?.code === 'auth/user-not-found') {
        message = 'No account found with this email. Please register first.';
      } else if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        message = 'Invalid email or password. Please check and try again.';
      } else if (err?.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later.';
      } else if (err?.code === 'auth/invalid-email') {
        message = 'Invalid email format.';
      } else if (err?.code === 'auth/network-request-failed') {
        message = 'Network error. Check your internet connection.';
      }
      return { success: false, message };
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setPartner(null);
    setRequests([]);
  };

  // Email/Password Registration (No billing required)
  const register = async (profile) => {
    const { name, email, mobile, password, startDate } = profile || {};
    if (!email || !password || !name) {
      return { success: false, message: "Name, email and password are required" };
    }
    try {
      // Set verification flag FIRST to prevent auth listener from interfering
      setIsVerifying(true);
      isVerifyingRef.current = true;
      console.log('🚩 Verification flag set to TRUE');
      
      // Create user in Firebase Auth first
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      console.log('Generated OTP:', otp); // For testing - remove in production
      
      // Store OTP in Firestore with expiry (10 minutes)
      const otpRef = doc(db, 'otpCodes', uid);
      await setDoc(otpRef, {
        code: otp,
        email: email,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        verified: false
      });
      
      // 📧 Send OTP to email via backend API
      let emailSent = false;
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
        console.log('📧 Sending OTP to backend:', backendUrl);
        console.log('📧 Request payload:', { email, otp, name });
        
        const response = await fetch(`${backendUrl}/api/otp/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
            otp: otp,
            name: name
          }),
        });

        console.log('📧 Response status:', response.status, response.statusText);
        const result = await response.json();
        console.log('📧 Response body:', result);
        
        if (result.success) {
          console.log('✅ OTP email sent successfully to:', email);
          emailSent = true;
        } else {
          console.error('❌ Failed to send OTP email:', result.message);
          alert(`⚠️ Failed to send email: ${result.message}. Please check your email address or try again.`);
        }
      } catch (emailError) {
        console.error('❌ Error sending OTP email:', emailError);
        console.error('❌ Error details:', emailError.message, emailError.stack);
        alert(`⚠️ Email service error: ${emailError.message}. Please make sure the backend server is running on port 5000.`);
      }
      
      if (!emailSent) {
        console.log('⚠️ Email not sent - OTP stored in Firestore for manual verification');
      }
      
      console.log('✅ OTP sent to:', email, '| Code:', otp);
      
      // Create user profile in Firestore (but mark as unverified)
      const ref = doc(db, 'users', uid);
      const userProfile = {
        name,
        email,
        mobile: mobile || '',
        partner: null,
        dsa: 0,
        dev: 0,
        streak: 0,
        total: 0,
        pendingRequests: [],
        course: profile.course || '',
        college: profile.college || '',
        year: profile.year || '',
        startDate: startDate || new Date().toISOString().split('T')[0],
        lastLoginDate: new Date().toISOString(),
        lastPostDate: null,
        emailVerified: false // Mark as unverified initially
      };
      await setDoc(ref, userProfile);
      
      // Store UID in sessionStorage for OTP verification (avoids query)
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(`pending_verification_uid_${email}`, uid);
        console.log('💾 Stored UID for verification:', uid);
      }
      
      // IMPORTANT: Sign out immediately after registration
      // This prevents auto-login and keeps user on OTP verification screen
      await signOut(auth);
      console.log('🚪 User signed out - waiting for OTP verification');
      
      console.log('📧 OTP sent to email:', email);
      console.log('Registration successful, awaiting OTP verification');
      return { 
        success: true, 
        message: `OTP sent to ${email}! Check your email.`,
        userId: uid
      };
    } catch (err) {
      console.error('Register error:', err);
      // Clear verification flag on error
      setIsVerifying(false);
      isVerifyingRef.current = false;
      
      let message = 'Registration failed';
      if (err?.code === 'auth/email-already-in-use') message = 'Email already in use';
      if (err?.code === 'auth/invalid-email') message = 'Invalid email';
      if (err?.code === 'auth/weak-password') message = 'Password should be at least 6 characters';
      if (err?.code === 'auth/network-request-failed') message = 'Network error. Check your connection';
      return { success: false, message };
    }
  };

  // Check if email is verified (now checks OTP)
  const checkEmailVerification = async (otpCode, email, password) => {
    try {
      console.log('🔍 Starting OTP verification...');
      console.log('Email:', email);
      console.log('OTP entered:', otpCode);
      console.log('OTP type:', typeof otpCode);
      
      if (!otpCode || otpCode.length !== 6) {
        return { success: false, message: 'Please enter a valid 6-digit OTP' };
      }

      // Get UID from sessionStorage (stored during registration)
      const uid = window.sessionStorage.getItem(`pending_verification_uid_${email}`);
      
      if (!uid) {
        console.error('❌ UID not found in sessionStorage');
        return { success: false, message: 'Session expired. Please register again.' };
      }
      
      console.log('✅ Retrieved UID from sessionStorage:', uid);

      // Get OTP data directly by UID (no query needed!)
      const otpRef = doc(db, 'otpCodes', uid);
      const otpSnap = await getDoc(otpRef);

      if (!otpSnap.exists()) {
        console.error('❌ OTP document not found in Firestore');
        return { success: false, message: 'OTP not found. Please request a new one.' };
      }

      const otpData = otpSnap.data();
      console.log('✅ OTP data from Firestore:', otpData);
      console.log('Stored OTP:', otpData.code, '(type:', typeof otpData.code, ')');
      console.log('Entered OTP:', otpCode, '(type:', typeof otpCode, ')');
      console.log('Match?', otpData.code === otpCode);

      // Check if OTP is expired
      const expiresAt = new Date(otpData.expiresAt);
      const now = new Date();
      console.log('Expiry check - Now:', now, 'Expires:', expiresAt);
      
      if (now > expiresAt) {
        console.error('❌ OTP expired');
        return { success: false, message: 'OTP expired. Please request a new one.' };
      }
      console.log('✅ OTP not expired');

      // Verify OTP matches (convert both to strings and trim)
      const storedOTP = String(otpData.code).trim();
      const enteredOTP = String(otpCode).trim();
      
      console.log('Comparing - Stored:', storedOTP, 'vs Entered:', enteredOTP);
      
      if (storedOTP !== enteredOTP) {
        console.error('❌ OTP mismatch!');
        return { success: false, message: 'Invalid OTP. Please check and try again.' };
      }
      console.log('✅ OTP matches!');

      // Check if already verified
      if (otpData.verified) {
        console.error('❌ OTP already used');
        return { success: false, message: 'OTP already used. Please request a new one.' };
      }
      console.log('✅ OTP not yet used');

      // Mark OTP as verified
      console.log('📝 Marking OTP as verified...');
      await updateDoc(otpRef, { verified: true });

      // Sign in the user with email and password
      console.log('🔐 Signing in user...');
      const cred = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ User signed in successfully');

      // Update user profile to mark email as verified
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { emailVerified: true });

      // Clean up sessionStorage
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(`pending_verification_uid_${email}`);
        window.sessionStorage.removeItem(`otp_${uid}`);
        window.sessionStorage.removeItem(`otp_email_${email}`);
        console.log('🧹 Cleaned up sessionStorage');
      }

      // Clear verification flag
      setIsVerifying(false);
      isVerifyingRef.current = false;

      console.log('✅ Email verified successfully! User is now logged in.');
      return { success: true, message: 'Email verified!' };
    } catch (err) {
      console.error('Check verification error:', err);
      setIsVerifying(false);
      isVerifyingRef.current = false;
      
      let message = 'Failed to verify OTP. Please try again.';
      if (err?.code === 'auth/user-not-found') {
        message = 'User not found. Please register first.';
      } else if (err?.code === 'auth/wrong-password') {
        message = 'Invalid credentials. Please try registering again.';
      } else if (err?.code === 'auth/invalid-credential') {
        message = 'Invalid credentials. Please try registering again.';
      }
      
      return { success: false, message };
    }
  };

  // Resend verification email (regenerate OTP)
  const resendVerificationEmail = async (email) => {
    try {
      if (!email) {
        return { success: false, message: 'Email is required' };
      }

      // Find user by email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: false, message: 'User not found' };
      }

      const userDoc = querySnapshot.docs[0];
      const userId = userDoc.id;

      // Check if already verified
      if (userDoc.data().emailVerified) {
        return { success: false, message: 'Email already verified!' };
      }

      // Generate new OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      console.log('Generated new OTP:', otp);

      // Update OTP in Firestore
      const otpRef = doc(db, 'otpCodes', userId);
      await setDoc(otpRef, {
        code: otp,
        email: email,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        verified: false
      }, { merge: true });

      // Store in sessionStorage for testing
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(`otp_${userId}`, otp);
        window.sessionStorage.setItem(`otp_email_${email}`, otp);
      }

      // 📧 Send OTP to email via backend API
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
        const response = await fetch(`${backendUrl}/api/otp/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
            otp: otp,
            name: userDoc.data().name || 'User'
          }),
        });

        const result = await response.json();
        
        if (result.success) {
          console.log('✅ OTP email resent successfully to:', email);
        } else {
          console.error('❌ Failed to resend OTP email:', result.message);
        }
      } catch (emailError) {
        console.error('❌ Error resending OTP email:', emailError);
      }

      console.log('📧 New OTP Code:', otp);
      console.log('OTP resent to:', email);
      return { 
        success: true, 
        message: 'New OTP sent!',
        otpForTesting: otp // Remove in production!
      };
    } catch (err) {
      console.error('Resend verification error:', err);
      
      let message = 'Failed to send OTP';
      if (err?.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please wait a moment and try again.';
      }
      
      return { success: false, message };
    }
  };

  // Phone OTP registration logic (Requires Blaze plan)
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);
  
  const setupRecaptcha = (containerId = 'recaptcha-container') => {
    if (recaptchaVerifier) {
      return recaptchaVerifier;
    }
    try {
      const verifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
        callback: () => {
          console.log('reCAPTCHA solved');
        },
        'expired-callback': () => {
          console.log('reCAPTCHA expired');
        }
      });
      setRecaptchaVerifier(verifier);
      return verifier;
    } catch (err) {
      console.error('RecaptchaVerifier setup error:', err);
      return null;
    }
  };

  // Step 1: Send OTP
  const sendOtp = async (mobile) => {
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            console.log('reCAPTCHA solved');
          }
        });
      }
      const confirmation = await signInWithPhoneNumber(auth, mobile, window.recaptchaVerifier);
      return { success: true, confirmation };
    } catch (err) {
      console.error('Send OTP error:', err);
      let message = 'Failed to send OTP: ' + (err?.message || 'Unknown error');
      if (err?.code === 'auth/invalid-phone-number') message = 'Invalid mobile number format';
      if (err?.code === 'auth/too-many-requests') message = 'Too many requests. Try again later.';
      if (err?.code === 'auth/quota-exceeded') message = 'SMS quota exceeded. Try test numbers.';
      return { success: false, message };
    }
  };

  // Step 2: Verify OTP and create profile
  const verifyOtpAndRegister = async (confirmation, otp, profile) => {
    const { name, email } = profile || {};
    if (!name || !email) return { success: false, message: 'Name and email required' };
    try {
      const cred = await confirmation.confirm(otp);
      const uid = cred.user.uid;
      const ref = doc(db, 'users', uid);
      const userProfile = {
        name,
        email,
        mobile: cred.user.phoneNumber,
        partner: null,
        dsa: 0,
        dev: 0,
        streak: 0,
        pendingRequests: [],
      };
      await setDoc(ref, userProfile);
      setUser({ id: uid, ...userProfile });
      return { success: true };
    } catch (err) {
      console.error('Verify OTP error:', err);
      let message = 'Invalid OTP';
      if (err?.code === 'auth/invalid-verification-code') message = 'Invalid OTP code';
      if (err?.code === 'auth/code-expired') message = 'OTP expired. Please try again.';
      return { success: false, message };
    }
  };

  // Firestore partner request
  const sendPartnerRequest = async (email) => {
    if (!user) {
      console.error('Send request failed: Not logged in');
      return { success: false, message: "Not logged in" };
    }

    try {
      console.log('Sending partner request to:', email);
      console.log('Current user:', user.id, user.email);
      
      const q = query(collection(db, "users"), where("email", "==", email));
      const snap = await getDocs(q);

      console.log('Query results:', snap.size, 'users found');

      if (snap.empty) {
        console.error('No user found with email:', email);
        return { success: false, message: "User not found" };
      }

      const targetDoc = snap.docs[0];
      const targetData = targetDoc.data();
      
      console.log('Target user found:', targetDoc.id, targetData.email);

      // Prevent sending request to self
      if (targetDoc.id === user.id) {
        console.error('Cannot send request to self');
        return { success: false, message: "Cannot send request to yourself" };
      }

      // Check if request already sent
      if (targetData.pendingRequests?.includes(user.id)) {
        console.error('Request already sent');
        return { success: false, message: "Request already sent" };
      }

      console.log('Updating target user with pending request...');
      // Use setDoc with merge and arrayUnion
      await setDoc(doc(db, 'users', targetDoc.id), { 
        pendingRequests: arrayUnion(user.id) 
      }, { merge: true });
      
      console.log('Request sent successfully!');
      return { success: true, message: "Request sent!" };
    } catch (err) {
      console.error('Send request error:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);
      return { success: false, message: `Failed to send request: ${err.message}` };
    }
  };

  // Accept partner request
  const acceptPartnerRequest = async (fromUserId) => {
    if (!user) return { success: false, message: "Not logged in" };

    try {
      const userRef = doc(db, "users", user.id);
      const fromUserRef = doc(db, "users", fromUserId);

      // Update both users to be partners (use setDoc with merge)
      await setDoc(userRef, {
        partner: fromUserId,
        pendingRequests: user.pendingRequests?.filter(id => id !== fromUserId) || []
      }, { merge: true });

      await setDoc(fromUserRef, {
        partner: user.id
      }, { merge: true });

      // Update local state
      const fromUserSnap = await getDoc(fromUserRef);
      const partnerData = { id: fromUserId, ...fromUserSnap.data() };
      
      setUser({ ...user, partner: fromUserId, pendingRequests: user.pendingRequests?.filter(id => id !== fromUserId) || [] });
      setPartner(partnerData);
      setRequests(requests.filter(req => req.from !== fromUserId));

      return { success: true, message: "Partner connected!" };
    } catch (err) {
      console.error('Accept request error:', err);
      return { success: false, message: "Failed to accept request" };
    }
  };

  // Reject partner request
  const rejectPartnerRequest = async (fromUserId) => {
    if (!user) return { success: false, message: "Not logged in" };

    try {
      const userRef = doc(db, "users", user.id);

      // Remove from pending requests (use setDoc with merge)
      await setDoc(userRef, {
        pendingRequests: user.pendingRequests?.filter(id => id !== fromUserId) || []
      }, { merge: true });

      // Update local state
      setUser({ ...user, pendingRequests: user.pendingRequests?.filter(id => id !== fromUserId) || [] });
      setRequests(requests.filter(req => req.from !== fromUserId));

      return { success: true, message: "Request declined" };
    } catch (err) {
      console.error('Reject request error:', err);
      return { success: false, message: "Failed to reject request" };
    }
  };

  // Remove partner connection
  const removePartner = async () => {
    if (!user || !user.partner) return { success: false, message: "No partner to remove" };

    try {
      const userRef = doc(db, "users", user.id);
      const partnerRef = doc(db, "users", user.partner);

      // Update both users (use setDoc with merge to handle missing docs)
      await setDoc(userRef, { partner: null }, { merge: true });
      await setDoc(partnerRef, { partner: null }, { merge: true });

      // Update local state
      setUser({ ...user, partner: null });
      setPartner(null);

      return { success: true, message: "Partner removed" };
    } catch (err) {
      console.error('Remove partner error:', err);
      return { success: false, message: "Failed to remove partner" };
    }
  };

  const getPartner = () => {
    return partner;
  };

  return (
    <AuthContext.Provider
      value={{ 
        user, 
        setUser, 
        loading,
        isVerifying, // Export verification flag
        login, 
        logout, 
        register, 
        checkEmailVerification,
        resendVerificationEmail,
        sendOtp, 
        verifyOtpAndRegister, 
        sendPartnerRequest, 
        acceptPartnerRequest,
        rejectPartnerRequest,
        removePartner,
        getPartner, 
        partner,
        requests 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
