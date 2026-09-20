import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { callbackUrl, takeGoogleAttempt } from "@/lib/google";

// Where Google (through Cognito) sends people back to. Checks the return trip is the one
// this browser started, swaps the code for a session, and moves on to the studio.
export default function GoogleCallback() {
  const { signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const attempt = takeGoogleAttempt();
    if (params.get("error") || !code) {
      setError("Google sign-in was cancelled or didn't complete.");
      return;
    }
    if (!attempt || attempt.state !== params.get("state")) {
      setError("This sign-in didn't start on this browser. Please try again.");
      return;
    }
    signInWithGoogle(code, attempt.verifier, callbackUrl())
      .then(() => navigate("/app/studio", { replace: true }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Google sign-in didn't complete."));
  }, [signInWithGoogle, navigate]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-4">
      <Logo />
      {error ? (
        <>
          <Alert variant="destructive" className="max-w-sm">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button render={<Link to="/sign-in" />} variant="outline">
            Back to sign-in
          </Button>
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Signing you in with Google
        </p>
      )}
    </div>
  );
}
