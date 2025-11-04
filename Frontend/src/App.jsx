import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Posts from './pages/Posts';
import Chat from './pages/Chat';
import Notes from './pages/Notes';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import PartnerRequest from './pages/PartnerRequest';
import About from './pages/About';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const { user, loading, isVerifying, getPartner } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState('landing'); // 'landing' | 'login' | 'signup' | 'app'
  const partner = getPartner();

  // Automatically switch to app view when user is logged in
  React.useEffect(() => {
    // Don't auto-redirect if OTP verification is in progress
    if (isVerifying && view === 'signup') {
      return; // Stay on signup page during OTP verification
    }
    
    if (user && (view === 'landing' || view === 'login')) {
      setView('app');
    } else if (!user && view === 'app') {
      setView('landing');
    }
  }, [user, view, isVerifying]);

  // Show loading screen while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'posts':
        return <Posts />;
      case 'chat':
        return <Chat />;
      case 'notes':
        return <Notes />;
      case 'partner':
        return <PartnerRequest />;
      case 'about':
        return <About />;
      default:
        return <Dashboard />;
    }
  };

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navbar toggleSidebar={() => {}} showMenu={false} showUser={false} />
        <main className="pt-16">
          <Landing onGetStarted={() => setView('signup')} onLogin={() => setView('login')} />
        </main>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navbar toggleSidebar={() => {}} showMenu={false} showUser={false} />
        <main className="pt-16">
          <Login onLoginSuccess={() => setView('app')} onSwitchToSignup={() => setView('signup')} />
        </main>
      </div>
    );
  }

  if (view === 'signup') {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navbar toggleSidebar={() => {}} showMenu={false} showUser={false} />
        <main className="pt-16">
          <Register onRegisterSuccess={() => setView('app')} onSwitchToLogin={() => setView('login')} />
        </main>
      </div>
    );
  }

  // After login, always show the app - user can access Partner page from sidebar
  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        isOpen={sidebarOpen}
        closeSidebar={() => setSidebarOpen(false)}
      />
      <main className="lg:ml-64 pt-16">
        <div className="p-6">{renderPage()}</div>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;