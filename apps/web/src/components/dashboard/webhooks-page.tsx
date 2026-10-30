/**
 * GC-Stats - webhooks-page
 *
 * Body of the dashboard webhooks pages: webhooks stay scoped per partner
 * key, a picker switches between the keys of the space.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WebhooksPanel } from "@/components/dashboard/webhooks-panel";
import { WebhookKeySelect } from "@/components/dashboard/webhook-key-select";
import { listRecentWebhookDeliveries, listWebhookEndpoints, listWebhookRegions } from "@/lib/webhooks/endpoints";
import { parseEntityId } from "@/lib/entity-id";
import type { DashboardApiKeyRow } from "@/lib/dashboard-api-keys";

export async function DashboardWebhooksPage({
  locale,
  keys,
  requestedKey,
  basePath,
  organizationId,
}: {
  locale: string;
  keys: DashboardApiKeyRow[];
  requestedKey: string | undefined;
  /** Path of the webhooks page, the key switcher adds `?key=`. */
  basePath: string;
  organizationId: number | null;
}) {
  const t = await getTranslations({ locale, namespace: "dashboard.webhooks" });
  const partnerKeys = keys.filter((k) => k.kind === "partner");
  const requestedId = requestedKey ? parseEntityId(requestedKey) : null;
  const selected = partnerKeys.find((k) => k.id === requestedId) ?? partnerKeys[0] ?? null;

  const [endpoints, deliveries, regions] = selected ? await Promise.all([listWebhookEndpoints(selected.id), listRecentWebhookDeliveries(selected.id), listWebhookRegions()]) : [[], [], []];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{t("pageTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("pageSubtitle")}</p>
        </div>
        {selected && <WebhookKeySelect keys={partnerKeys} selectedId={selected.id} basePath={basePath} label={t("keySwitcher")} />}
      </div>

      {!selected ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">{t("noPartnerKey")}</p>
            <Button variant="outline" size="sm" render={<Link href="/developers-doc" />}>
              {t("requestPartnerKey")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <WebhooksPanel key={selected.id} scope={{ apiKeyId: selected.id, organizationId }} endpoints={endpoints} deliveries={deliveries} regions={regions} keyActive={selected.isActive} />
      )}
    </div>
  );
}
