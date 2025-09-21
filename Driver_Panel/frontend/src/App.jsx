import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { DriverProvider, useDriver } from './context/DriverContext';
import Login from './pages/Login';
import Trip from './pages/Trip';
import './App.css';
import './index.css';
import { ThemeProvider } from './components/theme/ThemeProvider';
import { ThemeToggle } from './components/theme/ThemeToggle';
import { ArrowLeft, Bus } from 'lucide-react';
import { Button } from './components/ui/Button';


const ProtectedRoute = ({ children }) => {
  const { driver } = useDriver();
  return driver.isAuthenticated ? children : <Navigate to="/login" replace />;
};

function HeaderBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { driver, logout } = useDriver();
  const [now, setNow] = useState(new Date());
  const canGoBack = location.pathname !== '/login';
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="max-h-screen header-bar bg-card">
      <div className="max-w-4xl mx-auto p-6 flex items-center justify-between">
  <div className="flex items-center gap-4">
          {canGoBack && (
            <Button variant="ghost" className="p-2" onClick={() => navigate(-1)} aria-label="Back">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Button>
          )}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center gradient-logo">
            <Bus className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold">Driver Dashboard</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground tabular-nums" aria-label="Current Time">
            {now.toLocaleTimeString()}
          </div>
          <ThemeToggle />
          {driver?.isAuthenticated && (
            <Button
              variant="text"
              className="text-sm"
              onClick={async () => { try { await logout(); } finally { navigate('/login'); } }}
            >
              Log out
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}


const AppContent = () => {
  return (
    <Router>
      <HeaderBar />
      <div className="app-shell bg-background text-foreground">
        <div className="max-w-4xl mx-auto px-6">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/trip" 
              element={
                <ProtectedRoute>
                  <Trip />
                </ProtectedRoute>
              } 
            />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="smarttransit-theme">
      <DriverProvider>
        <AppContent />
      </DriverProvider>
    </ThemeProvider>
  );
}

export default App
