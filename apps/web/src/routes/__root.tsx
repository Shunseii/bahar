import React, { useEffect } from "react";
import {
  createRootRoute,
  Link,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null // Render nothing in production
  : React.lazy(() =>
      // Lazy load in development
      import("@tanstack/router-devtools").then((res) => ({
        default: res.TanStackRouterDevtools,
      })),
    );

const Nav = () => {
  const navigate = useNavigate({ from: "/" });
  const { mutate: logout } = trpc.auth.logout.useMutation();
  const queryClient = useQueryClient();

  return (
    <div className="p-2 flex gap-2">
      <Link to="/" className="[&.active]:font-bold">
        Home
      </Link>

      <Button
        variant="link"
        onClick={async () => {
          logout();

          await queryClient.invalidateQueries();

          navigate({ to: "/login", replace: true, resetScroll: true });
        }}
      >
        Logout
      </Button>
    </div>
  );
};

const Root = () => {
  const { isPending, data: me } = trpc.user.me.useQuery();
  const isAuthenticated = !!me;

  useEffect(() => {
    // We updated the body styles in the index to display
    // a background that matches the user's theme from local storage
    // so that there isn't a flash of a white page every time.
    //
    // Here, we undo those styles since they are no longer needed.
    document.body.style.height = "";
    document.body.style.backgroundColor = "";
  }, []);

  console.log("API", import.meta.env.VITE_API_BASE_URL);

  if (isPending) {
    return <div>Loading...</div>;
  }

  return (
    <div className="font-primary">
      {/* {isAuthenticated ? ( */}
      {/*   <> */}
      {/*     <Nav /> */}
      {/**/}
      {/*     <hr /> */}
      {/*   </> */}
      {/* ) : undefined} */}

      <Outlet />

      <React.Suspense>{/* <TanStackRouterDevtools /> */}</React.Suspense>
    </div>
  );
};

export const Route = createRootRoute({
  component: Root,
});
