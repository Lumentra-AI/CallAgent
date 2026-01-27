export const STRIPE_CONFIG = {
  prices: {
    starter: process.env.STRIPE_STARTER_PRICE_ID || "price_starter",
    professional: process.env.STRIPE_PRO_PRICE_ID || "price_pro",
    enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || "price_enterprise",
  },
  plans: {
    starter: {
      name: "Starter",
      price: 99,
      calls: 500,
      features: [
        "500 calls/month",
        "Basic AI responses",
        "Email support",
        "Standard voices",
        "Basic analytics",
        "1 phone number",
      ],
    },
    professional: {
      name: "Professional",
      price: 299,
      calls: 2500,
      features: [
        "2,500 calls/month",
        "Advanced AI + sentiment",
        "Priority support",
        "Premium voices",
        "Custom greetings",
        "SMS confirmations",
        "Live call takeover",
        "3 phone numbers",
      ],
    },
    enterprise: {
      name: "Enterprise",
      price: null,
      calls: -1,
      features: [
        "Unlimited calls",
        "Full AI capabilities",
        "Dedicated support",
        "Custom integrations",
        "Multi-location",
        "SLA guarantee",
        "White-label option",
        "Unlimited numbers",
      ],
    },
  },
};
