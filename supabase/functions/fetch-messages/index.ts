import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub as string;
  const url = new URL(req.url);
  const platform = url.searchParams.get("platform");

  if (!platform) {
    return new Response(JSON.stringify({ error: "Platform required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get connected account with tokens
  const adminSupabase = createClient(supabaseUrl, serviceKey);
  const { data: account, error: accError } = await adminSupabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .single();

  if (accError || !account) {
    return new Response(JSON.stringify({ error: "Account not connected" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const accessToken = account.access_token;
  let messages: Array<{
    platform_message_id: string;
    sender_name: string;
    sender_username: string;
    content: string;
    received_at: string;
  }> = [];

  try {
    if (platform === "gmail") {
      // Fetch recent emails
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=subject:(sponsor OR collab OR partnership OR brand deal)`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const listData = await listRes.json();

      if (listData.messages) {
        for (const msg of listData.messages.slice(0, 20)) {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const msgData = await msgRes.json();
          const headers = msgData.payload?.headers || [];
          const from = headers.find((h: any) => h.name === "From")?.value || "Unknown";
          const subject = headers.find((h: any) => h.name === "Subject")?.value || "No subject";
          const date = headers.find((h: any) => h.name === "Date")?.value || new Date().toISOString();

          messages.push({
            platform_message_id: msg.id,
            sender_name: from.split("<")[0].trim() || from,
            sender_username: from,
            content: subject,
            received_at: new Date(date).toISOString(),
          });
        }
      }
    } else if (platform === "instagram") {
      // Instagram Graph API - conversations
      const convRes = await fetch(
        `https://graph.instagram.com/v21.0/me/conversations?fields=messages{message,from,created_time}&access_token=${accessToken}`
      );
      const convData = await convRes.json();
      if (convData.data) {
        for (const conv of convData.data) {
          for (const msg of (conv.messages?.data || []).slice(0, 5)) {
            messages.push({
              platform_message_id: msg.id,
              sender_name: msg.from?.username || "Instagram User",
              sender_username: `@${msg.from?.username || "unknown"}`,
              content: msg.message || "",
              received_at: msg.created_time || new Date().toISOString(),
            });
          }
        }
      }
    } else if (platform === "twitter") {
      // Twitter Collabs
      const dmRes = await fetch("https://api.x.com/2/dm_events?dm_event.fields=text,created_at,sender_id&max_results=20", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const dmData = await dmRes.json();
      if (dmData.data) {
        for (const dm of dmData.data) {
          messages.push({
            platform_message_id: dm.id,
            sender_name: `User ${dm.sender_id}`,
            sender_username: dm.sender_id,
            content: dm.text || "",
            received_at: dm.created_at || new Date().toISOString(),
          });
        }
      }
    } else if (platform === "facebook") {
      // Facebook Page conversations
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
                platform_message_id: msg.id,
                sender_name: msg.from?.name || "Facebook User",
                sender_username: msg.from?.id || "",
                content: msg.message || "",
                received_at: msg.created_time || new Date().toISOString(),
              });
            }
          }
        }
      }
    } else if (platform === "tiktok") {
      // TikTok has very limited messaging API
      // Placeholder - would require TikTok Business API access
      messages = [];
    }
  } catch (e) {
    console.error(`Error fetching ${platform} messages:`, e);
    return new Response(JSON.stringify({ error: `Failed to fetch ${platform} messages`, details: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Store messages in DB (upsert to avoid duplicates)
  if (messages.length > 0) {
    const rows = messages.map((m) => ({
      user_id: userId,
      platform,
      platform_message_id: m.platform_message_id,
      sender_name: m.sender_name,
      sender_username: m.sender_username,
      content: m.content,
      preview: m.content.slice(0, 120),
      received_at: m.received_at,
    }));

    // Use service role to insert (bypasses RLS since we verified the user)
    for (const row of rows) {
      await adminSupabase.from("messages").upsert(row, {
        onConflict: "user_id,platform,platform_message_id",
        ignoreDuplicates: true,
      });
    }

    // Update last_sync_at
    await adminSupabase
      .from("connected_accounts")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("platform", platform);
  }

  return new Response(JSON.stringify({ success: true, count: messages.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
