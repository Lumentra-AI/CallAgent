"use client";

import React, { useState } from "react";
import { useConfig } from "@/context/ConfigContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CreditCard,
  Check,
  AlertCircle,
  Download,
  Calendar,
  Zap,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubscriptionTier } from "@/types";

// ============================================================================
// SUBSCRIPTION TIERS (Display only - pricing controlled by admin)
// ============================================================================

const TIER_FEATURES: Record<
  SubscriptionTier,
  { name: string; features: string[] }
> = {
  starter: {
    name: "Starter",
    features: [
      "Up to 500 calls/month",
      "Basic AI responses",
      "Email support",
      "Standard voice options",
    ],
  },
  professional: {
    name: "Professional",
    features: [
      "Up to 2,500 calls/month",
      "Advanced AI with sentiment analysis",
      "Priority support",
      "Premium voice options",
      "Custom greetings",
      "SMS confirmations",
    ],
  },
  enterprise: {
    name: "Enterprise",
    features: [
      "Unlimited calls",
      "Full AI capabilities",
      "Dedicated support",
      "All voice options",
      "Custom integrations",
      "Multi-location support",
      "SLA guarantee",
    ],
  },
};

// ============================================================================
// BILLING TAB COMPONENT
// ============================================================================

export default function BillingTab() {
  const { config, updateConfig } = useConfig();
  const [isAddingCard, setIsAddingCard] = useState(false);

  if (!config) return null;

  const { subscription, billing } = config;

  // Mock subscription for demo
  const currentSubscription = subscription || {
    id: "sub_demo",
    tier: "professional" as SubscriptionTier,
    status: "active" as const,
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    cancelAtPeriodEnd: false,
  };

  // Mock billing for demo
  const currentBilling = billing || {
    customerId: "cus_demo",
    billingEmail: "billing@example.com",
    autoPayEnabled: true,
    invoices: [
      {
        id: "inv_001",
        amount: 299,
        currency: "USD",
        status: "paid" as const,
        createdAt: new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        paidAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "inv_002",
        amount: 299,
        currency: "USD",
        status: "paid" as const,
        createdAt: new Date(
          Date.now() - 60 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        paidAt: new Date(Date.now() - 59 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };

  const tierInfo = TIER_FEATURES[currentSubscription.tier];

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white">
          Billing & Subscription
        </h3>
        <p className="text-sm text-zinc-500">
          Manage your payment methods and view invoices
        </p>
      </div>

      {/* Current Plan */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <h4 className="text-sm font-medium text-white">Current Plan</h4>
        </div>

        <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20">
                <Zap className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-white">
                    {tierInfo.name}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
                      currentSubscription.status === "active"
                        ? "bg-green-500/20 text-green-400"
                        : currentSubscription.status === "trialing"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-red-500/20 text-red-400",
                    )}
                  >
                    {currentSubscription.status}
                  </span>
                </div>
                <div className="text-xs text-zinc-500">
                  Next billing date:{" "}
                  {new Date(
                    currentSubscription.currentPeriodEnd,
                  ).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {tierInfo.features.map((feature, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs text-zinc-400"
              >
                <Check className="h-3 w-3 text-indigo-400" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-zinc-600">
          Contact support to change your plan or discuss custom pricing options.
        </p>
      </section>

      {/* Payment Method */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <h4 className="text-sm font-medium text-white">Payment Method</h4>
        </div>

        {currentBilling.paymentMethodLast4 ? (
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800">
                <CreditCard className="h-5 w-5 text-zinc-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">
                  {currentBilling.paymentMethodBrand || "Card"} ending in{" "}
                  {currentBilling.paymentMethodLast4}
                </div>
                <div className="text-xs text-zinc-500">
                  Default payment method
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-white"
            >
              Update
            </Button>
          </div>
        ) : isAddingCard ? (
          <AddPaymentMethodForm onCancel={() => setIsAddingCard(false)} />
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center">
            <CreditCard className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
            <p className="mb-4 text-sm text-zinc-400">
              No payment method on file
            </p>
            <Button
              onClick={() => setIsAddingCard(true)}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Add Payment Method
            </Button>
          </div>
        )}
      </section>

      {/* Auto-Pay */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div>
            <h4 className="text-sm font-medium text-white">Auto-Pay</h4>
            <p className="text-xs text-zinc-600">
              Automatically charge your payment method each billing cycle
            </p>
          </div>
          <button
            onClick={() => {
              if (config.billing) {
                updateConfig("billing", {
                  ...config.billing,
                  autoPayEnabled: !config.billing.autoPayEnabled,
                });
              }
            }}
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors",
              currentBilling.autoPayEnabled ? "bg-indigo-600" : "bg-zinc-700",
            )}
          >
            <div
              className={cn(
                "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                currentBilling.autoPayEnabled && "translate-x-5",
              )}
            />
          </button>
        </div>

        {currentBilling.autoPayEnabled && (
          <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
            <Shield className="h-4 w-4 text-green-500" />
            <span className="text-xs text-green-400">
              Auto-pay is enabled. Your payment will be processed automatically.
            </span>
          </div>
        )}
      </section>

      {/* Billing Email */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <h4 className="text-sm font-medium text-white">Billing Email</h4>
          <p className="text-xs text-zinc-600">
            Invoices and receipts will be sent to this email
          </p>
        </div>

        <div className="flex gap-3">
          <Input
            value={currentBilling.billingEmail}
            onChange={(e) => {
              if (config.billing) {
                updateConfig("billing", {
                  ...config.billing,
                  billingEmail: e.target.value,
                });
              }
            }}
            type="email"
            className="max-w-sm border-zinc-800 bg-zinc-950 text-white"
            placeholder="billing@company.com"
          />
          <Button
            variant="outline"
            className="border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-white"
          >
            Update
          </Button>
        </div>
      </section>

      {/* Invoice History */}
      <section className="space-y-4">
        <div className="border-b border-zinc-800 pb-2">
          <h4 className="text-sm font-medium text-white">Invoice History</h4>
        </div>

        <div className="space-y-2">
          {currentBilling.invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800">
                  <Calendar className="h-5 w-5 text-zinc-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    ${invoice.amount.toFixed(2)} {invoice.currency}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {new Date(invoice.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
                    invoice.status === "paid"
                      ? "bg-green-500/20 text-green-400"
                      : invoice.status === "open"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-red-500/20 text-red-400",
                  )}
                >
                  {invoice.status}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-400 hover:text-white"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {currentBilling.invoices.length === 0 && (
            <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center">
              <p className="text-sm text-zinc-500">No invoices yet</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// ADD PAYMENT METHOD FORM
// ============================================================================

function AddPaymentMethodForm({ onCancel }: { onCancel: () => void }) {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(" ");
    } else {
      return value;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return v.substring(0, 2) + "/" + v.substring(2, 4);
    }
    return v;
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-4 flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-zinc-400" />
        <span className="text-sm font-medium text-white">Add Card</span>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-zinc-400">Card Number</Label>
          <Input
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            placeholder="1234 5678 9012 3456"
            maxLength={19}
            className="border-zinc-700 bg-zinc-800 font-mono text-white"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-zinc-400">Expiry</Label>
            <Input
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              placeholder="MM/YY"
              maxLength={5}
              className="border-zinc-700 bg-zinc-800 font-mono text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-400">CVC</Label>
            <Input
              value={cvc}
              onChange={(e) =>
                setCvc(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))
              }
              placeholder="123"
              maxLength={4}
              type="password"
              className="border-zinc-700 bg-zinc-800 font-mono text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Shield className="h-3 w-3" />
          <span>Your payment info is encrypted and secure</span>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            className="border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-white"
          >
            Cancel
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700">
            Save Card
          </Button>
        </div>
      </div>
    </div>
  );
}
