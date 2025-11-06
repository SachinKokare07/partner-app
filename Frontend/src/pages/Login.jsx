import React, { useState } from 'react';
import Logo from '../assets/Logo.png';
import { useAuth } from '../context/AuthContext';

const Login = ({ onLoginSuccess, onSwitchToSignup }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

const handleSubmit = async (e) => {
  e.preventDefault();

  setError(''); // clear previous errors
  setLoading(true);
  
  const result = await login(email, password);
  
  setLoading(false);

  if (result?.success) {
    console.log('Login successful, redirecting to dashboard...');
    // Small delay to ensure auth state is updated
    setTimeout(() => {
      onLoginSuccess?.();
    }, 100);
  } else {
    const msg = result?.message || 'Login failed. Check your connection or try again.';
    setError(msg);
    setTimeout(() => setError(''), 3000);
  }
};


  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex flex-col items-center mb-6">
          <img src={Logo} alt="Partner Logo" className="h-10 w-auto mb-2" />
          <h1 className="text-white text-2xl font-bold">Welcome back</h1>
          <p className="text-gray-400 text-sm">Sign in to continue your streak</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                placeholder="••••••••"
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 text-sm">
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="mt-4 text-center text-sm text-gray-400">
          Don&apos;t have an account?{' '}
          <button onClick={onSwitchToSignup} className="text-indigo-400 hover:underline">Create one</button>
        </div>
      </div>
    </div>
  );
};

export default Login;
