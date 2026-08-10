import React, { createContext, useState, useEffect } from 'react';
import API from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('adminToken') || null);
  const [loading, setLoading] = useState(true);

  // Check current admin login state on mount
  useEffect(() => {
    const verifyAuth = async () => {
      if (token) {
        try {
          const res = await API.get('/auth/me');
          setUser(res.data.user);
        } catch (error) {
          console.warn('Session expired or invalid token');
          logout();
        }
      }
      setLoading(false);
    };
    verifyAuth();
  }, [token]);

  const login = async (username, password) => {
    const res = await API.post('/auth/login', { username, password });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('adminToken', newToken);
    setToken(newToken);
    setUser(userData);
    return res.data;
  };

  const updateCredentials = async (currentPassword, newUsername, newPassword) => {
    const res = await API.put('/auth/update-credentials', {
      currentPassword,
      newUsername,
      newPassword
    });
    const { token: newToken, user: updatedUser } = res.data;
    if (newToken) {
      localStorage.setItem('adminToken', newToken);
      setToken(newToken);
    }
    if (updatedUser) {
      setUser(updatedUser);
    }
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, updateCredentials, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
