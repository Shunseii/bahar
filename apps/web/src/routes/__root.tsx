import { useLingui } from "@lingui/react/macro";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { useDocumentTitle } from "@uidotdev/usehooks";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import type { authClient } from "@/lib/auth-client";

// const TanStackRouterDevtools = import.meta.env.PROD
//   ? () => null // Render nothing in production
//   : React.lazy(() =>
//       // Lazy load in development
//       import("@tanstack/router-devtools").then((res) => ({
//         default: res.TanStackRouterDevtools,
//       })),
//     );

const Root = () => {
  const { t } = useLingui();
  useDocumentTitle(t`Bahar`);

  useEffect(() => {
    // We updated the body styles in the index to display
    // a background that matches the user's theme from local storage
    // so that there isn't a flash of a white page every time.
    //
    // Here, we undo those styles since they are no longer needed.
    document.body.style.height = "";
    document.body.style.backgroundColor = "";
  }, []);

  return (
    <div className="font-primary">
      <Outlet />
      <Toaster />

      {/* <React.Suspense><TanStackRouterDevtools /></React.Suspense> */}
    </div>
  );
};

type User = (typeof authClient.$Infer.Session)["user"];

interface RouterContext {
  authState: User | null;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Root,
});
