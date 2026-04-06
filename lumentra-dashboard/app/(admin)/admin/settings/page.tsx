"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  ShieldCheck,
  Mail,
  Bell,
  Server,
  Lock,
  X,
  Plus,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  fetchPlatformAdmins,
  addPlatformAdmin,
  removePlatformAdmin,
  type PlatformAdmin,
} from "@/lib/api/admin";

// ---------------------------------------------------------------------------
// Toggle switch (inline, no separate file)
// ---------------------------------------------------------------------------
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
        checked ? "bg-zinc-900" : "bg-zinc-200"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Alert preference definitions
// ---------------------------------------------------------------------------
interface AlertPreference {
  id: string;
  label: string;
  description: string;
  defaultOn: boolean;
}

const alertPreferences: AlertPreference[] = [
  {
    id: "new_tenant_signup",
    label: "New tenant signup",
    description: "Email when a new tenant account is created",
    defaultOn: true,
  },
  {
    id: "port_request_submitted",
    label: "Port request submitted",
    description: "Email when a tenant submits a number porting request",
    defaultOn: true,
  },
  {
    id: "stale_port_request",
    label: "Stale port request",
    description: "Email when a port request has been pending for 7+ days",
    defaultOn: true,
  },
  {
    id: "call_failure_spike",
    label: "Call failure spike",
    description: "Email when failure rate exceeds 20% in the last hour",
    defaultOn: false,
  },
  {
    id: "setup_incomplete_48h",
    label: "Setup incomplete (48h)",
    description: "Email when a tenant hasn't completed setup after 48 hours",
    defaultOn: false,
  },
  {
    id: "system_health_degraded",
    label: "System health degraded",
    description: "Email when API or database health degrades",
    defaultOn: false,
  },
];

// ---------------------------------------------------------------------------
// Platform info rows
// ---------------------------------------------------------------------------
const platformInfo = [
  { label: "Version", value: "0.1.0" },
  { label: "Environment", value: "Production" },
  { label: "Voice pipeline", value: "LiveKit Agents + Cartesia TTS" },
  { label: "Database", value: "Supabase PostgreSQL" },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default function AdminSettingsPage() {
  const [alerts, setAlerts] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(alertPreferences.map((a) => [a.id, a.defaultOn])),
  );

  // Platform admin management state
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadAdmins = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchPlatformAdmins();
      setAdmins(data.admins);
      // Check platform config for email status
      try {
        const { get } = await import("@/lib/api/client");
        const config = await get<{ email?: { configured?: boolean } }>(
          "/admin/platform-config",
        );
        setEmailConfigured(config?.email?.configured || false);
      } catch {
        // Non-critical -- leave as not configured
      }
    } catch {
      setMessage({ type: "error", text: "Failed to load admins" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAdmins();
  }, [loadAdmins]);

  // Auto-dismiss success messages after 4 seconds
  useEffect(() => {
    if (message?.type === "success") {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    try {
      setAdding(true);
      setMessage(null);
      await addPlatformAdmin(email);
      setNewEmail("");
      setMessage({ type: "success", text: `${email} added as platform admin` });
      await loadAdmins();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to add admin";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (email: string) => {
    try {
      setRemoving(email);
      setMessage(null);
      await removePlatformAdmin(email);
      setMessage({ type: "success", text: `${email} removed` });
      await loadAdmins();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to remove admin";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setRemoving(null);
    }
  };

  const handleAlertToggle = (id: string, value: boolean) => {
    setAlerts((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-zinc-400" />
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">
            Platform Settings
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Configure platform-level controls, admin access, and alert
            preferences.
          </p>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Platform Admin Management                                         */}
      {/* ----------------------------------------------------------------- */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-zinc-400" />
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">
              Platform Admins
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Manage who has access to this admin panel.
            </p>
          </div>
        </div>

        {/* Status message */}
        {message && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${
              message.type === "error"
                ? "border border-red-200 bg-red-50 text-red-700"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {message.type === "error" && (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            {message.text}
          </div>
        )}

        {/* Admin list */}
        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading admins...
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
            {admins.map((admin, index) => (
              <div
                key={admin.id}
                className={`flex items-center justify-between gap-4 px-4 py-3 ${
                  index > 0 ? "border-t border-zinc-100" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-zinc-950">
                      {admin.email}
                    </p>
                    {(admin.source === "env" || admin.source === "both") && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500"
                        title="Defined in environment variable"
                      >
                        <Lock className="h-3 w-3" />
                        env
                      </span>
                    )}
                  </div>
                  {admin.added_by && admin.added_by !== "environment" && (
                    <p className="mt-0.5 text-xs text-zinc-400">
                      Added by {admin.added_by}
                      {admin.created_at &&
                        ` on ${new Date(admin.created_at).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
                {admin.source === "database" && (
                  <button
                    type="button"
                    onClick={() => handleRemove(admin.email)}
                    disabled={removing === admin.email}
                    className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Remove admin"
                  >
                    {removing === admin.email ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add admin form */}
        <form onSubmit={handleAdd} className="mt-4 flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="admin@example.com"
            className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
          <button
            type="submit"
            disabled={!newEmail.trim() || adding}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add
          </button>
        </form>

        <p className="mt-3 text-xs text-zinc-400">
          Admins defined via the PLATFORM_ADMIN_EMAILS environment variable
          cannot be removed from the UI.
        </p>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Email Configuration Status                                        */}
      {/* ----------------------------------------------------------------- */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-950">Email Alerts</h2>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {emailConfigured ? (
            <>
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="text-sm font-medium text-emerald-700">
                Configured
              </span>
            </>
          ) : (
            <>
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="text-sm font-medium text-amber-700">
                Not configured
              </span>
            </>
          )}
        </div>

        {!emailConfigured && (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-sm font-medium text-zinc-950">
              Setup instructions
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-600">
              <li>
                Sign up at{" "}
                <span className="font-medium text-zinc-800">resend.com</span>
              </li>
              <li>Get your API key</li>
              <li>
                Set{" "}
                <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-mono text-zinc-800">
                  RESEND_API_KEY
                </code>{" "}
                in your server environment
              </li>
              <li>
                Set{" "}
                <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-mono text-zinc-800">
                  EMAIL_FROM
                </code>{" "}
                to your verified domain email
              </li>
              <li>
                Set{" "}
                <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-mono text-zinc-800">
                  ADMIN_EMAIL
                </code>{" "}
                to the team email that should receive alerts
              </li>
            </ol>
          </div>
        )}
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Alert Preferences                                                 */}
      {/* ----------------------------------------------------------------- */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-zinc-400" />
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">
              Alert Configuration
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Choose which events trigger admin email notifications.
            </p>
          </div>
        </div>

        <div className="relative mt-4">
          {!emailConfigured && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              <p className="text-sm text-amber-700">
                Email integration required to activate alerts
              </p>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-zinc-200">
            {alertPreferences.map((pref, index) => (
              <div
                key={pref.id}
                className={`flex items-center justify-between gap-4 px-4 py-4 ${
                  index > 0 ? "border-t border-zinc-200" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-950">
                    {pref.label}
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-500">
                    {pref.description}
                  </p>
                </div>
                <Toggle
                  checked={alerts[pref.id] ?? pref.defaultOn}
                  onChange={(v) => handleAlertToggle(pref.id, v)}
                  disabled={!emailConfigured}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Platform Info                                                     */}
      {/* ----------------------------------------------------------------- */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-950">Platform Info</h2>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {platformInfo.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {item.label}
              </p>
              <p className="mt-2 text-base font-semibold text-zinc-950">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
