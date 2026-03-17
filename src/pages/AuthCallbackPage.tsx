import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const { platform } = useParams<{ platform: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Connecting your account...");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const error = searchParams.get("error");

      if (error) {
        setStatus("error");
        setMessage(`Authorization failed: ${error}`);
        setTimeout(() => navigate("/app/accounts"), 3000);
        return;
      }

      if (!code || !platform) {
        setStatus("error");
        setMessage("Missing authorization code or platform.");
        setTimeout(() => navigate("/app/accounts"), 3000);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setStatus("error");
          setMessage("You must be logged in to connect accounts.");
          setTimeout(() => navigate("/login"), 3000);
          return;
        }

        const { data, error: fnError } = await supabase.functions.invoke("oauth-connect", {
          body: { platform, code, redirectUri: `${window.location.origin}/auth/callback/${platform}` },
        });

        if (fnError) throw fnError;

        setStatus("success");
        setMessage(`${platform} connected successfully!`);
        setTimeout(() => navigate("/app/accounts"), 2000);
      } catch (e: any) {
        console.error("OAuth callback error:", e);
        setStatus("error");
        setMessage(e.message || "Failed to connect account.");
        setTimeout(() => navigate("/app/accounts"), 3000);
      }
    };

    handleCallback();
  }, [platform, searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === "loading" && <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />}
        {status === "success" && <div className="text-4xl">✅</div>}
        {status === "error" && <div className="text-4xl">❌</div>}
        <p className="text-lg text-foreground">{message}</p>
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
