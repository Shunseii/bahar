import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@bahar/web-ui/components/breadcrumb";
import { Trans } from "@lingui/react/macro";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { CardAppearanceCardSection } from "@/components/features/settings/CardAppearanceCardSection";
import { Page } from "@/components/Page";

/**
 * Its own page rather than another card in settings: the editor holds a draft
 * until you save it, which is the only unsaved state on that screen, and the
 * four faces need more room than a stacked card gives them.
 */
const CardAppearance = () => (
  <Page>
    <div className="m-auto max-w-3xl">
      <Breadcrumb className="mb-8">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/settings">
                <Trans>Settings</Trans>
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              <Trans>Card appearance</Trans>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <CardAppearanceCardSection />
    </div>
  </Page>
);

export const Route = createLazyFileRoute(
  "/_authorized-layout/_app-layout/settings/card-appearance"
)({
  component: CardAppearance,
});
