import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Camera, FileText, Film } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import { startGoogleSignIn } from "@/lib/google";
import type { AuthConfig } from "@vaani/shared";

const STEPS = [
  { icon: FileText, text: "Paste a GitHub repo and get a script, in English or Hinglish." },
  { icon: Camera, text: "Record it scene by scene against a teleprompter." },
  { icon: Film, text: "Get a video in your own voice, with your face and the visuals timed to what you say." },
];

// The address in the blog post: sign in with the shared test account. (The judge
// has no password; they open their private link instead.)
export default function SignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Google sign-in appears only when the server has it switched on.
  const [google, setGoogle] = useState<AuthConfig["google"]>(null);

  useEffect(() => {
    api.authConfig().then((config) => setGoogle(config.google)).catch(() => setGoogle(null));
  }, []);

  async function handleGoogle() {
    if (!google) return;
    setBusy(true);
    setError(null);
    try {
      await startGoogleSignIn(google);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start Google sign-in");
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(username.trim(), password);
      navigate("/app/studio", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-10">
      <Logo />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Try Vaani</CardTitle>
          <CardDescription>Sign in with the test account from the blog post.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
            {STEPS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5">
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{text}</span>
              </li>
            ))}
          </ul>

          {google && (
            <>
              <Button type="button" variant="outline" size="lg" onClick={handleGoogle} disabled={busy}>
                Continue with Google
              </Button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or use the test account
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={busy}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" size="lg" disabled={busy || !username || !password}>
              {busy ? <Spinner data-icon="inline-start" /> : null}
              Sign in
              {!busy && <ArrowRight data-icon="inline-end" />}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            Each test account can make one video, so please keep to a small repo and a short script. Camera and
            microphone access is asked for in the browser when you record.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
