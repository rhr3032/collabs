import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const TIERS = {
  Creator: {
    price_id: "price_1T3qZwK75rZnnjXun4vvfgT1",
    product_id: "prod_U1uOBuzmugIgNv",
  },
  Pro: {
    price_id: "price_1T3qa8K75rZnnjXucFKVKaHD",
    product_id: "prod_U1uOhW7EC3kRqW",
  },
  Agency: {
    price_id: "price_1T3qaJK75rZnnjXuambFog8s",
    product_id: "prod_U1uPXknueNKFZ8",
  },
};

const plans = [
  {
    name: "Creator",
    price: "$7.99",
    period: "/mo",
    description: "For creators just getting started",
    features: [
      "2 connected accounts",
      "Unlimited messages",
      "Advanced auto-tagging",
      "Priority view & smart filters",
      "Email support",
    ],
    cta: "Subscribe to Creator",
    highlighted: false,
    badge: "Great for beginners",
    badgeClass: "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-md shadow-orange-500/25",
  },
  {
    name: "Pro",
    price: "$19.99",
    period: "/mo",
    description: "For growing creators who need more",
    features: [
      "5 connected accounts",
      "Unlimited messages",
      "Advanced auto-tagging",
      "Priority view & smart filters",
      "Custom reply templates",
      "Email support",
    ],
    cta: "Subscribe to Pro",
    highlighted: true,
    badge: "Most Popular",
    badgeClass: "gradient-primary text-white shadow-md shadow-purple-500/25",
  },
  {
    name: "Agency",
    price: "$89.99",
    period: "/mo",
    description: "For professionals managing high volume",
    features: [
      "Unlimited connected accounts",
      "Unlimited messages",
      "Advanced auto-tagging",
      "Priority view & smart filters",
      "Unlimited reply templates",
      "CSV / JSON data import",
      "Priority support",
    ],
    cta: "Subscribe to Agency",
    highlighted: false,
    badge: "For Pros/teams",
    badgeClass: "bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-md shadow-pink-500/25",
  },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const { user, waiverAccepted, setWaiverAccepted } = useAuth();
  const { subscription, loading } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Redirect subscribed users straight to inbox
  useEffect(() => {
    if (!loading && subscription.subscribed) {
      navigate("/app/inbox", { replace: true });
    }
  }, [loading, subscription.subscribed, navigate]);

  const handleSelect = (planName: string) => {
    setAccepted(false);
    setSelectedPlan(planName);
  };

  const handleConfirm = async () => {
    if (!user) return;
    setSaving(true);

    const tier = TIERS[selectedPlan as keyof typeof TIERS];
    if (!tier) {
      setSaving(false);
      toast.error("Please select a plan to continue.");
      return;
    }

    // Run waiver save and checkout creation in parallel
    const waiverPromise = waiverAccepted
      ? Promise.resolve(true)
      : (async () => {
          const { data: existing } = await supabase
            .from("waiver_acceptances")
            .select("id")
            .eq("user_id", user.id)
            .eq("waiver_type", "liability")
            .maybeSingle();
          if (!existing) {
            const { error } = await supabase
              .from("waiver_acceptances")
              .insert({ user_id: user.id, waiver_type: "liability" });
            if (error) return false;
          }
          return true;
        })();

    const checkoutPromise = supabase.functions.invoke("create-checkout", {
      body: { priceId: tier.price_id },
    });

    const [waiverOk, checkoutResult] = await Promise.all([waiverPromise, checkoutPromise]);

    setSaving(false);

    if (!waiverOk) {
      toast.error("Failed to save waiver acceptance");
      return;
    }
    setWaiverAccepted(true);

    if (checkoutResult.error || !checkoutResult.data?.url) {
      toast.error("Failed to start checkout. Please try again.");
      return;
    }
    window.location.href = checkoutResult.data.url;
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      <div className="mb-12 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Choose your plan
        </h1>
        <p className="mt-3 text-muted-foreground">
          Pick the plan that fits your creator workflow. Upgrade anytime.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Prices may vary depending on the amount of people.
        </p>
      </div>

      <div className="grid w-full max-w-4xl gap-6 sm:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              "relative flex flex-col rounded-2xl border p-6 transition-shadow",
              plan.highlighted
                ? "border-primary shadow-lg shadow-primary/10"
                : "border-border"
            )}
          >
            {plan.badge && (
              <span className={cn("absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold", plan.badgeClass)}>
                {plan.badge}
              </span>
            )}
            <h2 className="font-display text-xl font-semibold">{plan.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="font-display text-4xl font-bold">{plan.price}</span>
              <span className="text-sm text-muted-foreground">{plan.period}</span>
            </div>
            <ul className="mt-6 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              className={cn(
                "mt-8 w-full",
                plan.highlighted ? "gradient-primary border-0" : ""
              )}
              variant={plan.highlighted ? "default" : "outline"}
              onClick={() => handleSelect(plan.name)}
            >
              {plan.cta}
            </Button>
          </div>
        ))}
      </div>

      {/* Liability Waiver Dialog */}
      <Dialog open={!!selectedPlan} onOpenChange={(open) => !open && setSelectedPlan(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Liability Waiver & Terms</DialogTitle>
            <DialogDescription>
              Please review and accept before continuing with the {selectedPlan} plan.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-56 rounded-lg border border-border p-4 text-sm leading-relaxed text-muted-foreground">
            <div className="space-y-3">
              <p className="font-semibold text-foreground">Collabs Liability Waiver & Terms of Service</p>
              <p>By proceeding, you acknowledge and agree to the following:</p>
              <p><strong>1. Platform Independence.</strong> Collabs is an independent service and is not affiliated with, endorsed by, or sponsored by any social media platform including but not limited to Instagram, TikTok, X (Twitter), YouTube, or Facebook.</p>
              <p><strong>2. Account Responsibility.</strong> You are solely responsible for the security and activity of any social media or email accounts you connect to Collabs. Collabs is not liable for any unauthorized access, data loss, account suspension, or actions taken by third-party platforms.</p>
              <p><strong>3. Data Handling.</strong> Collabs accesses your messages solely for organizing, tagging, and displaying them. We do not sell or distribute your content. You may disconnect and delete data at any time.</p>
              <p><strong>4. No Guaranteed Outcomes.</strong> Auto-tagging and priority classification may not be 100% accurate. Collabs does not guarantee that all brand collaborations will be correctly identified.</p>
              <p><strong>5. Limitation of Liability.</strong> To the maximum extent permitted by law, Collabs shall not be held liable for any indirect, incidental, or consequential damages arising from use of the service.</p>
              <p><strong>6. Subscription & Cancellation.</strong> Paid plans are billed monthly. You may cancel at any time; access continues until the end of the billing period.</p>
            </div>
          </ScrollArea>
          <div className="flex items-start gap-2 pt-2">
            <Checkbox
              id="waiver"
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
            />
            <label htmlFor="waiver" className="text-sm leading-snug cursor-pointer">
              I have read and agree to the Collabs Liability Waiver & Terms of Service.
            </label>
          </div>
          <Button
            className="w-full gradient-primary border-0"
            disabled={!accepted || saving}
            onClick={handleConfirm}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {selectedPlan === "Free" ? "Continue with Free" : `Subscribe to ${selectedPlan}`}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
