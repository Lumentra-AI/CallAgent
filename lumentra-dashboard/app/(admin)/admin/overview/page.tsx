const stats = [
  {
    label: "Auth Modes",
    value: "JWT + API key",
    note: "Browser and automation",
  },
  {
    label: "Customer Roles",
    value: "admin / staff",
    note: "Mapped from DB roles",
  },
  {
    label: "Admin Entry",
    value: "/admin/overview",
    note: "Dedicated platform shell",
  },
  {
    label: "Sprint Focus",
    value: "Foundation",
    note: "Auth, layout, role cleanup",
  },
];

export default function AdminOverviewPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Overview
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
          Platform admin foundation
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
          This workspace separates internal platform controls from tenant-facing
          configuration. Sprint 2 establishes the auth boundary, admin shell,
          and corrected role model the rest of the admin panel will build on.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {stat.label}
            </p>
            <p className="mt-3 text-2xl font-semibold text-zinc-950">
              {stat.value}
            </p>
            <p className="mt-2 text-sm text-zinc-600">{stat.note}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">What changed</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
            <div className="grid grid-cols-[1fr,1fr,1fr] bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              <span>Area</span>
              <span>Before</span>
              <span>Now</span>
            </div>
            {[
              {
                area: "Admin auth",
                before: "Internal API key only",
                now: "JWT allowlist or internal API key",
              },
              {
                area: "Tenant roles",
                before: "developer/admin/staff mismatch",
                now: "owner/admin/member/readonly mapped safely",
              },
              {
                area: "Navigation",
                before: "No platform workspace",
                now: "Dedicated admin shell and sidebar",
              },
            ].map((row) => (
              <div
                key={row.area}
                className="grid grid-cols-[1fr,1fr,1fr] border-t border-zinc-200 px-4 py-4 text-sm text-zinc-700"
              >
                <span className="font-medium text-zinc-950">{row.area}</span>
                <span>{row.before}</span>
                <span>{row.now}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">Next phases</h2>
          <div className="mt-4 space-y-3">
            {[
              "Tenant management surfaces land in P3.",
              "Growth and usage metrics land in P4.",
              "Operational health, port requests, and active call tooling land in P5.",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
