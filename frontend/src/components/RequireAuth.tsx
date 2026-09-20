import { Navigate, Outlet } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

// Everything under /app needs a signed-in account.
export function RequireAuth() {
  const { session, checking } = useAuth();
  if (checking) return <Skeleton className="m-8 h-40" />;
  return session ? <Outlet /> : <Navigate to="/" replace />;
}
