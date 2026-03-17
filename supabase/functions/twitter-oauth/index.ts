import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

async function hmacSha1(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function generateNonce(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("").substring(0, 32);
}

async function buildOAuthHeader(
  method: string,
  baseUrl: string,
  oauthExtras: Record<string, string>,
  consumerKey: string,
  consumerSecret: string,
  tokenSecret = ""
): Promise<string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    ...oauthExtras,
  };

  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join("&");

  const baseString = `${method.toUpperCase()}&${percentEncode(baseUrl)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;

  console.log("Signature base string:", baseString);

  oauthParams.oauth_signature = await hmacSha1(signingKey, baseString);

  const headerString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(", ");

  return `OAuth ${headerString}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const consumerKey = Deno.env.get("TWITTER_CONSUMER_KEY")?.trim();
  const consumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!consumerKey || !consumerSecret) {
    return new Response(
      JSON.stringify({ error: "Twitter credentials not configured" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // ── STEP 1: Get request token and return Twitter auth URL ──
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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const redirectOrigin = url.searchParams.get("redirect_origin") || "";
    const callbackCandidates = [
      `${supabaseUrl}/functions/v1/twitter-oauth?action=callback`,
      `${supabaseUrl}/functions/v1/twitter-oauth`,
    ];

    try {
      const requestTokenUrl = "https://api.x.com/oauth/request_token";
      let oauthToken: string | null = null;
      let oauthTokenSecret: string | null = null;
      let lastErrorBody = "";
      let lastStatus = 0;

      for (const callbackUrl of callbackCandidates) {
        const oauthHeader = await buildOAuthHeader(
          "POST",
          requestTokenUrl,
          { oauth_callback: callbackUrl },
          consumerKey,
          consumerSecret
        );

        console.log("Requesting token from:", requestTokenUrl);
        console.log("Trying callback URL:", callbackUrl);

        const res = await fetch(requestTokenUrl, {
          method: "POST",
          headers: { Authorization: oauthHeader },
        });

        const body = await res.text();

        if (res.ok) {
          const parsed = new URLSearchParams(body);
          oauthToken = parsed.get("oauth_token");
          oauthTokenSecret = parsed.get("oauth_token_secret");

          if (oauthToken && oauthTokenSecret) {
            break;
          }

          lastStatus = 400;
          lastErrorBody = body || "Invalid request token response";
          continue;
        }

        lastStatus = res.status;
        lastErrorBody = body;
        console.error("Request token failed:", res.status, body);

        const callbackNotApproved = res.status === 403 && body.includes('code="415"');
        if (callbackNotApproved) {
          continue;
        }

        break;
      }

      if (!oauthToken || !oauthTokenSecret) {
        const callbackNotApproved = lastStatus === 403 && lastErrorBody.includes('code="415"');
        const error = callbackNotApproved
          ? `Callback URL not approved in X app settings. Add one of: ${callbackCandidates.join(" OR ")}`
          : "Failed to get request token";

        return new Response(JSON.stringify({ error, details: lastErrorBody }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Store temp token secret + user info for the callback
      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
      await adminSupabase.from("connected_accounts").upsert(
        {
          user_id: userId,
          platform: "twitter",
          platform_user_id: oauthToken,
          access_token_secret: oauthTokenSecret,
          access_token: redirectOrigin,
          status: "pending",
          username: null,
        },
        { onConflict: "user_id,platform" }
      );

      const authUrl = `https://api.x.com/oauth/authorize?oauth_token=${oauthToken}`;
      return new Response(JSON.stringify({ url: authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error("Authorize error:", e);
      return new Response(JSON.stringify({ error: "Authorization failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ── STEP 2: Callback - exchange verifier for access token ──
  const oauthTokenParam = url.searchParams.get("oauth_token");
  const oauthVerifierParam = url.searchParams.get("oauth_verifier");

  // Callback can arrive with or without action query parameter.
  if (action === "callback" || (!action && oauthTokenParam && oauthVerifierParam)) {
    const oauthToken = oauthTokenParam;
    const oauthVerifier = oauthVerifierParam;

    if (!oauthToken || !oauthVerifier) {
      return new Response("Missing oauth_token or oauth_verifier", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: pendingAccount, error: findError } = await adminSupabase
      .from("connected_accounts")
      .select("*")
      .eq("platform", "twitter")
      .eq("platform_user_id", oauthToken)
      .eq("status", "pending")
      .maybeSingle();

    if (!pendingAccount) {
      console.error("No pending account found for token:", oauthToken, findError);
      return new Response("Invalid or expired OAuth session", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const requestTokenSecret = pendingAccount.access_token_secret || "";
    const redirectOrigin = pendingAccount.access_token || "";

    try {
      const accessTokenUrl = "https://api.x.com/oauth/access_token";
      const oauthHeader = await buildOAuthHeader(
        "POST",
        accessTokenUrl,
        {
          oauth_token: oauthToken,
          oauth_verifier: oauthVerifier,
        },
        consumerKey,
        consumerSecret,
        requestTokenSecret
      );

      const res = await fetch(accessTokenUrl, {
        method: "POST",
        headers: { Authorization: oauthHeader },
      });

      const body = await res.text();
      if (!res.ok) {
        console.error("Access token exchange failed:", body);
        const errorUrl = `${redirectOrigin}/app/accounts?error=token_exchange_failed`;
        return new Response(null, { status: 302, headers: { ...corsHeaders, Location: errorUrl } });
      }

      const parsed = new URLSearchParams(body);
      const accessToken = parsed.get("oauth_token") || "";
      const accessTokenSecret = parsed.get("oauth_token_secret") || "";
      const twitterUserId = parsed.get("user_id") || "";
      const screenName = parsed.get("screen_name") || "";

      const { error: updateError } = await adminSupabase
        .from("connected_accounts")
        .update({
          access_token: accessToken,
          access_token_secret: accessTokenSecret,
          platform_user_id: twitterUserId,
          username: `@${screenName}`,
          status: "active",
          scopes: ["dm.read", "dm.write", "tweet.read", "users.read"],
        })
        .eq("user_id", pendingAccount.user_id)
        .eq("platform", "twitter");

      if (updateError) {
        console.error("Update error:", updateError);
      }

      const successUrl = `${redirectOrigin}/app/accounts?connected=twitter`;
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: successUrl },
      });
    } catch (e) {
      console.error("Callback error:", e);
      const errorUrl = `${redirectOrigin}/app/accounts?error=callback_failed`;
      return new Response(null, { status: 302, headers: { ...corsHeaders, Location: errorUrl } });
    }
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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: delError } = await supabase
      .from("connected_accounts")
      .delete()
      .eq("user_id", user.id)
      .eq("platform", "twitter");

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
