"use client";

import { useState } from "react";
import { Settings, ShieldCheck, Mail, Bell, Server } from "lucide-react";

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
      {/* Platform Admin Configuration                                      */}
      {/* ----------------------------------------------------------------- */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-950">
            Platform Admin Configuration
          </h2>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
          <div className="grid gap-1 px-4 py-4">
            <p className="text-sm font-medium text-zinc-950">
              Authentication method
            </p>
            <p className="text-sm text-zinc-600">JWT allowlist + API key</p>
          </div>
          <div className="grid gap-1 border-t border-zinc-200 px-4 py-4">
            <p className="text-sm font-medium text-zinc-950">
              Admin email management
            </p>
            <p className="text-sm text-zinc-600">
              Controlled via the{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono text-zinc-800">
                PLATFORM_ADMIN_EMAILS
              </code>{" "}
              environment variable on the API server.
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-zinc-500">
          To add or remove admins, update the PLATFORM_ADMIN_EMAILS environment
          variable on the API server.
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
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="text-sm font-medium text-amber-700">
            Not configured
          </span>
        </div>

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
              to your verified domain email (e.g., notifications@lumentra.ai)
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

        <p className="mt-4 text-sm text-zinc-500">
          Once configured, email alerts will activate automatically.
        </p>
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
          {/* Disabled overlay message */}
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            <p className="text-sm text-amber-700">
              Email integration required to activate alerts
            </p>
          </div>

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
                  disabled
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
