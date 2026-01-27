"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { get, setTenantId, clearTenantId } from "@/lib/api/client";

interface Tenant {
  id: string;
  business_name: string;
  industry: string;
  phone_number: string;
  is_active: boolean;
  created_at: string;
  role: string;
}

interface TenantContextType {
  tenants: Tenant[];
  currentTenant: Tenant | null;
  isLoading: boolean;
  error: string | null;
  selectTenant: (tenantId: string) => void;
  refreshTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const TENANT_STORAGE_KEY = "lumentra_current_tenant_id";

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTenants = useCallback(async () => {
    if (!user) {
      setTenants([]);
      setCurrentTenant(null);
      clearTenantId();
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Need to set a temporary tenant ID for the first request
      // The API will use the JWT to determine which tenants the user has access to
      const storedTenantId = localStorage.getItem(TENANT_STORAGE_KEY);
      if (storedTenantId) {
        setTenantId(storedTenantId);
      }

      const response = await get<{ tenants: Tenant[] }>("/api/tenants");
      const userTenants = response.tenants || [];
      setTenants(userTenants);

      if (userTenants.length > 0) {
        // Try to restore the previously selected tenant
        let selectedTenant: Tenant | null = null;

        if (storedTenantId) {
          selectedTenant =
            userTenants.find((t) => t.id === storedTenantId) || null;
        }

        // Fall back to first tenant if stored one is not available
        if (!selectedTenant) {
          selectedTenant = userTenants[0];
        }

        setCurrentTenant(selectedTenant);
        setTenantId(selectedTenant.id);
        localStorage.setItem(TENANT_STORAGE_KEY, selectedTenant.id);
      } else {
        setCurrentTenant(null);
        clearTenantId();
        localStorage.removeItem(TENANT_STORAGE_KEY);
      }
    } catch (err) {
      console.error("[TenantContext] Failed to load tenants:", err);
      setError(err instanceof Error ? err.message : "Failed to load tenants");
      setTenants([]);
      setCurrentTenant(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load tenants when user changes
  useEffect(() => {
    if (!authLoading) {
      loadTenants();
    }
  }, [user, authLoading, loadTenants]);

  const selectTenant = useCallback(
    (tenantId: string) => {
      const tenant = tenants.find((t) => t.id === tenantId);
      if (tenant) {
        setCurrentTenant(tenant);
        setTenantId(tenant.id);
        localStorage.setItem(TENANT_STORAGE_KEY, tenant.id);
      }
    },
    [tenants],
  );

  const refreshTenants = useCallback(async () => {
    await loadTenants();
  }, [loadTenants]);

  return (
    <TenantContext.Provider
      value={{
        tenants,
        currentTenant,
        isLoading,
        error,
        selectTenant,
        refreshTenants,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}
