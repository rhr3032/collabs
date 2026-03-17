import { MessageTag } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const tagStyles: Record<MessageTag, string> = {
  sponsor: "bg-primary/20 text-primary hover:bg-primary/30",
  collab: "bg-tag-collab text-tag-collab-foreground hover:bg-tag-collab/90",
  fan: "bg-tag-fan text-tag-fan-foreground hover:bg-tag-fan/90",
  spam: "bg-tag-spam text-tag-spam-foreground hover:bg-tag-spam/90",
  other: "bg-tag-other text-tag-other-foreground hover:bg-tag-other/90",
};

const tagLabels: Record<MessageTag, string> = {
  sponsor: "Sponsor",
  collab: "Collab",
  fan: "Fan",
  spam: "Spam",
  other: "Other",
};

export function TagBadge({ tag, confidence, className }: { tag: MessageTag; confidence?: number; className?: string }) {
  return (
    <Badge className={`${tagStyles[tag]} text-[10px] font-semibold border-0 ${className ?? ""}`}>
      {tagLabels[tag]}
      {confidence !== undefined && <span className="ml-1 opacity-75">{confidence}%</span>}
    </Badge>
  );
}
