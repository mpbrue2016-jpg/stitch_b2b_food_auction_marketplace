'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { UserProfile } from '@/lib/types';

export interface NotificationItem {
  id: string;
  titulo: string;
  mensagem: string;
  canal: string;
  lido: boolean;
  created_at: string;
}

export interface UserDocumentItem {
  id: string;
  tipo_documento: string;
  nome_arquivo: string;
  storage_path: string;
  status_validacao: string;
  created_at: string;
}

interface AuthContextValue {
  user: { id: string; email?: string } | null;
  profile: UserProfile | null;
  notifications: NotificationItem[];
  documents: UserDocumentItem[];
  loading: boolean;
  isConfigured: boolean;
  refreshProfile: () => Promise<void>;
  markNotificationRead: (notificationId?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  notifications: [],
  documents: [],
  loading: true,
  isConfigured: false,
  refreshProfile: async () => {},
  markNotificationRead: async () => {},
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [documents, setDocuments] = useState<UserDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setUser(null);
      setProfile(null);
      setNotifications([]);
      setDocuments([]);
      setLoading(false);
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setNotifications([]);
        setDocuments([]);
        setLoading(false);
        return;
      }

      setUser({ id: session.user.id, email: session.user.email });

      const res = await fetch('/api/auth/perfil', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile || null);
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setDocuments(Array.isArray(data.documents) ? data.documents : []);
      } else {
        setProfile(null);
        setNotifications([]);
        setDocuments([]);
      }
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const markNotificationRead = useCallback(async (notificationId?: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const res = await fetch('/api/notificacoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          notificationId ? { notificationId } : { markAll: true }
        ),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.notifications)) {
          setNotifications(data.notifications);
        }
      }
    } catch {
      // ignore transient error
    }
  }, []);

  useEffect(() => {
    refreshProfile();

    if (!isSupabaseConfigured) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshProfile();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshProfile]);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore network errors on signOut
      }
    }
    setUser(null);
    setProfile(null);
    setNotifications([]);
    setDocuments([]);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        notifications,
        documents,
        loading,
        isConfigured: isSupabaseConfigured,
        refreshProfile,
        markNotificationRead,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
