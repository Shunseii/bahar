import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bahar/web-ui/components/card";
import { Trans } from "@lingui/react/macro";
import { CardAppearanceEditor } from "./CardAppearanceEditor";

export const CardAppearanceCardSection = () => (
  <Card>
    <CardHeader>
      <CardTitle>
        <Trans>Card appearance</Trans>
      </CardTitle>
      <CardDescription>
        <Trans>
          This is your card. Click a field to hide it, drag to reorder. Every
          entry makes a forward and a reverse card, each with a question and an
          answer side.
        </Trans>
      </CardDescription>
    </CardHeader>

    <CardContent>
      <CardAppearanceEditor />
    </CardContent>
  </Card>
);
