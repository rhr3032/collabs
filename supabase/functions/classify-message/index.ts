import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) throw new Error("Unauthorized");

    const { message_id, message_content, sender_name, platform } = await req.json();
    if (!message_id || !message_content) throw new Error("Missing message_id or message_content");

    // Get user's categories and folders with rules
    const [catRes, folderRes, rulesRes] = await Promise.all([
      supabase.from("categories").select("*").eq("user_id", user.id).order("sort_order"),
      supabase.from("folders").select("*").eq("user_id", user.id).order("sort_order"),
      supabase.from("folder_rules").select("*, folders(folder_name, category_id)").eq("user_id", user.id),
    ]);

    const categories = catRes.data || [];
    const folders = folderRes.data || [];
    const rules = rulesRes.data || [];

    // Step 1: Check keyword rules first (fastest)
    const lowerContent = (message_content + " " + sender_name).toLowerCase();
    for (const rule of rules) {
      const keywords: string[] = rule.keywords || [];
      const match = keywords.some((kw: string) => lowerContent.includes(kw.toLowerCase()));
      if (match) {
        const folder = folders.find((f: any) => f.id === rule.folder_id);
        await supabase
          .from("messages")
          .update({ folder_id: rule.folder_id, category_id: folder?.category_id || null })
          .eq("id", message_id);

        return new Response(
          JSON.stringify({ classified: true, folder_id: rule.folder_id, category_id: folder?.category_id, method: "keyword_rule" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Step 2: AI classification (folder + priority)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const categoryList = categories.map((c: any) => `- ${c.name} (id: ${c.id})`).join("\n");
    const folderList = folders.map((f: any) => {
      const cat = categories.find((c: any) => c.id === f.category_id);
      return `- "${f.folder_name}" in category "${cat?.name}" (folder_id: ${f.id}, category_id: ${f.category_id})`;
    }).join("\n");

    const systemPrompt = `You are a message classifier for a creator's DM inbox. You must do TWO things:

1. CLASSIFY into the best matching category and folder.
2. PRIORITIZE the message as urgent, important, or normal.

Priority definitions:
- "urgent": requires immediate attention (complaints, time-sensitive requests, potential crises, angry messages, deadlines)
- "important": should respond within 24h (product questions, collaboration requests, genuine business inquiries)
- "normal": low priority (generic compliments, casual chat, mass outreach, spam-like)

Available categories:
${categoryList || "No categories yet"}

Available folders:
${folderList || "No folders yet"}

Respond using the classify_message tool.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Classify and prioritize this message:\nSender: ${sender_name}\nPlatform: ${platform}\nContent: ${message_content}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_message",
              description: "Classify a message into a category/folder and assign priority",
              parameters: {
                type: "object",
                properties: {
                  category_id: { type: "string", description: "The UUID of the best matching category, or null" },
                  folder_id: { type: "string", description: "The UUID of the best matching folder, or null" },
                  suggested_folder_name: {
                    type: "string",
                    description: "If no folder matches, suggest a name for a new folder. Null if a folder matched.",
                  },
                  suggested_category_id: {
                    type: "string",
                    description: "If suggesting a new folder, which category_id it should go under",
                  },
                  priority: {
                    type: "string",
                    enum: ["urgent", "important", "normal"],
                    description: "Message priority level",
                  },
                  priority_reason: {
                    type: "string",
                    description: "Brief one-sentence explanation of why this priority was assigned",
                  },
                  confidence: { type: "number", description: "Confidence 0-1" },
                },
                required: ["priority", "priority_reason", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_message" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI classification failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const result = JSON.parse(toolCall.function.arguments);

    // Build the update object with priority
    const updateData: Record<string, any> = {
      priority: result.priority || "normal",
      priority_reason: result.priority_reason || null,
    };

    // If AI found a matching folder, update the message
    if (result.folder_id && folders.some((f: any) => f.id === result.folder_id)) {
      const folder = folders.find((f: any) => f.id === result.folder_id);
      updateData.folder_id = result.folder_id;
      updateData.category_id = result.category_id || folder?.category_id || null;

      await supabase.from("messages").update(updateData).eq("id", message_id);

      return new Response(
        JSON.stringify({
          classified: true,
          folder_id: result.folder_id,
          category_id: folder?.category_id,
          priority: result.priority,
          priority_reason: result.priority_reason,
          method: "ai",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If AI found a category but no folder
    if (result.category_id && categories.some((c: any) => c.id === result.category_id)) {
      updateData.category_id = result.category_id;
    }

    await supabase.from("messages").update(updateData).eq("id", message_id);

    return new Response(
      JSON.stringify({
        classified: false,
        suggested_folder_name: result.suggested_folder_name || null,
        suggested_category_id: result.suggested_category_id || result.category_id || null,
        category_id: result.category_id || null,
        priority: result.priority,
        priority_reason: result.priority_reason,
        confidence: result.confidence,
        method: "ai_suggestion",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("classify-message error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
