import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";

// The private link given to the judge: /j/<key>. Opening it signs in as the
// judge and moves on to the site, so the key doesn't stay in the address bar or
// the browser history.
export default function JudgeLink() {
  const { key } = useParams();
  const { signInWithJudgeLink } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    signInWithJudgeLink(key)
      .then(() => navigate("/", { replace: true }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "This link isn't valid."));
  }, [key, signInWithJudgeLink, navigate]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-4">
      <Logo />
      {error ? (
        <>
          <Alert variant="destructive" className="max-w-sm">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button render={<Link to="/" />} variant="outline">
            Go to the start page
          </Button>
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Signing you in
        </p>
      )}
    </div>
  );
}
