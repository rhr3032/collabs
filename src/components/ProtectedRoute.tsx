import { Navigate, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useRef } from "react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, subscription, isAdmin, waiverAccepted, refreshSubscription } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isPostCheckoutParam = searchParams.get("checkout") === "success";
  const [checkoutPending, setCheckoutPending] = useState(isPostCheckoutParam);
  const abortRef = useRef(false);

  const isPostCheckout = isPostCheckoutParam;

  // After Stripe checkout, immediately set pending and poll until subscription is confirmed
  useEffect(() => {
    if (isPostCheckout && user) {
      if (subscription.subscribed) {
        // Already confirmed, no need to poll
        return;
      }
      abortRef.current = false;
      setCheckoutPending(true);
      const poll = async () => {
        for (let i = 0; i < 15; i++) {
          if (abortRef.current) return;
          await refreshSubscription();
          await new Promise((r) => setTimeout(r, 2000));
          if (abortRef.current) return;
        }
        setCheckoutPending(false);
      };
      poll();
      return () => { abortRef.current = true; };
    }
  }, [isPostCheckout, user]);

  // Once subscription confirmed, stop polling and clean URL
  useEffect(() => {
    if (subscription.subscribed && checkoutPending) {
      abortRef.current = true;
      setCheckoutPending(false);
      // Clean the checkout param from URL
      navigate(window.location.pathname, { replace: true });
    }
  }, [subscription.subscribed, checkoutPending, navigate]);

  if (loading || checkoutPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        {checkoutPending && (
          <p className="ml-3 text-sm text-muted-foreground">Confirming your subscription...</p>
        )}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admins bypass everything
  if (isAdmin) {
    return <>{children}</>;
  }

  // If no active subscription, redirect to pricing
  if (!subscription.subscribed) {
    return <Navigate to="/pricing" replace />;
  }

  // If subscription active but waiver not accepted, redirect to pricing to accept
  // Skip this check when returning from Stripe checkout (waiver was accepted before checkout)
  if (!waiverAccepted && !isPostCheckout) {
    return <Navigate to="/pricing" replace />;
  }

  return <>{children}</>;
}
