import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    return new Response("Missing Stripe keys", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  console.log(`[STRIPE-WEBHOOK] Event: ${event.type}`);

  const relevantEvents = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ];

  if (!relevantEvents.includes(event.type)) {
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerEmail = session.customer_details?.email || session.customer_email;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (customerEmail && subscriptionId) {
        // Get user by email
        const { data: users } = await supabaseClient.auth.admin.listUsers();
        const user = users?.users?.find((u) => u.email === customerEmail);

        if (user) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const startTs = subscription.current_period_start;
          const endTs = subscription.current_period_end;
          await supabaseClient.from("subscriptions").upsert({
            user_id: user.id,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            product_id: subscription.items.data[0]?.price?.product as string,
            status: subscription.status,
            current_period_start: startTs && typeof startTs === 'number' ? new Date(startTs * 1000).toISOString() : null,
            current_period_end: endTs && typeof endTs === 'number' ? new Date(endTs * 1000).toISOString() : null,
          }, { onConflict: "user_id" });

          // Record payment history
          const amountTotal = session.amount_total ?? 0;
          await supabaseClient.from("payment_history").insert({
            user_id: user.id,
            stripe_payment_intent_id: session.payment_intent as string,
            stripe_invoice_id: session.invoice as string,
            amount_cents: amountTotal,
            currency: session.currency ?? "usd",
            status: "succeeded",
            product_id: subscription.items.data[0]?.price?.product as string,
            description: `Checkout: ${subscription.items.data[0]?.price?.product}`,
          });

          console.log(`[STRIPE-WEBHOOK] Subscription + payment history synced for user ${user.id}`);
        }
      }
    }

    if (event.type.startsWith("customer.subscription.")) {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const customer = await stripe.customers.retrieve(customerId);

      if ("email" in customer && customer.email) {
        const { data: users } = await supabaseClient.auth.admin.listUsers();
        const user = users?.users?.find((u) => u.email === customer.email);

        if (user) {
          const startTs2 = subscription.current_period_start;
          const endTs2 = subscription.current_period_end;
          await supabaseClient.from("subscriptions").upsert({
            user_id: user.id,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            product_id: subscription.items.data[0]?.price?.product as string,
            status: subscription.status,
            current_period_start: startTs2 && typeof startTs2 === 'number' ? new Date(startTs2 * 1000).toISOString() : null,
            current_period_end: endTs2 && typeof endTs2 === 'number' ? new Date(endTs2 * 1000).toISOString() : null,
            canceled_at: subscription.canceled_at && typeof subscription.canceled_at === 'number'
              ? new Date(subscription.canceled_at * 1000).toISOString()
              : null,
          }, { onConflict: "user_id" });
          console.log(`[STRIPE-WEBHOOK] Subscription ${event.type} synced for user ${user.id}`);
        }
      }
    }
  } catch (error) {
    console.error("[STRIPE-WEBHOOK] Error processing event:", error);
    return new Response(JSON.stringify({ error: "Processing failed" }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
