import React, { useState } from 'react';
import Logo from '../assets/Logo.png';
import { useAuth } from '../context/AuthContext';

const Register = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const { register, checkEmailVerification, resendVerificationEmail } = useAuth();
  const [step, setStep] = useState(1); // 1: Register form, 2: OTP verification
  const [otp, setOtp] = useState(['', '', '', '', '', '']); // 6-digit OTP
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    startDate: new Date().toISOString().split('T')[0], // Default to today
    password: '',
    confirm: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Handle OTP input change
  const handleOtpChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  // Handle OTP input backspace
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  // Handle OTP paste
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    
    // Check if pasted data is 6 digits
    if (/^\d{6}$/.test(pastedData)) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      // Focus last input
      document.getElementById('otp-5')?.focus();
    }
  };

  const handleCheckVerification = async () => {
    setLoading(true);
    setError('');
    
    // Get OTP string
    const otpString = otp.join('');
    
    if (otpString.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      setLoading(false);
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    try {
      // Pass email and password to verify OTP and sign in
      const result = await checkEmailVerification(otpString, form.email, form.password);
      setLoading(false);
      
      if (result?.success) {
        setSuccess('Email verified successfully! Redirecting...');
        setTimeout(() => {
          onRegisterSuccess?.();
        }, 1500);
      } else {
        setError(result?.message || 'Invalid OTP. Please check and try again.');
        setTimeout(() => setError(''), 5000);
        // Clear OTP on error
        setOtp(['', '', '', '', '', '']);
        document.getElementById('otp-0')?.focus();
      }
    } catch (err) {

      setLoading(false);
      setError('Failed to verify OTP');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    setError('');
    try {
      // Pass email to resend OTP
      const result = await resendVerificationEmail(form.email);
      setLoading(false);
      
      if (result?.success) {
        // Show new OTP for testing
        if (result.otpForTesting) {
          setSuccess(`New OTP sent! For testing: ${result.otpForTesting}`);
        } else {
          setSuccess('New OTP sent! Please check your inbox.');
        }
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(result?.message || 'Failed to send OTP');
        setTimeout(() => setError(''), 4000);
      }
    } catch (err) {
      setLoading(false);
      setError('Failed to resend OTP');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await register(form);
      setLoading(false);
      
      if (result?.success) {
        // Show success message - user gets OTP via email
        setSuccess(`Account created! OTP sent to ${form.email}. Check your inbox and spam folder.`);
        setVerificationSent(true);
        setStep(2); // Move to OTP verification step
      } else {
        setError(result?.message || 'Registration failed. Try again.');
        setTimeout(() => setError(''), 4000);
      }
    } catch (err) {
      setLoading(false);
      setError('An unexpected error occurred. Please try again.');
      setTimeout(() => setError(''), 4000);
    }
  };

  // Verification step UI
  if (step === 2) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl p-8">
          {/* Debug indicator */}
          <div className="bg-green-500 text-white text-center py-2 px-4 rounded mb-4 font-bold">
            ✅ OTP SCREEN (STEP 2) - THIS IS WORKING!
          </div>
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-indigo-600/20 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-white text-2xl font-bold mb-2">Verify Your Email</h1>
            <p className="text-gray-400 text-sm text-center">
              We've sent a 6-digit OTP code to<br />
              <span className="text-white font-medium">{form.email}</span>
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
            <h3 className="text-white font-medium mb-3 text-center">Enter OTP Code</h3>
            
            {/* OTP Input Boxes */}
            <div className="flex gap-2 justify-center mb-4" onPaste={handleOtpPaste}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-12 h-12 text-center text-2xl font-bold bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-indigo-500 focus:outline-none transition-colors"
                  autoFocus={index === 0}
                />
              ))}
            </div>

            <p className="text-xs text-gray-500 text-center">
              Enter the 6-digit code sent to your email
            </p>
          </div>

          <button
            onClick={handleCheckVerification}
            disabled={loading || otp.join('').length !== 6}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed mb-3 transition-colors"
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>

          <button
            onClick={handleResendVerification}
            disabled={loading}
            className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg text-sm disabled:opacity-60 transition-colors"
          >
            Didn't receive OTP? Resend
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg text-sm text-center">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 text-green-400 rounded-lg text-sm text-center">
              {success}
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setStep(1);
                setOtp(['', '', '', '', '', '']);
              }}
              className="text-sm text-gray-400 hover:text-gray-300"
            >
              ← Back to registration
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Registration form UI (step 1)
  console.log('📝 Rendering registration form (step 1)');
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl p-6">
        {/* Debug indicator */}
        <div className="bg-blue-500 text-white text-center py-2 px-4 rounded mb-4 font-bold">
          📝 REGISTRATION FORM (STEP 1) - Fill and submit to see OTP screen
        </div>
        <div className="flex flex-col items-center mb-6">
          <img src={Logo} alt="Partner Logo" className="h-10 w-auto mb-2" />
          <h1 className="text-white text-2xl font-bold">Create your account</h1>
          <p className="text-gray-400 text-sm">Start your progress journey today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm mb-1">Full Name</label>
            <input name="name" value={form.name} onChange={onChange} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-600" required />
          </div>
          <div>
            <label className="block text-gray-300 text-sm mb-1">Email</label>
            <input name="email" type="email" value={form.email} onChange={onChange} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-600" required />
          </div>
          <div>
            <label className="block text-gray-300 text-sm mb-1">Mobile Number (Optional)</label>
            <input name="mobile" type="tel" value={form.mobile} onChange={onChange} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-600" placeholder="e.g. +919876543210" />
            <p className="text-xs text-gray-500 mt-1">For future notifications (optional)</p>
          </div>
          <div>
            <label className="block text-gray-300 text-sm mb-1">Start Date <span className="text-indigo-400">*</span></label>
            <input name="startDate" type="date" value={form.startDate} onChange={onChange} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-600" required />
            <p className="text-xs text-gray-500 mt-1">When did you start your learning journey?</p>
          </div>
          <div>
            <label className="block text-gray-300 text-sm mb-1">Password</label>
            <div className="relative">
              <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={onChange} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-600" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 text-sm">
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-gray-300 text-sm mb-1">Confirm Password</label>
            <input name="confirm" type={showPassword ? 'text' : 'password'} value={form.confirm} onChange={onChange} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-600" required />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg disabled:opacity-60">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg text-sm text-center">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 text-green-400 rounded-lg text-sm text-center">
            {success}
          </div>
        )}

        <div className="mt-4 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className="text-indigo-400 hover:underline">Sign in</button>
        </div>
      </div>
    </div>
  );
};

export default Register;
