import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, setStoredAuthToken } from '../lib/api';
import type {
  PricingConfiguration,
  PublicUserProfile,
  SubscriptionRecord,
  UserRole,
} from '../shared/types';

export interface SystemConfigState {
  paymentMode: 'razorpay_live' | 'razorpay_test_sandbox';
  razorpayKeyId: string | null;
  geocodingConfigured: boolean;
  geocodingProvider: string;
  emailNotificationsConfigured: boolean;
  smsNotificationsConfigured: boolean;
  pricing: PricingConfiguration;
}

interface RegisterPayload {
  fullName: string;
  mobile: string;
  email: string;
  password: string;
  role: UserRole;
  businessName: string;
  address: string;
  avatarDataUrl?: string;
  consentAccepted: boolean;
  publicFarmNameConsent: boolean;
}

interface AuthContextValue {
  user: PublicUserProfile | null;
  subscription: SubscriptionRecord | null;
  unreadNotifications: number;
  systemConfig: SystemConfigState | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<PublicUserProfile>;
  register: (payload: RegisterPayload) => Promise<PublicUserProfile>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<PublicUserProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [systemConfig, setSystemConfig] = useState<SystemConfigState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshAuth = useCallback(async () => {
    try {
      const [meRes, sysRes] = await Promise.all([
        apiRequest<{
          user: PublicUserProfile | null;
          subscription: SubscriptionRecord | null;
          unreadNotifications: number;
        }>('/api/auth/me'),
        apiRequest<SystemConfigState>('/api/system/config'),
      ]);
      setUser(meRes.user);
      setSubscription(meRes.subscription);
      setUnreadNotifications(meRes.unreadNotifications || 0);
      setSystemConfig(sysRes);
    } catch {
      setUser(null);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const login = async (identifier: string, password: string): Promise<PublicUserProfile> => {
    const res = await apiRequest<{
      user: PublicUserProfile;
      token: string;
      subscription: SubscriptionRecord | null;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    setStoredAuthToken(res.token);
    setUser(res.user);
    setSubscription(res.subscription);
    await refreshAuth();
    return res.user;
  };

  const register = async (payload: RegisterPayload): Promise<PublicUserProfile> => {
    const res = await apiRequest<{
      user: PublicUserProfile;
      token: string;
      subscription: SubscriptionRecord | null;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredAuthToken(res.token);
    setUser(res.user);
    setSubscription(res.subscription);
    await refreshAuth();
    return res.user;
  };

  const logout = async (): Promise<void> => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network error during sign out
    }
    setStoredAuthToken(null);
    setUser(null);
    setSubscription(null);
    setUnreadNotifications(0);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        subscription,
        unreadNotifications,
        systemConfig,
        loading,
        login,
        register,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
