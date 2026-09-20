import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "@/components/app/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import Landing from "@/pages/Landing";
import SignIn from "@/pages/SignIn";
import JudgeLink from "@/pages/JudgeLink";
import GoogleCallback from "@/pages/GoogleCallback";
import { RequireAuth } from "@/components/RequireAuth";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/NotFound";

// The app pages pull in the syntax highlighter and recorder code; the public
// landing page shouldn't pay for them.
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Studio = lazy(() => import("@/pages/Studio"));

function PageFallback() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

// The sign-in page; anyone already signed in has nothing to do here.
function SignInRoute() {
  const { session, checking } = useAuth();
  if (checking) return <PageFallback />;
  return session ? <Navigate to="/app/studio" replace /> : <SignIn />;
}

export default function App() {
  return (
    <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/sign-in" element={<SignInRoute />} />
        <Route path="/j/:key" element={<JudgeLink />} />
        <Route path="/auth/callback" element={<GoogleCallback />} />
        <Route element={<RequireAuth />}>
        <Route path="/app" element={<AppShell />}>
          <Route
            index
            element={
              <Suspense fallback={<PageFallback />}>
                <Dashboard />
              </Suspense>
            }
          />
          {/* One route for both new and reopened projects so locking a new
              script (which adds the id to the URL) doesn't remount the page. */}
          <Route
            path="studio/:id?"
            element={
              <Suspense fallback={<PageFallback />}>
                <Studio />
              </Suspense>
            }
          />
        </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  );
}
