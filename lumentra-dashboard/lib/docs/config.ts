export interface GuideConfig {
  slug: string;
  title: string;
  description: string;
  filename: string;
  iconName: string;
  order: number;
}

export const guides: GuideConfig[] = [
  {
    slug: "admin",
    title: "Admin Guide",
    description:
      "Tenant management, user roles, permissions, system configuration, database schema, and monitoring.",
    filename: "admin-guide.md",
    iconName: "Shield",
    order: 1,
  },
  {
    slug: "voice-agent",
    title: "Voice Agent Management",
    description:
      "Voice AI configuration, STT/TTS/LLM settings, call flows, tool execution, and multi-language support.",
    filename: "voice-agent-guide.md",
    iconName: "Phone",
    order: 2,
  },
  {
    slug: "crm",
    title: "CRM User Guide",
    description:
      "Contacts, deals, tasks, engagement scoring, post-call automation, and industry-specific pipelines.",
    filename: "crm-user-guide.md",
    iconName: "Users",
    order: 3,
  },
  {
    slug: "deployment",
    title: "Deployment Guide",
    description:
      "Server provisioning, Docker, Coolify, LiveKit stack, SIP trunking, SSL, DNS, and scaling.",
    filename: "deployment-guide.md",
    iconName: "Server",
    order: 4,
  },
  {
    slug: "technical",
    title: "Technical Documentation",
    description:
      "Architecture overview, API reference, database schema, voice pipeline internals, and data flow.",
    filename: "technical-documentation.md",
    iconName: "Code",
    order: 5,
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting Manual",
    description:
      "50+ error scenarios, voice call debugging, API errors, log analysis, and disaster recovery.",
    filename: "troubleshooting-manual.md",
    iconName: "AlertTriangle",
    order: 6,
  },
];

export function getGuideBySlug(slug: string): GuideConfig | undefined {
  return guides.find((g) => g.slug === slug);
}
