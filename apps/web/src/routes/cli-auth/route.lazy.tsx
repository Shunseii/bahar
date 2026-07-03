import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatedLogo } from "@/components/AnimatedLogo";
import { Page } from "@/components/Page";
import { authClient } from "@/lib/auth-client";

type MintStatus = "minting" | "done" | "error";

const CliAuth = () => {
  const { port, state } = Route.useSearch();
  const [status, setStatus] = useState<MintStatus>("minting");

  useEffect(() => {
    const mintAndRedirect = async () => {
      const { data, error } = await authClient.apiKey.create({
        name: "CLI",
      });

      if (error || !data) {
        setStatus("error");
        return;
      }

      const callbackUrl = new URL(`http://localhost:${port}/callback`);
      callbackUrl.searchParams.set("token", data.key);
      callbackUrl.searchParams.set("state", state);

      setStatus("done");
      window.location.href = callbackUrl.toString();
    };

    mintAndRedirect();
  }, [port, state]);

  return (
    <Page className="mx-auto flex max-w-96 flex-col items-center justify-center gap-y-6 text-center">
      {status !== "error" && <AnimatedLogo className="h-16 w-16" />}

      <h1 className="font-bold text-2xl tracking-tight">
        {status === "error" ? (
          <Trans>Something went wrong</Trans>
        ) : (
          <Trans>Signing in the Bahar CLI...</Trans>
        )}
      </h1>

      <p className="text-muted-foreground text-sm">
        {status === "error"
          ? t`Please return to your terminal and run \`bahar login\` again.`
          : t`You can close this tab once your terminal shows you're signed in.`}
      </p>
    </Page>
  );
};

export const Route = createLazyFileRoute("/cli-auth")({
  component: CliAuth,
});
