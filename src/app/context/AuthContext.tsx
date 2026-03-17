import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'passenger' | 'driver' | 'admin';
  rating?: number;
  vehicleDetails?: any;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (session?.access_token) {
        setAccessToken(session.access_token);
        await fetchUserProfile(session.access_token);
      }
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (token: string) => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return;
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93f7752e/users/${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'x-user-token': token,
            'apikey': publicAnonKey,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUser({ ...user, ...data });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.session) {
      setAccessToken(data.session.access_token);
      await fetchUserProfile(data.session.access_token);
    }
  };

  const signup = async (signupData: any) => {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-93f7752e/auth/signup`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'apikey': publicAnonKey,
        },
        body: JSON.stringify(signupData),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Signup failed');
    }

    // After signup, log the user in
    await login(signupData.email, signupData.password);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAccessToken(null);
  };

  const refreshUser = async () => {
    if (accessToken) {
      await fetchUserProfile(accessToken);
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { supabase };
