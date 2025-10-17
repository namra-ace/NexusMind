import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../api/authService';
import { useNavigate } from 'react-router-dom';

 const AuthContext = createContext();

// 2. Create the "Provider" component
// This component will wrap our entire app and "provide" the auth state
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Add loading state
  const navigate = useNavigate();

  // 3. Check for a user in localStorage on app load
  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user'));
      if (storedUser) {
        setUser(storedUser);
      }
    } catch (error) {
      // Problem parsing user, clear it
      localStorage.removeItem('user');
    }
    setLoading(false); // Finished loading
  }, []);

  // 4. Register function
  const register = async (email, password) => {
    try {
      const userData = await authService.register({ email, password });
      setUser(userData);
      navigate('/'); // Redirect to dashboard on success
    } catch (error) {
      console.error('Registration failed', error.response.data);
      // We'll add user-facing error messages later
    }
  };

  // 5. Login function
  const login = async (email, password) => {
    try {
      const userData = await authService.login({ email, password });
      setUser(userData);
      navigate('/'); // Redirect to dashboard on success
    } catch (error) {
      console.error('Login failed', error.response.data);
    }
  };

  // 6. Logout function
  const logout = () => {
    authService.logout();
    setUser(null);
    navigate('/login'); // Redirect to login on logout
  };

  // 7. The "value" is what we're providing to the rest of the app
  const value = {
    user,
    isAuthenticated: !!user, // A handy boolean
    loading,
    register,
    login,
    logout,
  };

  // We don't render anything until we've checked for a user
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// 8. Create a custom hook to easily "use" the context
// This saves us from importing 'useContext' and 'AuthContext' every time
export const useAuth = () => {
  return useContext(AuthContext);
};