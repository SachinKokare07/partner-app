import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import partnerRoutes from './routes/partner.js';
import progressRoutes from './routes/progress.js';
import postsRoutes from './routes/posts.js';
import otpRoutes from './routes/otp.js';
import { initializeFirebase } from './config/firebase.js';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
initializeFirebase();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - Allow multiple frontend origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174', 
  'http://localhost:5175',
  process.env.FRONTEND_URL, // Production frontend URL
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/otp', otpRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  const emailConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
  
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    config: {
      emailService: emailConfigured ? '✅ Configured' : '❌ Not Configured',
      firebaseAdmin: '✅ Initialized',
      corsEnabled: '✅ Enabled',
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Partner Backend API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      partner: '/api/partner',
      progress: '/api/progress',
      posts: '/api/posts',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 CORS enabled for localhost:5173, 5174, 5175`);
  console.log(`🔥 Firebase initialized`);
});

export default app;
