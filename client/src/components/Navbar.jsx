// client/src/components/Navbar.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const { isAuthenticated, logout, user } = useAuth();

  return (
    <nav className="bg-gray-800 p-4 fixed w-full z-10 top-0 shadow-lg">
      <div className="container mx-auto flex justify-between items-center">
        
        {/* Logo/Brand Name */}
        <Link to="/" className="text-2xl font-bold text-white">
          NexusMind
        </Link>

        {/* Nav Links */}
        <div className="flex space-x-4">
          {isAuthenticated ? (
            // --- Links for LOGGED IN users ---
            <>
              <span className="text-gray-300">Hi, {user.email}</span>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition duration-200"
              >
                Logout
              </button>
            </>
          ) : (
            // --- Links for GUESTS ---
            <>
              <Link
                to="/login"
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition duration-200"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition duration-200"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;