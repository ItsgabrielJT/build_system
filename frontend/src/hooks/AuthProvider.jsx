import { useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import * as authService from '../services/authService';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Inicializar desde localStorage al montar
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = authService.getToken();
        if (storedToken) {
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
          setToken(storedToken);
          setRole(currentUser.role?.name || null);
        } else {
          setUser(null);
          setToken(null);
          setRole(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        authService.clearToken();
        setUser(null);
        setToken(null);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authService.login(email, password);
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      setToken(response.access_token);
      setRole(currentUser.role?.name || null);
      return response;
    } catch (error) {
      setUser(null);
      setToken(null);
      setRole(null);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setUser(null);
      setToken(null);
      setRole(null);
    }
  };

  const refreshUser = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      setRole(currentUser.role?.name || null);
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        loading,
        login,
        logout,
        isAuthenticated,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
