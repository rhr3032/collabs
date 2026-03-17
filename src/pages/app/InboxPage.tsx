import { useState, useMemo, useEffect } from "react";
import { Inbox, Search, Filter, Archive, CheckCheck, PartyPopper, X, FolderOpen, AlertTriangle, Clock, ArrowDown, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSearchParams } from "react-router-dom";
import { TagBadge } from "@/components/TagBadge";
import { PlatformIcon, getPlatformLabel } from "@/components/PlatformIcon";
import { MessageTag, Platform } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { mockMessages } from "@/lib/mock-data";
import { MoveToFolderDialog } from "@/components/MoveToFolderDialog";

type Priority = "urgent" | "important" | "normal";

interface DBMessage {
  id: string;
  sender_name: string;
  platform: string;
  content: string;
  preview: string | null;
  received_at: string;
  tag: string;
  confidence: number;
  is_read: boolean;
  is_archived: boolean;
  priority: Priority;
  priority_reason: string | null;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; icon: React.ComponentType<{ className?: string }>; badgeClass: string; borderClass: string }> = {
  urgent: {
    label: "Urgent",
    icon: AlertTriangle,
    badgeClass: "bg-red-500/15 text-red-500 border-red-500/30",
    borderClass: "border-l-2 border-l-red-500",
  },
  important: {
    label: "Important",
    icon: Clock,
    badgeClass: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    borderClass: "border-l-2 border-l-amber-500",
  },
  normal: {
    label: "Normal",
    icon: ArrowDown,
    badgeClass: "bg-muted text-muted-foreground border-border",
    borderClass: "",
  },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const config = PRIORITY_CONFIG[priority];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 gap-1", config.badgeClass)}>
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </Badge>
  );
}

export default function InboxPage() {
  const { user } = useAuth();
  const isDemo = useDemo();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<"all" | MessageTag>("all");
  const [activePriority, setActivePriority] = useState<"all" | Priority>("all");
  const [selecteCollabsg, setSelecteCollabsg] = useState<DBMessage | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      setShowWelcome(true);
      searchParams.delete("checkout");
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  useEffect(() => {
    if (isDemo) {
      const demoPriorities: Priority[] = ["urgent", "important", "normal", "normal", "important", "urgent", "normal", "normal", "important", "normal", "normal"];
      const demoReasons = [
        "Time-sensitive brand deal deadline",
        "Potential collaboration opportunity",
        "General fan message",
        "Casual greeting",
        "Business inquiry about rates",
        "Complaint requiring immediate response",
        "Generic compliment",
        "Mass outreach message",
        "Product question from potential partner",
        "Casual message",
        "Low priority outreach",
      ];
      setMessages(
        mockMessages.filter((m) => !m.archived).map((m, i) => ({
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
          priority: demoPriorities[i % demoPriorities.length],
          priority_reason: demoReasons[i % demoReasons.length],
        }))
      );
      setLoading(false);
      return;
    }
    if (!user) return;
    const fetchMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("is_archived", false)
        .order("received_at", { ascending: false });

      if (!error && data) {
        setMessages(data.map((m: any) => ({
          ...m,
          priority: m.priority || "normal",
          priority_reason: m.priority_reason || null,
        })) as DBMessage[]);
      }
      setLoading(false);
    };
    fetchMessages();
  }, [user, isDemo]);

  const filtered = useMemo(() => {
    let result = messages;
    if (activeTag !== "all") result = result.filter((m) => m.tag === activeTag);
    if (activePriority !== "all") result = result.filter((m) => m.priority === activePriority);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((m) => m.sender_name.toLowerCase().includes(q) || m.content.toLowerCase().includes(q));
    }
    // Sort: urgent first, then important, then normal, then by time
    const priorityOrder: Record<string, number> = { urgent: 0, important: 1, normal: 2 };
    return result.sort((a, b) => {
      const pDiff = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      if (pDiff !== 0) return pDiff;
      return new Date(b.received_at).getTime() - new Date(a.received_at).getTime();
    });
  }, [messages, activeTag, activePriority, search]);

  const unreadCount = messages.filter((m) => !m.is_read).length;
  const urgentCount = messages.filter((m) => m.priority === "urgent").length;

  const markRead = async (id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_read: true } : m)));
    if (!isDemo) await supabase.from("messages").update({ is_read: true }).eq("id", id);
  };

  const archiveMsg = async (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setSelecteCollabsg(null);
    if (!isDemo) await supabase.from("messages").update({ is_archived: true }).eq("id", id);
    toast.success("Message archived");
  };

  const retagMsg = async (id: string, newTag: MessageTag) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, tag: newTag, confidence: 100 } : m)));
    if (!isDemo) await supabase.from("messages").update({ tag: newTag, confidence: 1.0 }).eq("id", id);
    toast.success("Tag updated");
  };

  const syncAndPrioritize = async () => {
    setSyncing(true);
    toast.info("Syncing messages from all platforms...");
    try {
      const { data, error } = await supabase.functions.invoke("sync-messages");
      if (error) throw error;
      toast.success(`Synced ${data?.synced || 0} messages! (${data?.priorities?.urgent || 0} urgent, ${data?.priorities?.important || 0} important)`);
      // Reload messages
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("is_archived", false)
        .order("received_at", { ascending: false });
      if (msgs) {
        setMessages(msgs.map((m: any) => ({
          ...m,
          priority: m.priority || "normal",
          priority_reason: m.priority_reason || null,
        })) as DBMessage[]);
      }
    } catch (e) {
      toast.error("Sync failed. Please try again.");
      console.error("Sync error:", e);
    }
    setSyncing(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Inbox className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Inbox
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">AI-prioritized messages from all platforms</p>
        </div>
        {urgentCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {urgentCount} urgent
          </Badge>
        )}
        {!isDemo && (
          <Button
            size="sm"
            variant="outline"
            disabled={syncing}
            onClick={syncAndPrioritize}
            className="gap-1.5"
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {syncing ? "Syncing..." : "Sync & Prioritize"}
          </Button>
        )}
      </div>

      {/* Priority Filter */}
      <div className="flex flex-wrap gap-2 mb-3">
        {(["all", "urgent", "important", "normal"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setActivePriority(p)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
              activePriority === p
                ? p === "urgent"
                  ? "bg-red-500/15 text-red-500 border-red-500/40"
                  : p === "important"
                  ? "bg-amber-500/15 text-amber-500 border-amber-500/40"
                  : p === "normal"
                  ? "bg-muted text-foreground border-border"
                  : "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-muted-foreground border-border/50 hover:bg-accent/50"
            )}
          >
            {p === "all" ? "All" : `${p.charAt(0).toUpperCase() + p.slice(1)} (${messages.filter((m) => m.priority === p).length})`}
          </button>
        ))}
      </div>

      {/* Search & Tag Filters */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={activeTag} onValueChange={(v) => setActiveTag(v as typeof activeTag)}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="sponsor" className="text-xs">Sponsors</TabsTrigger>
            <TabsTrigger value="collab" className="text-xs">Collabs</TabsTrigger>
            <TabsTrigger value="fan" className="text-xs">Fans</TabsTrigger>
            <TabsTrigger value="spam" className="text-xs">Spam</TabsTrigger>
            <TabsTrigger value="other" className="text-xs">Other</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto -mx-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Filter className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-display text-lg font-semibold">No messages yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your accounts to start receiving messages.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((msg) => (
              <button
                key={msg.id}
                onClick={() => {
                  setSelecteCollabsg(msg);
                  markRead(msg.id);
                }}
                className={cn(
                  "flex items-center gap-3 w-full rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent/50",
                  !msg.is_read && "bg-primary/[0.03]",
                  PRIORITY_CONFIG[msg.priority]?.borderClass
                )}
              >
                <div className="relative h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
                  {msg.sender_name[0]}
                  <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-card flex items-center justify-center">
                    <PlatformIcon platform={msg.platform as Platform} className="h-2.5 w-2.5" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-sm", !msg.is_read ? "font-semibold" : "font-medium")}>{msg.sender_name}</span>
                    <PriorityBadge priority={msg.priority} />
                    <TagBadge tag={msg.tag as MessageTag} />
                    {!msg.is_read && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{msg.preview || msg.content}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{timeAgo(msg.received_at)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Message Detail Dialog */}
      <Dialog open={!!selecteCollabsg} onOpenChange={(open) => !open && setSelecteCollabsg(null)}>
        {selecteCollabsg && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
                  {selecteCollabsg.sender_name[0]}
                </div>
                <div>
                  <DialogTitle className="font-display text-lg">{selecteCollabsg.sender_name}</DialogTitle>
                  <div className="flex items-center gap-2 mt-0.5">
                    <PlatformIcon platform={selecteCollabsg.platform as Platform} className="h-3.5 w-3.5" />
                    <span className="text-xs text-muted-foreground">{getPlatformLabel(selecteCollabsg.platform as Platform)}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(selecteCollabsg.received_at)}</span>
                  </div>
                </div>
              </div>
            </DialogHeader>

            {/* Priority + Reason */}
            <div className="flex items-center gap-2 flex-wrap">
              <PriorityBadge priority={selecteCollabsg.priority} />
              {selecteCollabsg.priority_reason && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {selecteCollabsg.priority_reason}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <TagBadge tag={selecteCollabsg.tag as MessageTag} confidence={selecteCollabsg.confidence * 100} />
              <span className="text-xs text-muted-foreground">Re-tag:</span>
              {(["sponsor", "collab", "fan", "spam", "other"] as MessageTag[])
                .filter((t) => t !== selecteCollabsg.tag)
                .map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      retagMsg(selecteCollabsg.id, t);
                      setSelecteCollabsg({ ...selecteCollabsg, tag: t, confidence: 1 });
                    }}
                    className="text-xs underline text-muted-foreground hover:text-foreground capitalize"
                  >
                    {t}
                  </button>
                ))}
            </div>

            <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">{selecteCollabsg.content}</div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setMoveDialogOpen(true)}>
                <FolderOpen className="h-3.5 w-3.5 mr-1.5" /> Move to Folder
              </Button>
              <Button variant="outline" size="sm" onClick={() => archiveMsg(selecteCollabsg.id)}>
                <Archive className="h-3.5 w-3.5 mr-1.5" /> Archive
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  markRead(selecteCollabsg.id);
                  toast.success("Marked as read");
                }}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Mark Read
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Welcome Popup */}
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="max-w-md text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PartyPopper className="h-8 w-8" />
            </div>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Welcome to Collabs! 🎉</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Your subscription is active! Connect your social accounts to start receiving and organizing your messages.
            </p>
            <Button onClick={() => setShowWelcome(false)} className="w-full">
              Get Started
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move to Folder Dialog */}
      {selecteCollabsg && (
        <MoveToFolderDialog
          open={moveDialogOpen}
          onOpenChange={setMoveDialogOpen}
          messageId={selecteCollabsg.id}
          messageContent={selecteCollabsg.content}
          senderName={selecteCollabsg.sender_name}
          platform={selecteCollabsg.platform}
          onMoved={(folderId, folderName) => {
            setSelecteCollabsg(null);
          }}
        />
      )}
    </div>
  );
}
