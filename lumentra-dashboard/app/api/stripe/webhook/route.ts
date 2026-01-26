import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";

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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("[STRIPE] Checkout completed:", session.id);

        // Update tenant with subscription info
        const tenantId = session.metadata?.tenantId;
        const plan = session.metadata?.plan;

        if (tenantId) {
          // Call your backend API to update the tenant
          await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/tenants/${tenantId}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
                subscription_tier: plan || "professional",
              }),
            },
          );
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("[STRIPE] Subscription updated:", subscription.id);

        // Handle plan changes
        const tenantId = subscription.metadata?.tenantId;
        if (tenantId) {
          const status = subscription.status;
          await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/tenants/${tenantId}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subscription_status: status,
              }),
            },
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("[STRIPE] Subscription cancelled:", subscription.id);

        const tenantId = subscription.metadata?.tenantId;
        if (tenantId) {
          await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/tenants/${tenantId}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subscription_tier: "free",
                subscription_status: "cancelled",
              }),
            },
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("[STRIPE] Payment failed:", invoice.id);
        // Handle failed payment - notify customer, retry, etc.
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("[STRIPE] Invoice paid:", invoice.id);
        // Record payment in your system
        break;
      }

      default:
        console.log("[STRIPE] Unhandled event type:", event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
