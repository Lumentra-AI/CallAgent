const queues = [
  ["Port Requests", "Carrier handoffs, approvals, and completion checks"],
  [
    "System Health",
    "API uptime, queue depth, background jobs, and LiveKit health",
  ],
  ["Active Calls", "Real-time operational visibility and escalation volume"],
];

export default function AdminOperationsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Operations
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
          Operational control shell
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
          Platform operations will centralize porting workflows, environment
          health, alerts, and live call monitoring so the internal team can run
          the system without developer-only access patterns.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {queues.map(([title, body]) => (
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
          <h2 className="text-lg font-semibold text-zinc-950">
            Runbook targets
          </h2>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
            P5 target
          </span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            "Escalation queue and human takeover pressure by tenant.",
            "Background jobs, retry depth, and notification failures.",
            "LiveKit stack health and SIP ingress status.",
            "Port request SLA tracking with owner and blocker visibility.",
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-700"
            >
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
