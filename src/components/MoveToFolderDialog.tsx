import { useState } from "react";
import {
  FolderOpen, Sparkles, ChevronRight, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useFolders, type Folder, type Category } from "@/hooks/useFolders";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/hooks/useDemo";

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  messageContent: string;
  senderName?: string;
  platform?: string;
  onMoved: (folderId: string, folderName: string) => void;
}

export function MoveToFolderDialog({
  open, onOpenChange, messageId, messageContent, senderName, platform, onMoved,
}: MoveToFolderDialogProps) {
  const isDemo = useDemo();
  const { categories, folders } = useFolders();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  const currentCat = activeCat || categories[0]?.id;
  const catFolders = folders
    .filter((f) => f.category_id === currentCat && !f.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order);

  const getSubFolders = (parentId: string) =>
    folders.filter((f) => f.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);

  const handleMove = async (folder: Folder) => {
    if (!isDemo) {
      await supabase
        .from("messages")
        .update({ folder_id: folder.id, category_id: folder.category_id } as any)
        .eq("id", messageId);
    }
    onMoved(folder.id, folder.folder_name);
    onOpenChange(false);
    toast.success(`Moved to "${folder.folder_name}"`);
  };

  const askAI = async () => {
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const folderList = folders
        .filter((f) => !f.parent_id)
        .map((f) => {
          const cat = categories.find((c) => c.id === f.category_id);
          return `${f.folder_name} (category: ${cat?.name || "unknown"})`;
        })
        .join(", ");

      if (isDemo) {
        // Better keyword matching for demo - check if folder name appears in content or sender
        const content = messageContent.toLowerCase();
        const match = folders.find((f) => {
          const name = f.folder_name.toLowerCase();
          // Match full folder name or individual words (min 3 chars to avoid false positives)
          return content.includes(name) || 
            name.split(/\s+/).filter(w => w.length >= 3).some((w) => content.includes(w));
        });
        // Simulate a small delay for realism
        await new Promise((r) => setTimeout(r, 600));
        setAiSuggestion(match?.id || null);
        if (match) {
          toast.info(`AI suggests: "${match.folder_name}"`);
        } else {
          toast.info("AI couldn't find a strong match. Pick a folder manually.");
        }
        setAiLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("classify-message", {
        body: {
          message_id: messageId,
          message_content: messageContent,
          sender_name: senderName || "Unknown",
          platform: platform || "unknown",
        },
      });

      if (error) throw error;

      if (data?.folder_id) {
        const match = folders.find((f) => f.id === data.folder_id);
        setAiSuggestion(data.folder_id);
        if (match) {
          // Also switch to the right category tab
          setActiveCat(match.category_id);
          toast.info(`AI suggests: "${match.folder_name}"`);
        }
      } else if (data?.suggested_folder_name) {
        toast.info(`AI suggested "${data.suggested_folder_name}" but no matching folder exists. Pick one manually.`);
      } else {
        toast.info("AI couldn't determine the best folder. Pick one manually.");
      }
    } catch (e) {
      console.error("AI suggestion error:", e);
      toast.error("Failed to get AI suggestion");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FolderOpen className="h-5 w-5" /> Move to Folder
          </DialogTitle>
        </DialogHeader>

        {/* AI Suggest button */}
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={askAI}
          disabled={aiLoading}
        >
          {aiLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 text-primary" />
          )}
          {aiLoading ? "Asking AI..." : "Ask AI where to file this"}
        </Button>

        {/* Category tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                currentCat === cat.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Folder list */}
        <div className="max-h-64 overflow-y-auto space-y-1">
          {catFolders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No folders in this category
            </p>
          ) : (
            catFolders.map((folder) => {
              const subs = getSubFolders(folder.id);
              const isAiPick = aiSuggestion === folder.id;
              return (
                <div key={folder.id}>
                  <button
                    onClick={() => handleMove(folder)}
                    className={cn(
                      "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/50",
                      isAiPick && "ring-2 ring-primary bg-primary/5"
                    )}
                  >
                    <div
                      className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: folder.color + "22" }}
                    >
                      <FolderOpen className="h-4 w-4" style={{ color: folder.color }} />
                    </div>
                    <span className="text-sm font-medium flex-1">{folder.folder_name}</span>
                    {isAiPick && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                        AI pick
                      </span>
                    )}
                  </button>
                  {/* Sub-folders */}
                  {subs.map((sf) => (
                    <button
                      key={sf.id}
                      onClick={() => handleMove(sf)}
                      className={cn(
                        "flex items-center gap-3 w-full rounded-lg px-3 py-2 ml-6 text-left transition-colors hover:bg-accent/50",
                        aiSuggestion === sf.id && "ring-2 ring-primary bg-primary/5"
                      )}
                    >
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      <div
                        className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: sf.color + "22" }}
                      >
                        <FolderOpen className="h-3 w-3" style={{ color: sf.color }} />
                      </div>
                      <span className="text-xs font-medium">{sf.folder_name}</span>
                      {aiSuggestion === sf.id && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                          AI pick
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
