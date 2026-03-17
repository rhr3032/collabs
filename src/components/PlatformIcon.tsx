import { Instagram, Twitter, Facebook, Mail } from "lucide-react";
import { Platform } from "@/lib/types";

const platformConfig: Record<Platform, { icon: React.ComponentType<{ className?: string }>; label: string; className: string }> = {
  instagram: { icon: Instagram, label: "Instagram", className: "text-pink-500" },
  tiktok: { icon: () => <span className="text-[10px] font-bold leading-none">TT</span>, label: "TikTok", className: "text-foreground" },
  twitter: { icon: Twitter, label: "X", className: "text-sky-500" },
  facebook: { icon: Facebook, label: "Facebook", className: "text-blue-600" },
  gmail: { icon: Mail, label: "Gmail", className: "text-red-500" },
};

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const config = platformConfig[platform];
  const Icon = config.icon;
  return <Icon className={`${config.className} ${className ?? ""}`} />;
}

export function getPlatformLabel(platform: Platform) {
  return platformConfig[platform].label;
}
