"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { fetchAdminMe, type AdminMeResponse } from "@/lib/api/admin";
import { ApiClientError } from "@/lib/api/client";

interface AdminContextType {
  profile: AdminMeResponse | null;
  isPlatformAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  refreshAdminProfile: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<AdminMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAdminProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    // Only check admin status if we're on an admin page.
    // This avoids 403 console errors on every page load for non-admin users.
    const isAdminPage =
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/admin");
    if (!isAdminPage) {
      setProfile(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setProfile(await fetchAdminMe());
    } catch (err) {
      if (
        err instanceof ApiClientError &&
        (err.status === 401 || err.status === 403)
      ) {
        setProfile(null);
        setError(null);
        return;
      }

      setProfile(null);
      setError(
        err instanceof Error ? err.message : "Failed to load admin profile",
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    void refreshAdminProfile();
  }, [authLoading, refreshAdminProfile]);

  const value = useMemo<AdminContextType>(
    () => ({
      profile,
      isPlatformAdmin: profile?.isPlatformAdmin ?? false,
      isLoading,
      error,
      refreshAdminProfile,
    }),
    [error, isLoading, profile, refreshAdminProfile],
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);

  if (!context) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }

  return context;
}
