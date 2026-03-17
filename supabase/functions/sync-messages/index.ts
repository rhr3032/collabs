import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RawMessage {
  platform: string;
  sender_name: string;
  sender_username: string;
  content: string;
  subject?: string;
  received_at: string;
  platform_message_id: string;
}

async function fetchGmailMessages(accessToken: string): Promise<RawMessage[]> {
  const messages: RawMessage[] = [];
  try {
    const listRes = await fetch(
      "https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=INBOX",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    if (!listData.messages) return messages;

    for (const msgRef of listData.messages.slice(0, 15)) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgRef.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const msg = await msgRes.json();
      const headers = msg.payload?.headers || [];
      const from = headers.find((h: any) => h.name === "From")?.value || "Unknown";
      const subject = headers.find((h: any) => h.name === "Subject")?.value || "(no subject)";
      const date = headers.find((h: any) => h.name === "Date")?.value || "";

      const nameMatch = from.match(/^(.+?)\s*<(.+)>$/) || [];
      const senderName = nameMatch[1]?.replace(/"/g, "").trim() || from;

      messages.push({
        platform: "gmail",
        sender_name: senderName,
        sender_username: from,
        content: subject,
        subject,
        received_at: date ? new Date(date).toISOString() : new Date().toISOString(),
        platform_message_id: msgRef.id,
      });
    }
  } catch (e) {
    console.error("Gmail fetch error:", e);
  }
  return messages;
}

async function fetchInstagramMessages(accessToken: string): Promise<RawMessage[]> {
  const messages: RawMessage[] = [];
  try {
    const convRes = await fetch(
      `https://graph.instagram.com/v21.0/me/conversations?fields=messages{message,from,created_time}&access_token=${accessToken}`
    );
    const convData = await convRes.json();
    if (convData.data) {
      for (const conv of convData.data) {
        for (const msg of (conv.messages?.data || []).slice(0, 5)) {
          messages.push({
            platform: "instagram",
            sender_name: msg.from?.username || "Instagram User",
            sender_username: `@${msg.from?.username || "unknown"}`,
            content: msg.message || "",
            received_at: msg.created_time || new Date().toISOString(),
            platform_message_id: msg.id,
          });
        }
      }
    }
  } catch (e) {
    console.error("Instagram fetch error:", e);
  }
  return messages;
}

async function fetchTwitterMessages(accessToken: string): Promise<RawMessage[]> {
  const messages: RawMessage[] = [];
  try {
    const dmRes = await fetch(
      "https://api.x.com/2/dm_events?dm_event.fields=text,created_at,sender_id&max_results=20",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const dmData = await dmRes.json();
    if (dmData.data) {
      for (const dm of dmData.data) {
        messages.push({
          platform: "twitter",
          sender_name: `User ${dm.sender_id}`,
          sender_username: dm.sender_id,
          content: dm.text || "",
          received_at: dm.created_at || new Date().toISOString(),
          platform_message_id: dm.id,
        });
      }
    }
  } catch (e) {
    console.error("Twitter fetch error:", e);
  }
  return messages;
}

async function fetchFacebookMessages(accessToken: string): Promise<RawMessage[]> {
  const messages: RawMessage[] = [];
  try {
    const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`);
    const pagesData = await pagesRes.json();
    if (pagesData.data?.[0]) {
      const pageToken = pagesData.data[0].access_token;
      const pageId = pagesData.data[0].id;
      const convRes = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/conversations?fields=messages{message,from,created_time}&access_token=${pageToken}`
      );
      const convData = await convRes.json();
      if (convData.data) {
        for (const conv of convData.data) {
          for (const msg of (conv.messages?.data || []).slice(0, 5)) {
            messages.push({
              platform: "facebook",
              sender_name: msg.from?.name || "Facebook User",
              sender_username: msg.from?.id || "",
              content: msg.message || "",
              received_at: msg.created_time || new Date().toISOString(),
              platform_message_id: msg.id,
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("Facebook fetch error:", e);
  }
  return messages;
}

async function fetchTikTokMessages(accessToken: string): Promise<RawMessage[]> {
  const messages: RawMessage[] = [];
  try {
    const res = await fetch(
      "https://open.tiktokapis.com/v2/dm/conversation/list/?fields=id,participants,latest_message",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    for (const conv of (data.data?.conversations || []).slice(0, 10)) {
      messages.push({
        platform: "tiktok",
        sender_name: conv.participants?.[0]?.display_name || "TikTok User",
        sender_username: conv.participants?.[0]?.open_id || "",
        content: conv.latest_message?.text || "[media message]",
        received_at: conv.latest_message?.create_time
          ? new Date(conv.latest_message.create_time * 1000).toISOString()
          : new Date().toISOString(),
        platform_message_id: conv.id || crypto.randomUUID(),
      });
    }
  } catch (e) {
    console.error("TikTok fetch error:", e);
  }
  return messages;
}

const platformFetchers: Record<string, (token: string) => Promise<RawMessage[]>> = {
  gmail: fetchGmailMessages,
  instagram: fetchInstagramMessages,
  twitter: fetchTwitterMessages,
  facebook: fetchFacebookMessages,
  tiktok: fetchTikTokMessages,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminSupabase = createClient(supabaseUrl, serviceKey);

  // Get all connected accounts
  const { data: accounts } = await adminSupabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (!accounts || accounts.length === 0) {
    return new Response(JSON.stringify({ synced: 0, message: "No connected accounts" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch messages from all platforms in parallel
  const allMessages: RawMessage[] = [];
  const fetchPromises = accounts.map(async (account: any) => {
    const fetcher = platformFetchers[account.platform];
    if (!fetcher || !account.access_token) return;
    const msgs = await fetcher(account.access_token);
    allMessages.push(...msgs);

    // Update last_sync_at
    await adminSupabase
      .from("connected_accounts")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", account.id);
  });

  await Promise.all(fetchPromises);

  if (allMessages.length === 0) {
    return new Response(JSON.stringify({ synced: 0, message: "No new messages found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // AI Prioritization using Lovable AI
  let priorities: Array<{ priority: string; reason: string }> = allMessages.map(() => ({
    priority: "normal",
    reason: "Default classification",
  }));

  if (LOVABLE_API_KEY) {
    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a message priority classifier for a creator's inbox.
Classify each message as exactly one of:
- "urgent": needs immediate response (complaints, deadlines, angry tone, crises, time-sensitive requests)
- "important": respond within 24h (business inquiries, collaborations, meaningful questions, partnership offers)
- "normal": low priority (newsletters, automated emails, generic compliments, promotions, cold outreach, spam)

Respond ONLY with a valid JSON array matching the input order. Each item: {"priority":"urgent"|"important"|"normal","reason":"one short sentence"}
No markdown, no explanation, just the JSON array.`,
            },
            {
              role: "user",
              content: `Classify these ${allMessages.length} messages:\n${JSON.stringify(
                allMessages.map((m, i) => ({
                  i,
                  from: m.sender_name,
                  platform: m.platform,
                  subject: m.subject || "",
                  preview: m.content?.substring(0, 200),
                }))
              )}`,
            },
          ],
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const rawText = aiData.choices?.[0]?.message?.content?.replace(/```json|```/g, "").trim() || "[]";
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed) && parsed.length === allMessages.length) {
          priorities = parsed;
        }
      } else {
        console.error("AI prioritization failed:", aiRes.status, await aiRes.text());
      }
    } catch (e) {
      console.error("AI prioritization error:", e);
    }
  }

  // Save to DB with upsert
  const rows = allMessages.map((m, i) => ({
    user_id: user.id,
    platform: m.platform,
    platform_message_id: m.platform_message_id,
    sender_name: m.sender_name,
    sender_username: m.sender_username,
    content: m.content,
    preview: m.content.slice(0, 120),
    received_at: m.received_at,
    priority: priorities[i]?.priority || "normal",
    priority_reason: priorities[i]?.reason || "",
  }));

  for (const row of rows) {
    await adminSupabase.from("messages").upsert(row, {
      onConflict: "user_id,platform,platform_message_id",
      ignoreDuplicates: false,
    });
  }

  return new Response(
    JSON.stringify({
      synced: rows.length,
      priorities: {
        urgent: priorities.filter((p) => p.priority === "urgent").length,
        important: priorities.filter((p) => p.priority === "important").length,
        normal: priorities.filter((p) => p.priority === "normal").length,
      },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
