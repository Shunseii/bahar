import { LanguageMenu } from "@/components/LanguageMenu";
import { Page } from "@/components/Page";
import { ThemeMenu } from "@/components/ThemeMenu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Trans } from "@lingui/macro";
import { createLazyFileRoute } from "@tanstack/react-router";

const Settings = () => {
  return (
    <Page className="m-auto max-w-4xl w-full flex flex-col gap-y-8">
      <h1 className="text-center text-3xl font-primary font-semibold">
        <Trans>Settings</Trans>
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>
            <Trans>Appearance</Trans>
          </CardTitle>

          <CardDescription>
            <Trans>Customize how the application looks for you.</Trans>
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-y-4">
          <ThemeMenu />
          <LanguageMenu />
        </CardContent>
      </Card>
    </Page>
  );
};

export const Route = createLazyFileRoute("/_app-layout/settings")({
  component: Settings,
});
