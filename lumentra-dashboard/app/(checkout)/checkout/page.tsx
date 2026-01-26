"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { motion } from "framer-motion";
import { Zap, Check, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STRIPE_CONFIG } from "@/lib/stripe/config";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan") || "professional";
  const plan =
    STRIPE_CONFIG.plans[planParam as keyof typeof STRIPE_CONFIG.plans];
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCheckout = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planParam,
          successUrl: `${window.location.origin}/success`,
          cancelUrl: `${window.location.origin}/checkout?plan=${planParam}`,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setIsLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  if (!plan) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Invalid Plan</h1>
          <p className="mt-2 text-muted-foreground">
            The selected plan does not exist.
          </p>
          <Link href="/pricing">
            <Button className="mt-4">View Plans</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <Link
          href="/#pricing"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to pricing
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Lumentra {plan.name}</h1>
              <p className="text-sm text-muted-foreground">
                Start your 14-day free trial
              </p>
            </div>
          </div>

          <div className="mb-6 pb-6 border-b border-border">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Plan price</span>
              <div>
                <span className="text-3xl font-bold">${plan.price}</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Billed monthly. Cancel anytime.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3">What you get:</h3>
            <ul className="space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <Button
            onClick={handleCheckout}
            disabled={isLoading}
            className="w-full h-12 text-base"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting to checkout...
              </>
            ) : (
              "Start Free Trial"
            )}
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-foreground">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </motion.div>
    </div>
  );
}
