export type MessageTag = "sponsor" | "collab" | "fan" | "spam" | "other";
export type Platform = "instagram" | "tiktok" | "twitter" | "facebook" | "gmail";

export interface Message {
  id: string;
  sender: string;
  senderAvatar?: string;
  platform: Platform;
  content: string;
  preview: string;
  timestamp: string;
  tag: MessageTag;
  confidence: number;
  read: boolean;
  archived: boolean;
}

export interface ConnectedAccount {
  platform: Platform;
  username: string;
  connected: boolean;
  lastSync?: string;
  messageCount?: number;
}

export interface ReplyTemplate {
  id: string;
  name: string;
  content: string;
  tag: MessageTag;
}
