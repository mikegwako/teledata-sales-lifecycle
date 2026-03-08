import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type AppRole = 'admin' | 'staff' | 'client';

export interface UserProfile {
  full_name: string;
  phone_number: string | null;
  currency_preference: string;
  frozen_actions: string[];
  auto_delete_days: number | null;
  avatar_url: string | null;
  avatar_position: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, phoneNumber?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole>('client');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const [{ data: roleData }, { data: profileData }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId).single(),
      supabase.from('profiles').select('full_name, phone_number, currency_preference, frozen_actions, auto_delete_days, avatar_url, avatar_position').eq('id', userId).single(),
    ]);
    if (roleData) setRole(roleData.role as AppRole);
    if (profileData) setProfile(profileData as unknown as UserProfile);
  };

  const refreshProfile = async () => {
    if (user) await fetchUserData(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setRole('client');
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, phoneNumber?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone_number: phoneNumber || '' },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Log the login for audit trail with geolocation
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        let city: string | null = null;
        let country: string | null = null;
        try {
          const geoRes = await fetch('https://ipapi.co/json/');
          if (geoRes.ok) {
            const geo = await geoRes.json();
            city = geo.city || null;
            country = geo.country_name || null;
          }
        } catch { /* geolocation is best-effort */ }
        await supabase.from('login_audit_logs').insert({
          user_id: session.user.id,
          ip_address: null,
          user_agent: navigator.userAgent,
          city,
          country,
        } as any);
      }
    } catch (e) {
      console.warn('Audit log failed:', e);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole('client');
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
