import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
        const res = await fetch(`${API_URL}/me`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });
        if (res.ok) {
            const data = await res.json();
            setUser(data);
            localStorage.setItem('user', JSON.stringify(data));
        }
    } catch (error) {
        console.error("Failed to fetch profile:", error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token) {
        setIsAuthenticated(true);
        if (userData) {
            setUser(JSON.parse(userData));
        }
        // Always fetch fresh data
        fetchProfile();
    }
    setLoading(false);
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  const updateUser = (userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const value = {
    isAuthenticated,
    user,
    login,
    logout,
    updateUser,
    fetchProfile,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};