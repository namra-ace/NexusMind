// client/src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Navbar from './components/Navbar.jsx'; // We'll create this

// --- Dashboard Component ---
// (We'll style this in a moment)
function Dashboard() {
  const { user } = useAuth();
  return (
    <div>
      <h1 className="text-3xl font-bold text-white">Welcome, {user.email}</h1>
      <p className="text-gray-300">This is your dashboard. You are logged in.</p>
    </div>
  );
}

// --- PrivateRoute Component ---
// (No style changes needed here)
function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}


// --- Main App Component ---
function App() {
  const { isAuthenticated } = useAuth();

  return (
    // This is our main layout wrapper
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar /> {/* Add the Navbar */}
      <div className="container mx-auto p-4 pt-20"> {/* Add padding for navbar */}
        <Routes>
          {/* PUBLIC ROUTES */}
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/" /> : <Login />} 
          />
          <Route 
            path="/register" 
            element={isAuthenticated ? <Navigate to="/" /> : <Register />} 
          />

          {/* PRIVATE ROUTES */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
        </Routes>
      </div>
    </div>
  );
}

export default App;