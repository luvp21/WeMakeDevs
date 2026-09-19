import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { AppShell } from "@/components/app/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import Landing from "@/pages/Landing";
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
