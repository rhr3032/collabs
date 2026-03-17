

# DM Inbox Organizer — Implementation Plan

## Overview
A web app that helps creators and small businesses organize Collabs by priority (Collabs, Fans, Spam) with a unified inbox, auto-tagging, and quick reply templates. The MVP focuses on manual import + simulated connections with a polished, production-ready UI.

---

## Phase 1: Core Layout & Navigation

- **Landing/marketing page** with hero section explaining the product value
- **App shell** with sidebar navigation: Inbox, Priority View, Connected Accounts, Settings
- **Responsive design** — mobile-friendly layout for on-the-go triage
- **Dark/light mode** toggle

## Phase 2: Authentication & Database Setup (Lovable Cloud)

- **Sign up / Log in** with email + password (Google OAuth optional)
- **User profiles table** storing display name, avatar, plan tier
- **Waiver acceptance table** tracking `user_id`, `accepted_at`, `waiver_version`
- **Messages table** storing imported Collabs with fields: sender, platform, content, timestamp, tag, confidence score, read/unread, archived
- **Connected accounts table** tracking which platforms a user has linked and connection status

## Phase 3: Account Connection Flow

- **Connect Social Accounts page** showing Instagram, TikTok, X, Facebook, Gmail — each with a "Connect" button
- **Mandatory waiver modal** that appears before any connection attempt, containing the full liability waiver text with "I Agree & Continue" / "Cancel" buttons
- Waiver acceptance saved to database; blocks connection until accepted
- **Connection methods per platform:**
  - Gmail: OAuth integration (if feasible) or manual import
  - Instagram, TikTok, X, Facebook: Manual import (CSV, JSON, or paste text)
- **Confirmation screen** after connecting — shows what was imported, sync info, and disconnect option
- **Disconnect functionality** to revoke access anytime

## Phase 4: Manual Import System

- **Upload interface** accepting CSV, JSON, or plain text paste
- **Parser** that extracts sender name, message content, timestamp, and platform from uploaded data
- **Import preview** showing parsed messages before confirming import
- **Sample/demo data** option so users can explore the app without importing real Collabs

## Phase 5: Auto-Tagging Engine

- **Keyword-based classification** running in the browser:
  - **Collab/Business**: "collab", "partnership", "sponsor", "rate", "budget", "brand deal", etc.
  - **Fan/Supporter**: compliments, emojis, appreciation language
  - **Spam/Bot**: suspicious links, repetitive patterns, known spam phrases
  - **General/Other**: everything else
- **Confidence score** (percentage) displayed on each tagged message
- **Manual override** — users can re-tag any message; corrections improve future suggestions

## Phase 6: Unified Inbox & Priority View

- **Unified inbox** showing all messages chronologically with platform icon, sender, preview, and tag badge
- **Priority tabs**: High (Collabs), Medium (Fans/General), Low (Spam)
- **Search & filters** — by keyword, tag, platform, date range, read/unread
- **Message detail view** — full conversation with sender info and tag details
- **Archive & mark as read** functionality

## Phase 7: Quick Reply Templates

- **Pre-built templates** for common scenarios: collab inquiry response, fan thank you, spam block
- **Custom template creation** — users save their own reply templates
- **One-click copy** to clipboard (since actual sending requires platform API access)

## Phase 8: Settings & Account Management

- **Profile settings** — name, avatar, notification preferences
- **Connected accounts management** — view status, disconnect, re-import
- **Waiver history** — view when waiver was accepted and which version
- **Data management** — request deletion of imported messages

---

## Design Direction
- Clean, minimal UI inspired by modern email clients (like Superhuman or Linear)
- Color-coded tags: green for Collabs, blue for Fans, red for Spam, gray for Other
- Smooth animations and transitions for a premium feel
- Card-based message previews with clear visual hierarchy

## Technical Notes
- Lovable Cloud for database, auth, and secrets
- Keyword tagging runs client-side for speed; AI-powered tagging can be added later via edge functions
- No direct social media API integrations in MVP — manual import keeps things functional and avoids API restrictions

