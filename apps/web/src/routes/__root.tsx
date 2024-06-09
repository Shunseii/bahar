import React, { useEffect } from "react";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { trpc } from "@/lib/trpc";

const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null // Render nothing in production
  : React.lazy(() =>
      // Lazy load in development
      import("@tanstack/router-devtools").then((res) => ({
        default: res.TanStackRouterDevtools,
      })),
    );

const Root = () => {
  const { isPending } = trpc.user.me.useQuery();

  useEffect(() => {
    // We updated the body styles in the index to display
    // a background that matches the user's theme from local storage
    // so that there isn't a flash of a white page every time.
    //
    // Here, we undo those styles since they are no longer needed.
    document.body.style.height = "";
    document.body.style.backgroundColor = "";
  }, []);

  if (isPending) {
    return <div>Loading...</div>;
  }

  return (
    <div className="font-primary">
      <Outlet />

      {/* <React.Suspense><TanStackRouterDevtools /></React.Suspense> */}
    </div>
  );
};

type User = {
  id: string;
  username: string;
};

interface RouterContext {
  authState: User;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Root,
});
