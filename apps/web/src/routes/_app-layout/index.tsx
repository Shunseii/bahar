import { queryClient } from "@/lib/query";
import { trpc, trpcClient } from "@/lib/trpc";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getQueryKey } from "@trpc/react-query";

export const Route = createFileRoute("/_app-layout/")({
  beforeLoad: async ({ location }) => {
    const authData = await queryClient.fetchQuery({
      queryKey: [...getQueryKey(trpc.user.me), { type: "query" }],
      queryFn: () => trpcClient.user.me.query(),
    });

    const isAuthenticated = !!authData;

    if (!isAuthenticated) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
  },
});
