import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Link2, Instagram, Twitter, Facebook, Mail, Check, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Platform } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { supabase } from "@/integrations/supabase/client";

interface PlatformInfo {
  name: string;
  platform: Platform;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  connected: boolean;
  username?: string;
  messageCount?: number;
  lastSync?: string;
}

const TikTokIcon = ({ className }: { className?: string }) => (
  <span className={`text-lg font-bold leading-none ${className}`}>T</span>
);

export default function AccountsPage() {
  const { waiverAccepted, session } = useAuth();
  const isDemo = useDemo();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connectingLoading, setConnectingLoading] = useState<Platform | null>(null);
  const [syncingPlatform, setSyncingPlatform] = useState<Platform | null>(null);

  // Handle OAuth redirect params
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) {
      toast.success(`${connected.charAt(0).toUpperCase() + connected.slice(1)} connected successfully!`);
      setSearchParams({}, { replace: true });
    }
    if (error) {
      toast.error(`Connection failed: ${error.replace(/_/g, " ")}`);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [platforms, setPlatforms] = useState<PlatformInfo[]>([
    { name: "Instagram", platform: "instagram", icon: Instagram, color: "bg-pink-500/10 text-pink-500", connected: isDemo, username: isDemo ? "@creator_demo" : undefined, messageCount: isDemo ? 5 : undefined },
    { name: "TikTok", platform: "tiktok", icon: TikTokIcon, color: "bg-foreground/10 text-foreground", connected: isDemo, username: isDemo ? "@creator_demo" : undefined, messageCount: isDemo ? 3 : undefined },
    { name: "X (Twitter)", platform: "twitter", icon: Twitter, color: "bg-sky-500/10 text-sky-500", connected: isDemo, username: isDemo ? "@creator_demo" : undefined, messageCount: isDemo ? 2 : undefined },
    { name: "Facebook", platform: "facebook", icon: Facebook, color: "bg-blue-600/10 text-blue-600", connected: false },
    { name: "Gmail", platform: "gmail", icon: Mail, color: "bg-red-500/10 text-red-500", connected: isDemo, username: isDemo ? "creator@demo.com" : undefined, messageCount: isDemo ? 1 : undefined },
  ]);

  // Fetch connected accounts from DB
  useEffect(() => {
    if (isDemo) { setLoading(false); return; }
    if (!session?.user) return;

    const fetchAccounts = async () => {
      setLoading(true);
      const { data: accounts } = await supabase
        .from("connected_accounts")
        .select("*")
        .eq("user_id", session.user.id);

      const { data: msgCounts } = await supabase
        .from("messages")
        .select("platform")
        .eq("user_id", session.user.id);

      const countMap: Record<string, number> = {};
      msgCounts?.forEach((m: any) => {
        countMap[m.platform] = (countMap[m.platform] || 0) + 1;
      });

      setPlatforms((prev) =>
        prev.map((p) => {
          const account = accounts?.find((a: any) => a.platform === p.platform);
          if (account) {
            return {
              ...p,
              connected: true,
              username: account.username || "@connected",
              messageCount: countMap[p.platform] || 0,
              lastSync: account.last_sync_at,
            };
          }
          return { ...p, connected: false, username: undefined, messageCount: undefined, lastSync: undefined };
        })
      );
      setLoading(false);
    };

    fetchAccounts();
  }, [session?.user?.id]);

  const handleConnect = async (platform: Platform) => {
    if (!waiverAccepted) {
      toast.error("Please accept the liability waiver on the pricing page first.");
      return;
    }

    setConnectingLoading(platform);

    try {
      // Twitter uses its own OAuth 1.0a flow
      if (platform === "twitter") {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          toast.error("Please log in first");
          setConnectingLoading(null);
          return;
        }

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/twitter-oauth?action=authorize&redirect_origin=${encodeURIComponent(window.location.origin)}`,
          {
            headers: {
              Authorization: `Bearer ${currentSession.access_token}`,
            },
          }
        );

        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          toast.error(data.error || "Failed to start Twitter authorization");
        }
        setConnectingLoading(null);
        return;
      }

      // All other platforms use the oauth-connect edge function
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        toast.error("Please log in first");
        setConnectingLoading(null);
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/oauth-connect?action=authorize&platform=${platform}&redirect_origin=${encodeURIComponent(window.location.origin)}`,
        {
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
          },
        }
      );

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || `Failed to start ${platform} authorization`);
      }
    } catch (err) {
      toast.error(`Failed to connect to ${platform}`);
    }
    setConnectingLoading(null);
  };

  const handleDisconnect = async (platform: Platform) => {
    if (!session?.user) return;
    const { error } = await supabase
      .from("connected_accounts")
      .delete()
      .eq("user_id", session.user.id)
      .eq("platform", platform);

    if (!error) {
      setPlatforms((prev) =>
        prev.map((p) =>
          p.platform === platform
            ? { ...p, connected: false, username: undefined, messageCount: undefined, lastSync: undefined }
            : p
        )
      );
      toast.success("Account disconnected");
    } else {
      toast.error("Failed to disconnect");
    }
  };

  const handleSync = async (platform: Platform) => {
    setSyncingPlatform(platform);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/fetch-messages?platform=${platform}`,
        {
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
          },
        }
      );

      const data = await res.json();
      if (data.success) {
        toast.success(`Synced ${data.count} messages from ${platform}`);
        const { data: msgCounts } = await supabase
          .from("messages")
          .select("platform")
          .eq("user_id", currentSession.user.id)
          .eq("platform", platform);

        setPlatforms((prev) =>
          prev.map((p) =>
            p.platform === platform
              ? { ...p, messageCount: msgCounts?.length || 0, lastSync: new Date().toISOString() }
              : p
          )
        );
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch (err) {
      toast.error("Sync failed");
    }
    setSyncingPlatform(null);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Link2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Connected Accounts</h1>
          <p className="text-sm text-muted-foreground">Link your social platforms via OAuth to import Collabs</p>
        </div>
      </div>

      {!waiverAccepted && !isDemo && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Waiver Required</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You must accept the liability waiver when selecting a plan before connecting any accounts.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {platforms.map((p) => (
          <Card key={p.name} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${p.color}`}>
                    <p.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    {p.connected ? (
                      <p className="text-xs text-muted-foreground">{p.username}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not connected</p>
                    )}
                  </div>
                </div>
                {p.connected && (
                  <Badge variant="outline" className="text-tag-collab border-tag-collab/30 bg-tag-collab/10">
                    <Check className="h-3 w-3 mr-1" /> Connected
                  </Badge>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2">
                {p.connected ? (
                  <>
                    <Badge variant="secondary" className="text-xs">{p.messageCount} messages</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs ml-auto"
                      disabled={syncingPlatform === p.platform}
                      onClick={() => handleSync(p.platform)}
                    >
                      {syncingPlatform === p.platform ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      )}
                      Sync
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => handleDisconnect(p.platform)}>
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={connectingLoading === p.platform}
                    onClick={() => handleConnect(p.platform)}
                  >
                    {connectingLoading === p.platform ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <p.icon className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Connect {p.name}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
