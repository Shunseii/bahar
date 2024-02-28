import { trpc } from "../lib/trpc";
import { createLazyFileRoute } from "@tanstack/react-router";

const Index = () => {
  const { isPending, data } = trpc.user.me.useQuery();

  const username = data?.username ?? "";

  if (isPending) {
    return "Loading...";
  }

  return (
    <div className="p-2">
      <h3>Welcome {username ? username : "Home"}!</h3>
    </div>
  );
};

export const Route = createLazyFileRoute("/")({
  component: Index,
});
