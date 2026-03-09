const analyticsCards = [
  {
    label: "Tenant Growth",
    value: "+18%",
    note: "Month-over-month active tenants",
  },
  { label: "Call Volume", value: "42.1k", note: "Platform-wide handled calls" },
  { label: "Conversion", value: "31%", note: "Bookings or qualified captures" },
  {
    label: "Escalations",
    value: "4.7%",
    note: "Calls requiring human intervention",
  },
];

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Analytics
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
          Platform metrics shell
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
          Admin analytics will consolidate tenant growth, call throughput,
          revenue signals, and operational conversion funnels in one neutral,
          internal-facing workspace.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {analyticsCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {card.label}
            </p>
            <p className="mt-3 text-2xl font-semibold text-zinc-950">
              {card.value}
            </p>
            <p className="mt-2 text-sm text-zinc-600">{card.note}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">
            Planned dashboards
          </h2>
          <div className="mt-4 space-y-3">
            {[
              "New tenants, churned tenants, and trial-to-paid conversion.",
              "Call minutes, bookings, missed-call recovery, and revenue by tenant.",
              "Industry and feature adoption trends for product planning.",
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

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">
            Data contracts
          </h2>
          <div className="mt-4 grid gap-3">
            {[
              [
                "Growth",
                "Tenant creation, onboarding completion, subscription state",
              ],
              ["Usage", "Calls, minutes, escalations, booking outcomes"],
              ["Commercial", "Tier, spend, feature adoption, support burden"],
            ].map(([title, body]) => (
              <div
                key={title}
                className="rounded-2xl border border-zinc-200 px-4 py-3"
              >
                <p className="text-sm font-medium text-zinc-950">{title}</p>
                <p className="mt-1 text-sm text-zinc-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
