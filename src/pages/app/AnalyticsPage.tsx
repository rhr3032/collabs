import { useState, useMemo, useEffect } from "react";
import { BarChart3, TrendingUp, Clock, MessageSquare, Users, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PlatformIcon, getPlatformLabel } from "@/components/PlatformIcon";
import { TagBadge } from "@/components/TagBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { mockMessages } from "@/lib/mock-data";
import { MessageTag, Platform } from "@/lib/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

interface DBMessage {
  id: string;
  sender_name: string;
  platform: string;
  tag: string;
  received_at: string;
  is_read: boolean;
  confidence: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--destructive))",
  "hsl(var(--secondary))",
];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const isDemo = useDemo();
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setMessages(
        mockMessages.map((m) => ({
          id: m.id,
          sender_name: m.sender,
          platform: m.platform,
          tag: m.tag,
          received_at: m.timestamp,
          is_read: m.read,
          confidence: m.confidence,
        }))
      );
      setLoading(false);
      return;
    }
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_name, platform, tag, received_at, is_read, confidence")
        .order("received_at", { ascending: false });
      setMessages((data as DBMessage[]) || []);
      setLoading(false);
    };
    fetch();
  }, [user, isDemo]);

  // Platform breakdown
  const platformData = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach((m) => {
      counts[m.platform] = (counts[m.platform] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name: getPlatformLabel(name as Platform), value, platform: name }))
      .sort((a, b) => b.value - a.value);
  }, [messages]);

  // Tag breakdown
  const tagData = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach((m) => {
      counts[m.tag] = (counts[m.tag] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [messages]);

  // Weekly trend (last 7 days)
  const trendData = useMemo(() => {
    const days: Record<string, number> = {};
    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const key = d.toLocaleDateString("en-US", { weekday: "short" });
      days[key] = 0;
    }
    messages.forEach((m) => {
      const d = new Date(m.received_at);
      const diff = Math.floor((now - d.getTime()) / 86400000);
      if (diff < 7) {
        const key = d.toLocaleDateString("en-US", { weekday: "short" });
        if (key in days) days[key]++;
      }
    });
    return Object.entries(days).map(([day, count]) => ({ day, count }));
  }, [messages]);

  // Top senders
  const topSenders = useMemo(() => {
    const counts: Record<string, { count: number; platform: string }> = {};
    messages.forEach((m) => {
      if (!counts[m.sender_name]) counts[m.sender_name] = { count: 0, platform: m.platform };
      counts[m.sender_name].count++;
    });
    return Object.entries(counts)
      .map(([name, { count, platform }]) => ({ name, count, platform }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [messages]);

  // Sentiment approximation (using tags as proxy)
  const sentimentData = useMemo(() => {
    const positive = messages.filter((m) => ["sponsor", "collab"].includes(m.tag)).length;
    const neutral = messages.filter((m) => ["fan", "other"].includes(m.tag)).length;
    const negative = messages.filter((m) => m.tag === "spam").length;
    return [
      { name: "Positive", value: positive },
      { name: "Neutral", value: neutral },
      { name: "Negative", value: negative },
    ].filter((d) => d.value > 0);
  }, [messages]);

  const totalMessages = messages.length;
  const unreadCount = messages.filter((m) => !m.is_read).length;
  const avgConfidence = totalMessages
    ? Math.round(messages.reduce((s, m) => s + m.confidence, 0) / totalMessages * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">Insights across all your connected platforms</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
        {[
          { label: "Total Messages", value: totalMessages, icon: MessageSquare },
          { label: "Unread", value: unreadCount, icon: Clock },
          { label: "Platforms", value: platformData.length, icon: TrendingUp },
          { label: "Avg Confidence", value: `${avgConfidence}%`, icon: Users },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
              <p className="font-display text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="platforms">Platforms</TabsTrigger>
          <TabsTrigger value="senders">Top Senders</TabsTrigger>
          <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
        </TabsList>

        {/* Overview — Weekly Trend */}
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-base">Messages This Week</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))",
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-base">Message Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tagData.map((t) => (
                    <div key={t.name} className="flex items-center gap-3">
                      <TagBadge tag={t.name as MessageTag} />
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(t.value / totalMessages) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{t.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Platform Breakdown */}
        <TabsContent value="platforms">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-base">Messages by Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={platformData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {platformData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-base">Platform Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {platformData.map((p) => (
                    <div key={p.platform} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                      <PlatformIcon platform={p.platform as Platform} className="h-5 w-5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.value} messages</p>
                      </div>
                      <span className="text-sm font-bold font-display">
                        {totalMessages ? Math.round((p.value / totalMessages) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Top Senders */}
        <TabsContent value="senders">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">Top Senders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topSenders.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{s.name}</p>
                      <div className="flex items-center gap-1.5">
                        <PlatformIcon platform={s.platform as Platform} className="h-3 w-3" />
                        <span className="text-xs text-muted-foreground">{getPlatformLabel(s.platform as Platform)}</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold font-display">{s.count} msgs</span>
                  </div>
                ))}
                {topSenders.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No message data yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sentiment */}
        <TabsContent value="sentiment">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-base">Sentiment Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sentimentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        <Cell fill="hsl(var(--primary))" />
                        <Cell fill="hsl(var(--muted-foreground))" />
                        <Cell fill="hsl(var(--destructive))" />
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-base">Sentiment Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sentimentData.map((s) => (
                    <div key={s.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-muted-foreground">{s.value} messages</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${totalMessages ? (s.value / totalMessages) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {sentimentData.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
