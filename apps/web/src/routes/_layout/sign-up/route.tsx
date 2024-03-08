import { queryClient } from "@/lib/query";
import { trpc, trpcClient } from "@/lib/trpc";
import { redirect } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { getQueryKey } from "@trpc/react-query";

type SignUpSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/_layout/sign-up")({
  validateSearch: (search: Record<string, unknown>): SignUpSearch => {
    return {
      redirect: (search?.redirect as string) ?? undefined,
    };
  },

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
