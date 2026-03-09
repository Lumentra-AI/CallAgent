const settingsRows = [
  ["Platform admins", "Controlled by PLATFORM_ADMIN_EMAILS on the API."],
  [
    "Automation compatibility",
    "Existing INTERNAL_API_KEY access remains valid for admin routes.",
  ],
  [
    "Voice pipeline credentials",
    "LiveKit credentials stay in environment-managed secrets only.",
  ],
];

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
          Platform configuration shell
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
          This area is reserved for platform-level controls that should never
          appear in the tenant dashboard, including admin access policy, global
          pricing configuration, and infrastructure-facing settings.
        </p>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-950">
          Current foundations
        </h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
          {settingsRows.map(([title, body], index) => (
            <div
              key={title}
              className={`grid gap-2 px-4 py-4 ${
                index > 0 ? "border-t border-zinc-200" : ""
              }`}
            >
              <p className="text-sm font-medium text-zinc-950">{title}</p>
              <p className="text-sm text-zinc-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {[
          "Pricing, infrastructure controls, and system logs stay out of the customer dashboard.",
          "Platform-only capabilities can grow here without reviving the old developer role in tenant UI.",
        ].map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm text-sm leading-6 text-zinc-700"
          >
            {item}
          </div>
        ))}
      </section>
    </div>
  );
}
