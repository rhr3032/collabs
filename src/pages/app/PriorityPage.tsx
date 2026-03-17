import { useState, useMemo, useEffect } from "react";
import { BarChart3, TrendingUp, Users, AlertTriangle, HelpCircle, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TagBadge } from "@/components/TagBadge";
import { PlatformIcon } from "@/components/PlatformIcon";
import { supabase } from "@/integrations/supabase/client";
import { MessageTag, Platform } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDemo } from "@/hooks/useDemo";
import { mockMessages } from "@/lib/mock-data";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const priorityConfig = {
  high: { label: "High Priority", description: "Sponsors & collaborations", icon: TrendingUp, tags: ["sponsor", "collab"] as MessageTag[] },
  medium: { label: "Medium Priority", description: "Fans & general messages", icon: Users, tags: ["fan", "other"] as MessageTag[] },
  low: { label: "Low Priority", description: "Spam & irrelevant", icon: AlertTriangle, tags: ["spam"] as MessageTag[] },
};

export default function PriorityPage() {
  const isDemo = useDemo();
  const [dbMessages, setDbMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setDbMessages(
        mockMessages.filter((m) => !m.archived).map((m) => ({
          id: m.id,
          sender_name: m.sender,
          platform: m.platform,
          content: m.content,
          preview: m.preview,
          received_at: m.timestamp,
          tag: m.tag,
          confidence: m.confidence,
          is_read: m.read,
          is_archived: m.archived,
        }))
      );
      setLoading(false);
      return;
    }
    const fetchMessages = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .order("received_at", { ascending: false });
      setDbMessages(data || []);
      setLoading(false);
    };
    fetchMessages();
  }, [isDemo]);

  const messages = useMemo(() => dbMessages.map((m) => ({
    id: m.id,
    sender: m.sender_name,
    platform: m.platform as Platform,
    preview: m.preview || m.content?.slice(0, 120),
    timestamp: m.received_at,
    tag: m.tag as MessageTag,
    confidence: m.confidence,
    read: m.is_read,
    archived: m.is_archived,
  })), [dbMessages]);

  const grouped = useMemo(() => ({
    high: messages.filter((m) => priorityConfig.high.tags.includes(m.tag)),
    medium: messages.filter((m) => priorityConfig.medium.tags.includes(m.tag)),
    low: messages.filter((m) => priorityConfig.low.tags.includes(m.tag)),
  }), [messages]);

  const stats = {
    total: messages.length,
    unread: messages.filter((m) => !m.read).length,
    collabs: grouped.high.length,
    avgConfidence: messages.length ? Math.round(messages.reduce((s, m) => s + m.confidence, 0) / messages.length) : 0,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Priority View</h1>
          <p className="text-sm text-muted-foreground">Messages sorted by importance</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
        {[
          { label: "Total Messages", value: stats.total },
          { label: "Unread", value: stats.unread },
          { label: "Collab Opps", value: stats.collabs },
          { label: "Avg Confidence", value: `${stats.avgConfidence}%` },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="font-display text-2xl font-bold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Priority Tabs */}
      <Tabs defaultValue="high">
        <TabsList className="mb-4">
          <TabsTrigger value="high" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> High ({grouped.high.length})
          </TabsTrigger>
          <TabsTrigger value="medium" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Medium ({grouped.medium.length})
          </TabsTrigger>
          <TabsTrigger value="low" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Low ({grouped.low.length})
          </TabsTrigger>
        </TabsList>

        {(Object.entries(grouped) as [keyof typeof grouped, typeof messages][]).map(([key, msgs]) => (
          <TabsContent key={key} value={key}>
            <div className="space-y-2">
              {msgs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-border">
                  <HelpCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No messages in this priority level.</p>
                </div>
              ) : (
                msgs
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map((msg) => (
                    <Card key={msg.id} className={cn("transition-colors", !msg.read && "border-primary/20")}>
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="relative h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
                          {msg.sender[0]}
                          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-card flex items-center justify-center">
                            <PlatformIcon platform={msg.platform} className="h-2.5 w-2.5" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-sm", !msg.read ? "font-semibold" : "font-medium")}>{msg.sender}</span>
                            <TagBadge tag={msg.tag} confidence={msg.confidence} />
                          </div>
                          <p className="text-sm text-muted-foreground truncate mt-0.5">{msg.preview}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(msg.timestamp)}</span>
                      </CardContent>
                    </Card>
                  ))
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
