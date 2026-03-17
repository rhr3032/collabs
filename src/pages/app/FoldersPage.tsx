import { useState, useMemo } from "react";
import {
  FolderOpen, Plus, MoreHorizontal, Pencil, Trash2, Palette,
  ArrowLeft, GripVertical, Search, Settings2, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useFolders, type Folder, type Category } from "@/hooks/useFolders";
import { PlatformIcon } from "@/components/PlatformIcon";
import { TagBadge } from "@/components/TagBadge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { mockMessages } from "@/lib/mock-data";
import { Platform, MessageTag } from "@/lib/types";

const FOLDER_COLORS = [
  "#6366f1", "#f97316", "#3b82f6", "#10b981", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#64748b",
];

interface FolderMessage {
  id: string;
  sender_name: string;
  platform: string;
  content: string;
  preview: string | null;
  received_at: string;
  tag: string;
  confidence: number;
  is_read: boolean;
  folder_id: string | null;
  category_id: string | null;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function FoldersPage() {
  const { user } = useAuth();
  const isDemo = useDemo();
  const {
    categories, folders, rules, loading,
    createFolder, renameFolder, deleteFolder,
    updateFolderColor, setFolderRules,
  } = useFolders();

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [openFolder, setOpenFolder] = useState<Folder | null>(null);
  const [folderMessages, setFolderMessages] = useState<FolderMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [createParent, setCreateParent] = useState<string | undefined>();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(FOLDER_COLORS[0]);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Folder | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesTarget, setRulesTarget] = useState<Folder | null>(null);
  const [rulesValue, setRulesValue] = useState("");

  const [search, setSearch] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<FolderMessage | null>(null);

  // Default to first category
  const activeCat = activeCategory || categories[0]?.id;
  const catFolders = useMemo(
    () => folders
      .filter((f) => f.category_id === activeCat && !f.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order),
    [folders, activeCat]
  );

  const getSubFolders = (parentId: string) =>
    folders.filter((f) => f.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);

  const openFolderView = async (folder: Folder) => {
    setOpenFolder(folder);
    setLoadingMsgs(true);

    if (isDemo) {
      // Map mock messages that match by content keywords
      const folderName = folder.folder_name.toLowerCase();
      const mapped = mockMessages
        .filter((m) => !m.archived && (m.sender.toLowerCase().includes(folderName) || m.content.toLowerCase().includes(folderName)))
        .map((m) => ({
          id: m.id,
          sender_name: m.sender,
          platform: m.platform,
          content: m.content,
          preview: m.preview,
          received_at: m.timestamp,
          tag: m.tag,
          confidence: m.confidence,
          is_read: m.read,
          folder_id: folder.id,
          category_id: folder.category_id,
        }));
      setFolderMessages(mapped);
      setLoadingMsgs(false);
      return;
    }

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("folder_id", folder.id)
      .order("received_at", { ascending: false });
    setFolderMessages((data as any[] || []) as FolderMessage[]);
    setLoadingMsgs(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    // Use the open folder's category when creating sub-folders, otherwise use the active category tab
    const categoryId = createParent
      ? folders.find((f) => f.id === createParent)?.category_id || activeCat
      : activeCat;
    if (!categoryId) return;
    await createFolder(categoryId, newName.trim(), newColor, createParent);
    setCreateOpen(false);
    setNewName("");
    setNewColor(FOLDER_COLORS[0]);
    setCreateParent(undefined);
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    await renameFolder(renameTarget.id, renameValue.trim());
    setRenameOpen(false);
  };

  const handleRulesUpdate = async () => {
    if (!rulesTarget) return;
    const keywords = rulesValue.split(",").map((k) => k.trim()).filter(Boolean);
    await setFolderRules(rulesTarget.id, keywords);
    setRulesOpen(false);
  };

  const filteredFolders = useMemo(() => {
    if (!search) return catFolders;
    const q = search.toLowerCase();
    return catFolders.filter((f) => f.folder_name.toLowerCase().includes(q));
  }, [catFolders, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Message detail view
  if (openFolder && selectedMessage) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setSelectedMessage(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="relative h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
            {selectedMessage.sender_name[0]}
            <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-card flex items-center justify-center">
              <PlatformIcon platform={selectedMessage.platform as Platform} className="h-2.5 w-2.5" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg font-bold">{selectedMessage.sender_name}</h1>
              <TagBadge tag={selectedMessage.tag as MessageTag} />
            </div>
            <p className="text-xs text-muted-foreground">{timeAgo(selectedMessage.received_at)}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-card p-5">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedMessage.content}</p>
        </div>
      </div>
    );
  }

  // Folder detail view
  if (openFolder) {
    const subFolders = getSubFolders(openFolder.id);
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setOpenFolder(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: openFolder.color + "22" }}
          >
            <FolderOpen className="h-5 w-5" style={{ color: openFolder.color }} />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold tracking-tight">{openFolder.folder_name}</h1>
            <p className="text-sm text-muted-foreground">
              {folderMessages.length} message{folderMessages.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCreateParent(openFolder.id);
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Sub-folder
          </Button>
        </div>

        {/* Sub-folders */}
        {subFolders.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {subFolders.map((sf) => (
              <button
                key={sf.id}
                onClick={() => openFolderView(sf)}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
              >
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: sf.color }} />
                {sf.folder_name}
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {/* Messages in folder */}
        <div className="flex-1 overflow-y-auto -mx-2">
          {loadingMsgs ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : folderMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="font-display text-lg font-semibold">No messages yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Messages matching this folder will appear here.</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {folderMessages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => setSelectedMessage(msg)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-accent/50 cursor-pointer",
                    !msg.is_read && "bg-primary/[0.03]"
                  )}
                >
                  <div className="relative h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
                    {msg.sender_name[0]}
                    <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-card flex items-center justify-center">
                      <PlatformIcon platform={msg.platform as Platform} className="h-2.5 w-2.5" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm", !msg.is_read ? "font-semibold" : "font-medium")}>{msg.sender_name}</span>
                      <TagBadge tag={msg.tag as MessageTag} />
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{msg.preview || msg.content}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{timeAgo(msg.received_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Folder Dialog (also available in folder view) */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display">{createParent ? "Create Sub-folder" : "Create Folder"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Folder name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
              <div>
                <label className="text-sm font-medium mb-2 block">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {FOLDER_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition-all",
                        newColor === c ? "border-foreground scale-110" : "border-transparent"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Main categories + folders view
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FolderOpen className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">Folders</h1>
          <p className="text-sm text-muted-foreground">Organize messages into categories and folders</p>
        </div>
      </div>

      {/* Category tabs */}
      <Tabs value={activeCat} onValueChange={setActiveCategory} className="mb-4">
        <TabsList className="h-9 flex-wrap">
          {categories.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id} className="text-xs">
              {cat.name}
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">
                {folders.filter((f) => f.category_id === cat.id && !f.parent_id).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Search + Create */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search folders..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { setCreateParent(undefined); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Folder
        </Button>
      </div>

      {/* Folder grid */}
      <div className="flex-1 overflow-y-auto">
        {filteredFolders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-display text-lg font-semibold">No folders yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Create your first folder to start organizing.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredFolders.map((folder) => {
              const subs = getSubFolders(folder.id);
              const folderRules = rules.filter((r) => r.folder_id === folder.id);
              return (
                <div
                  key={folder.id}
                  className="group relative rounded-xl border border-border bg-card p-4 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => openFolderView(folder)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: folder.color + "22" }}
                    >
                      <FolderOpen className="h-5 w-5" style={{ color: folder.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold text-sm truncate">{folder.folder_name}</h3>
                      {folderRules.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          Keywords: {folderRules.flatMap((r) => r.keywords).join(", ")}
                        </p>
                      )}
                      {subs.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {subs.length} sub-folder{subs.length !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => { setRenameTarget(folder); setRenameValue(folder.folder_name); setRenameOpen(true); }}>
                          <Pencil className="h-4 w-4 mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setRulesTarget(folder); setRulesValue(rules.find((r) => r.folder_id === folder.id)?.keywords.join(", ") || ""); setRulesOpen(true); }}>
                          <Settings2 className="h-4 w-4 mr-2" /> Edit Rules
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteFolder(folder.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{createParent ? "Create Sub-folder" : "Create Folder"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Folder name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            <div>
              <label className="text-sm font-medium mb-2 block">Color</label>
              <div className="flex gap-2 flex-wrap">
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-all",
                      newColor === c ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Rename Folder</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
          <DialogFooter>
            <Button onClick={handleRename} disabled={!renameValue.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rules Dialog */}
      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Keyword Rules</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Enter keywords separated by commas. Messages containing any keyword will be auto-filed here.</p>
          <Input
            placeholder="nike, nike collab, just do it"
            value={rulesValue}
            onChange={(e) => setRulesValue(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button onClick={handleRulesUpdate}>Save Rules</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
