import { Button } from "@/components/ui/button";
import { createLazyFileRoute } from "@tanstack/react-router";

const Login = () => {
  return (
    <div>
      <Button asChild>
        <a href={`${import.meta.env.VITE_API_BASE_URL}/login/github`}>
          Login with Github
        </a>
      </Button>
    </div>
  );
};

export const Route = createLazyFileRoute("/login")({
  component: Login,
});
