import { NextResponse } from "next/server";
import Stripe from "stripe";
import { STRIPE_CONFIG } from "@/lib/stripe/config";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(key, {
    apiVersion: "2025-12-15.clover",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { priceId, plan, email, tenantId, successUrl, cancelUrl } = body;

    // Get the price ID from config if plan name is provided
    const stripePriceId =
      priceId ||
      STRIPE_CONFIG.prices[plan as keyof typeof STRIPE_CONFIG.prices];

    if (!stripePriceId) {
      return NextResponse.json(
        { error: "Invalid plan specified" },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      customer_email: email,
      metadata: {
        tenantId: tenantId || "",
        plan: plan || "",
      },
      success_url:
        successUrl ||
        `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      subscription_data: {
        metadata: {
          tenantId: tenantId || "",
          plan: plan || "",
        },
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
