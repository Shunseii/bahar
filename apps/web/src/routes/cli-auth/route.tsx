import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

type CliAuthSearch = {
  port: number;
  state: string;
};

export const Route = createFileRoute("/cli-auth")({
  validateSearch: (search: Record<string, unknown>): CliAuthSearch => ({
    port: Number(search.port),
    state: String(search.state ?? ""),
  }),
  beforeLoad: async ({ location }) => {
    const { data } = await authClient.getSession();

    if (!data?.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
});
