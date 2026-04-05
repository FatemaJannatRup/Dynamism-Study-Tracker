import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const getInitials = useCallback((name) => {
    if (!name || typeof name !== 'string') return '?';
    return name
      .split(' ')
      .filter(n => n.length > 0)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, []);

  const loadUser = useCallback(() => {
    try {
      const savedUser = localStorage.getItem('user_data');
      
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        
        // Validate required fields - token is now optional if you don't have real JWT yet
        if (parsedUser?.id && parsedUser?.name && parsedUser?.email) {
          setUser({
            id: parsedUser.id,
            name: parsedUser.name,
            email: parsedUser.email,
            role: parsedUser.role || 'user',
            initials: getInitials(parsedUser.name),
            isAuthenticated: true,
            token: parsedUser.token || null
          });
        } else {
          localStorage.removeItem('user_data');
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth load error:', error);
      localStorage.removeItem('user_data');
      setUser(null);
    }
    setLoading(false);
  }, [getInitials]);

  useEffect(() => {
    loadUser();

    const handleStorageChange = (e) => {
      if (e.key === 'user_data') {
        loadUser();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    const handleCustomLogout = () => loadUser();
    window.addEventListener('auth-logout', handleCustomLogout);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-logout', handleCustomLogout);
    };
  }, [loadUser]);

  const login = useCallback((userData) => {
    setLoading(true);
    
    try {
      const userToStore = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role || 'user',
        token: userData.token || null,
        timestamp: Date.now()
      };

      localStorage.setItem('user_data', JSON.stringify(userToStore));
      
      setUser({
        ...userToStore,
        initials: getInitials(userData.name),
        isAuthenticated: true
      });
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [getInitials]);

  const logout = useCallback(() => {
    setLoading(true);
    
    try {
      localStorage.removeItem('user_data');
      setUser(null);
      window.dispatchEvent(new CustomEvent('auth-logout'));
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateUser = useCallback((updates) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      const storageData = {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        token: updated.token,
        timestamp: Date.now()
      };
      localStorage.setItem('user_data', JSON.stringify(storageData));
      return { ...updated, initials: getInitials(updated.name) };
    });
  }, [getInitials]);

  const value = { 
    user, 
    login, 
    logout, 
    updateUser,
    loading, 
    isAuthenticated: !!user 
  };

  if (loading) {
    return <div style={{ display: 'none' }} />;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};