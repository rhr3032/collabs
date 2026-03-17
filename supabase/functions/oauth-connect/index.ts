import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PlatformConfig {
  authUrl: string;
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  scopes: string[];
  extraParams?: Record<string, string>;
}

const platformConfigs: Record<string, PlatformConfig> = {
  instagram: {
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    clientIdEnv: "INSTAGRAM_CLIENT_ID",
    clientSecretEnv: "INSTAGRAM_CLIENT_SECRET",
    scopes: ["instagram_business_basic", "instagram_business_manage_messages"],
    extraParams: {},
  },
  tiktok: {
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    clientIdEnv: "TIKTOK_CLIENT_KEY",
    clientSecretEnv: "TIKTOK_CLIENT_SECRET",
    scopes: ["user.info.basic"],
    extraParams: { response_type: "code" },
  },
  twitter: {
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    clientIdEnv: "TWITTER_CLIENT_ID",
    clientSecretEnv: "TWITTER_CLIENT_SECRET",
    scopes: ["tweet.read", "users.read", "dm.read", "offline.access"],
    extraParams: { code_challenge_method: "plain" },
  },
  facebook: {
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    clientIdEnv: "FACEBOOK_CLIENT_ID",
    clientSecretEnv: "FACEBOOK_CLIENT_SECRET",
    scopes: ["pages_messaging", "pages_read_engagement"],
    extraParams: {},
  },
  gmail: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    scopes: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/userinfo.email"],
    extraParams: { access_type: "offline", prompt: "consent" },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action"); // "authorize" or "callback"
  const platform = url.searchParams.get("platform");

  if (!platform || !platformConfigs[platform]) {
    return new Response(JSON.stringify({ error: "Invalid platform" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const config = platformConfigs[platform];
  const clientId = Deno.env.get(config.clientIdEnv);
  const clientSecret = Deno.env.get(config.clientSecretEnv);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: `${platform} credentials not configured. Please add ${config.clientIdEnv} and ${config.clientSecretEnv}.` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── AUTHORIZE: Generate OAuth URL ──
  if (action === "authorize") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
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

    const userId = claimsData.claims.sub;
    const redirectUri = url.searchParams.get("redirect_uri") || `${supabaseUrl}/functions/v1/oauth-connect?action=callback&platform=${platform}`;

    // Build state with user info
    const state = btoa(JSON.stringify({ user_id: userId, platform, redirect_origin: url.searchParams.get("redirect_origin") || "" }));

    // Twitter needs PKCE with code_challenge
    const codeChallenge = platform === "twitter" ? crypto.randomUUID().replace(/-/g, "") : undefined;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: config.scopes.join(platform === "tiktok" ? "," : " "),
      response_type: "code",
      state,
      ...config.extraParams,
    });

    if (codeChallenge) {
      params.set("code_challenge", codeChallenge);
      // Store code_verifier for callback
      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
      // We'll pass it in state for simplicity
      const stateWithVerifier = btoa(JSON.stringify({
        user_id: userId,
        platform,
        redirect_origin: url.searchParams.get("redirect_origin") || "",
        code_verifier: codeChallenge,
      }));
      params.set("state", stateWithVerifier);
    }

    // TikTok uses client_key instead of client_id
    if (platform === "tiktok") {
      params.delete("client_id");
      params.set("client_key", clientId);
    }

    const authUrl = `${config.authUrl}?${params.toString()}`;

    return new Response(JSON.stringify({ url: authUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── CALLBACK: Exchange code for token ──
  if (action === "callback") {
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");

    if (!code || !stateParam) {
      return new Response("Missing code or state", { status: 400, headers: corsHeaders });
    }

    let stateData: { user_id: string; platform: string; redirect_origin: string; code_verifier?: string };
    try {
      stateData = JSON.parse(atob(stateParam));
    } catch {
      return new Response("Invalid state", { status: 400, headers: corsHeaders });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/oauth-connect?action=callback&platform=${platform}`;

    // Exchange code for tokens
    const tokenParams: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    };

    if (platform === "tiktok") {
      tokenParams.client_key = clientId;
      tokenParams.client_secret = clientSecret;
    } else {
      tokenParams.client_id = clientId;
      tokenParams.client_secret = clientSecret;
    }

    if (stateData.code_verifier) {
      tokenParams.code_verifier = stateData.code_verifier;
    }

    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(tokenParams).toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      console.error("Token exchange failed:", tokenData);
      const redirectUrl = stateData.redirect_origin
        ? `${stateData.redirect_origin}/app/accounts?error=token_exchange_failed`
        : null;
      if (redirectUrl) {
        return new Response(null, { status: 302, headers: { ...corsHeaders, Location: redirectUrl } });
      }
      return new Response(JSON.stringify({ error: "Token exchange failed", details: tokenData }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresIn = tokenData.expires_in;
    const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    // Fetch user info from platform
    let platformUserId = "";
    let username = "";

    try {
      if (platform === "instagram") {
        const meRes = await fetch(`https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${accessToken}`);
        const me = await meRes.json();
        platformUserId = me.id || "";
        username = me.username || "";
      } else if (platform === "facebook") {
        const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`);
        const me = await meRes.json();
        platformUserId = me.id || "";
        username = me.name || "";
      } else if (platform === "twitter") {
        const meRes = await fetch("https://api.x.com/2/users/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const me = await meRes.json();
        platformUserId = me.data?.id || "";
        username = `@${me.data?.username || ""}`;
      } else if (platform === "tiktok") {
        const openId = tokenData.open_id || "";
        platformUserId = openId;
        username = "TikTok User";
      } else if (platform === "gmail") {
        const meRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const me = await meRes.json();
        platformUserId = me.id || "";
        username = me.email || "";
      }
    } catch (e) {
      console.error("Failed to fetch user info:", e);
    }

    // Store in database
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { error: upsertError } = await adminSupabase
      .from("connected_accounts")
      .upsert(
        {
          user_id: stateData.user_id,
          platform,
          platform_user_id: platformUserId,
          username,
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: tokenExpiresAt,
          scopes: config.scopes,
          status: "active",
        },
        { onConflict: "user_id,platform" }
      );

    if (upsertError) {
      console.error("Upsert error:", upsertError);
    }

    // Redirect back to app
    const redirectOrigin = stateData.redirect_origin || "";
    const successUrl = `${redirectOrigin}/app/accounts?connected=${platform}`;

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: successUrl },
    });
  }

  // ── DISCONNECT ──
  if (action === "disconnect") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
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

    const { error: delError } = await supabase
      .from("connected_accounts")
      .delete()
      .eq("user_id", claimsData.claims.sub)
      .eq("platform", platform);

    if (delError) {
      return new Response(JSON.stringify({ error: delError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
