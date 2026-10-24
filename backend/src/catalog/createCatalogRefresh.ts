import type { EventFromBackend, HostedApplication } from "apphub-shared";

export function createCatalogRefresh({
  listApplications,
  publishEvent,
}: {
  listApplications(): Promise<HostedApplication[]>;
  publishEvent(event: EventFromBackend): void;
}) {
  let inFlightRefresh: Promise<HostedApplication[]> | null = null;

  return {
    startCatalogRefresh,
  };

  function startCatalogRefresh(): Promise<HostedApplication[]> {
    publishEvent({ topic: "catalog", name: "catalogRefreshStarted" });
    if (inFlightRefresh) return inFlightRefresh;
    inFlightRefresh = runScan().finally(() => {
      inFlightRefresh = null;
    });
    return inFlightRefresh;
  }

  async function runScan(): Promise<HostedApplication[]> {
    const applications = await listApplications();
    publishEvent({ topic: "catalog", name: "catalogChanged", applications });
    return applications;
  }
}
