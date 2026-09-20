import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "@/components/app/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import Home from "@/pages/Home";
import SignIn from "@/pages/SignIn";
import JudgeLink from "@/pages/JudgeLink";
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

// The private judge sign-in. Anyone already signed in as the judge has nothing to sign in to.
function JudgeEntry() {
  const { session } = useAuth();
  return session?.role === "judge" ? <Navigate to="/" replace /> : <SignIn variant="judge" />;
}

export default function App() {
  return (
    <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/judge" element={<JudgeEntry />} />
        <Route path="/j/:key" element={<JudgeLink />} />
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
