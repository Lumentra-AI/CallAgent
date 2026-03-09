const tenantColumns = [
  ["Tenant", "Status", "Plan", "Primary Owner", "Health"],
  [
    "Northwind Dental",
    "Active",
    "Professional",
    "owner@example.com",
    "Healthy",
  ],
  ["Harbor Suites", "Suspended", "Starter", "ops@example.com", "Needs review"],
  ["Willow Salon", "Trial", "Starter", "sales@example.com", "Provisioning"],
];

export default function AdminTenantsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Tenants
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
          Tenant management shell
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
          This section is the landing zone for platform-wide tenant controls:
          lifecycle status, subscription tiering, owner visibility, and future
          support tooling.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          [
            "Lifecycle",
            "Provision, suspend, reactivate, and audit tenant states.",
          ],
          [
            "Entitlements",
            "Tier and feature management will move here from customer-only UI.",
          ],
          [
            "Support",
            "Internal test-account and break-glass actions will live here.",
          ],
        ].map(([title, body]) => (
          <div
            key={title}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{body}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-950">Preview table</h2>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
            P3 target
          </span>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
          {tenantColumns.map((row, rowIndex) => (
            <div
              key={row.join("-")}
              className={`grid grid-cols-5 gap-4 px-4 py-3 text-sm ${
                rowIndex === 0
                  ? "bg-zinc-50 font-semibold uppercase tracking-[0.18em] text-zinc-500"
                  : "border-t border-zinc-200 text-zinc-700"
              }`}
            >
              {row.map((cell) => (
                <div key={cell} className={rowIndex === 0 ? "text-xs" : ""}>
                  {cell}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
