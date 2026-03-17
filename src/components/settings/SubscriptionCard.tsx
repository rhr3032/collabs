import { useEffect, useState } from "react";
import { CreditCard, Loader2, ExternalLink, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const TIERS: Record<string, { name: string; price: string; features: string[] }> = {
  prod_U11FW8gjpxbtNY: {
    name: "Creator",
    price: "$19.99/mo",
    features: ["2 connected accounts", "Unlimited messages", "Advanced auto-tagging", "Priority view & smart filters"],
  },
  prod_U0mdKARhdAgcvt: {
    name: "Pro",
    price: "$49.99/mo",
    features: ["5 connected accounts", "Unlimited messages", "Advanced auto-tagging", "Priority view", "Custom templates"],
  },
  prod_U0mdD8AZgmGUYu: {
    name: "Agency",
    price: "$99.99/mo",
    features: ["Unlimited accounts", "Unlimited messages", "Advanced auto-tagging", "Priority view", "CSV/JSON import", "Priority support"],
  },
};

export function SubscriptionCard() {
  const { subscription, refreshSubscription, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    refreshSubscription().finally(() => setLoading(false));
  }, [refreshSubscription]);

  const openPortal = async () => {
    setPortalLoading(true);
    const { data, error } = await supabase.functions.invoke("customer-portal");
    setPortalLoading(false);
    if (error || !data?.url) {
      toast.error("Failed to open subscription management");
      return;
    }
    window.open(data.url, "_blank");
  };

  const tier = subscription.productId ? TIERS[subscription.productId] : null;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <CreditCard className="h-4 w-4" /> Subscription
        </CardTitle>
        <CardDescription>Manage your plan and billing</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Current Plan */}
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Current Plan</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl font-bold font-display">
                  {subscription.subscribed && tier ? tier.name : isAdmin ? "Admin" : "No Plan"}
                </span>
                {subscription.subscribed && tier && (
                  <Badge variant="secondary">{tier.price}</Badge>
                )}
                {isAdmin && !subscription.subscribed && (
                  <Badge variant="outline" className="border-primary text-primary">Admin Access</Badge>
                )}
              </div>
            </div>
            {subscription.subscribed && (
              <Badge variant="default" className="bg-primary/10 text-primary border-0">Active</Badge>
            )}
          </div>

          {subscription.subscribed && subscription.subscriptionEnd && (
            <p className="text-xs text-muted-foreground mt-3">
              Renews on {new Date(subscription.subscriptionEnd).toLocaleDateString("en-US", {
                year: "numeric", month: "long", day: "numeric",
              })}
            </p>
          )}
        </div>

        {/* Plan Features */}
        {subscription.subscribed && tier && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Your Features</p>
            <ul className="space-y-1.5">
              {tier.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {subscription.subscribed ? (
            <>
              <Button variant="outline" size="sm" onClick={openPortal} disabled={portalLoading}>
                {portalLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Manage Billing
              </Button>
              <Button variant="outline" size="sm" onClick={openPortal} disabled={portalLoading}>
                <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />
                {tier?.name === "Pro" ? "Upgrade to Agency" : "Change Plan"}
              </Button>
            </>
          ) : !isAdmin ? (
            <Button
              size="sm"
              className="gradient-primary border-0"
              onClick={() => window.location.href = "/pricing"}
            >
              Choose a Plan
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => refreshSubscription()}>
            Refresh Status
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
