import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionInfo {
  subscribed: boolean;
  productId: string | null;
  subscriptionEnd: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  waiverAccepted: boolean;
  setWaiverAccepted: (v: boolean) => void;
  subscription: SubscriptionInfo;
  isAdmin: boolean;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo>({
    subscribed: false,
    productId: null,
    subscriptionEnd: null,
  });

  useEffect(() => {
    const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => sub.unsubscribe();
  }, []);

  // Check waiver status + admin role + cached subscription when user logs in
  useEffect(() => {
    if (!session?.user) {
      setWaiverAccepted(false);
      setIsAdmin(false);
      setSubscription({ subscribed: false, productId: null, subscriptionEnd: null });
      setDataLoading(false);
      return;
    }

    setDataLoading(true);

    const loadData = async () => {
      try {
        const [waiverResult, roleResult, subResult] = await Promise.all([
          supabase
            .from("waiver_acceptances")
            .select("id")
            .eq("user_id", session.user.id)
            .eq("waiver_type", "liability")
            .maybeSingle(),
          supabase
            .from("user_roles" as any)
            .select("role")
            .eq("user_id", session.user.id)
            .eq("role", "admin")
            .maybeSingle(),
          supabase
            .from("subscriptions")
            .select("status, product_id, current_period_end, canceled_at")
            .eq("user_id", session.user.id)
            .maybeSingle(),
        ]);

        setWaiverAccepted(!!waiverResult.data);
        setIsAdmin(!!(roleResult as any).data);

        if (subResult.data && subResult.data.status === "active") {
          setSubscription({
            subscribed: true,
            productId: subResult.data.product_id,
            subscriptionEnd: subResult.data.current_period_end,
          });
        }
      } catch (e) {
        console.error("Failed to load user data:", e);
      } finally {
        setDataLoading(false);
      }
    };

    loadData();
  }, [session?.user?.id]);

  const refreshSubscription = useCallback(async () => {
    if (!session?.user) return;
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (!error && data) {
        setSubscription({
          subscribed: data.subscribed,
          productId: data.product_id,
          subscriptionEnd: data.subscription_end,
        });

        // Also sync to DB cache
        if (data.subscribed) {
          await supabase.from("subscriptions" as any).upsert({
            user_id: session.user.id,
            product_id: data.product_id,
            status: "active",
            current_period_end: data.subscription_end,
          } as any, { onConflict: "user_id" });
        }
      }
    } catch (e) {
      console.error("Failed to check subscription:", e);
    }
  }, [session?.user]);

  // Check subscription on login and periodically
  useEffect(() => {
    if (!session?.user) return;
    refreshSubscription();
    const interval = setInterval(refreshSubscription, 60000);
    return () => clearInterval(interval);
  }, [session?.user?.id, refreshSubscription]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      loading: loading || dataLoading,
      signOut,
      waiverAccepted,
      setWaiverAccepted,
      subscription,
      isAdmin,
      refreshSubscription,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
