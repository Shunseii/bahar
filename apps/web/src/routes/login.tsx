import { queryClient } from "@/lib/query";
import { trpc, trpcClient } from "@/lib/trpc";
import { redirect } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { getQueryKey } from "@trpc/react-query";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const authData = await queryClient.fetchQuery({
      queryKey: [...getQueryKey(trpc.user.me), { type: "query" }],
      queryFn: () => trpcClient.user.me.query(),
    });

    const isAuthenticated = !!authData;

    if (isAuthenticated) {
      throw redirect({
        to: "/",
      });
    }
  },
});
