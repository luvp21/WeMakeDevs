import { Navigate } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import Landing from "@/pages/Landing";
import SignIn from "@/pages/SignIn";

// The address in the blog post. What it shows depends on who is signed in: the
// judge gets the full site, a tester goes straight to the tool, and everyone else
// gets the tester sign-in.
export default function Home() {
  const { session, checking } = useAuth();
  if (checking) return <Skeleton className="m-8 h-40" />;
  if (session?.role === "judge") return <Landing />;
  if (session) return <Navigate to="/app/studio" replace />;
  return <SignIn variant="tester" />;
}
