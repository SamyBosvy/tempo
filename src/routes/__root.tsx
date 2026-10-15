import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { bindQueryClient, startQueueSync } from "@/lib/offline-queue";
import { registerServiceWorker } from "@/lib/pwa";
import { trackQuerySync } from '@/lib/sync-status';

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-5xl font-bold">Off the map</h1>
        <p className="mt-3 text-muted-foreground">That page doesn't exist.</p>
        <Link to="/" className="mt-6 inline-flex h-12 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">
          Back to Tempo
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This screen didn't load</h1>
        <p className="mt-2 text-muted-foreground">Something went wrong. Try again.</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex h-12 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "theme-color", content: "#0F1B2D" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { title: "Tempo" },
      { name: "description", content: "Protect deep work and steady yourself around meetings." },
      { property: "og:title", content: "Tempo" },
      { property: "og:description", content: "Protect deep work and steady yourself around meetings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@400;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    bindQueryClient(queryClient);
    const stop = startQueueSync();
    const stopTracking = trackQuerySync(queryClient);
    registerServiceWorker();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "USER_UPDATED" && sessionStorage.getItem("tempo.emailChange")) {
        sessionStorage.removeItem("tempo.emailChange");
        toast.success("Email updated");
      }
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => {
      stop();
      stopTracking();
      data.subscription.unsubscribe();
    };
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
