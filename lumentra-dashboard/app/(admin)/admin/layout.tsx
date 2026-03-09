"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  LayoutDashboard,
  Loader2,
  Settings,
  Shield,
  Wrench,
} from "lucide-react";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AdminProvider, useAdmin } from "@/context/AdminContext";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "Tenants", icon: Building2 },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/operations", label: "Operations", icon: Wrench },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const {
    isPlatformAdmin,
    isLoading: adminLoading,
    error,
    refreshAdminProfile,
  } = useAdmin();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!authLoading && !adminLoading && user && !isPlatformAdmin) {
      router.replace("/dashboard");
    }
  }, [adminLoading, authLoading, isPlatformAdmin, router, user]);

  if (authLoading || adminLoading || !user || !isPlatformAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading admin workspace...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-4">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-zinc-900">
            <Shield className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Admin panel unavailable</h1>
          </div>
          <p className="mt-3 text-sm text-zinc-600">{error}</p>
          <button
            type="button"
            onClick={() => void refreshAdminProfile()}
            className="mt-5 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-100 md:flex">
          <div className="border-b border-zinc-800 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Platform Admin
            </p>
            <h1 className="mt-2 text-xl font-semibold">Lumentra Control</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Internal operations and tenant governance.
            </p>
          </div>

          <nav className="flex-1 space-y-1 px-4 py-4">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                    isActive
                      ? "bg-zinc-100 text-zinc-950"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-zinc-800 px-4 py-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-zinc-200 bg-white">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Platform Admin
                  </p>
                  <h2 className="text-xl font-semibold text-zinc-950">
                    Admin Foundation
                  </h2>
                </div>
                <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-600">
                  {user.email || "Platform admin"}
                </div>
              </div>

              <nav className="flex gap-2 overflow-x-auto md:hidden">
                {NAV_ITEMS.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "whitespace-nowrap rounded-full px-3 py-2 text-sm transition",
                        isActive
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-600",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AdminProvider>
          <AdminShell>{children}</AdminShell>
        </AdminProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
