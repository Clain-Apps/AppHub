import { describe, expect, it } from "vitest";
import type { EventFromBackend, HostedApplication } from "apphub-shared";
import { createCatalogRefresh } from "./createCatalogRefresh";

const sampleApplications: HostedApplication[] = [
  {
    folderName: "poolcomp",
    displayName: "Pool Comp",
    imageAddress: null,
    webAddress: "https://poolcomp.example.test",
    isActive: true,
  },
];

describe("createCatalogRefresh", () => {
  it("coalesces overlapping refreshes into one scan and one catalogChanged event", async () => {
    const publishedEvents: EventFromBackend[] = [];
    let scanCount = 0;
    let finishScan: ((applications: HostedApplication[]) => void) | undefined;
    const refresh = createCatalogRefresh({
      listApplications: () => {
        scanCount += 1;
        return new Promise((resolve) => {
          finishScan = resolve;
        });
      },
      publishEvent: (event) => {
        publishedEvents.push(event);
      },
    });

    const first = refresh.startCatalogRefresh();
    const second = refresh.startCatalogRefresh();
    expect(scanCount).toBe(1);
    expect(publishedEvents.filter((event) => event.name === "catalogRefreshStarted")).toHaveLength(2);

    finishScan?.(sampleApplications);
    await expect(first).resolves.toEqual(sampleApplications);
    await expect(second).resolves.toEqual(sampleApplications);

    expect(scanCount).toBe(1);
    expect(publishedEvents.filter((event) => event.name === "catalogChanged")).toHaveLength(1);
    expect(publishedEvents.filter((event) => event.name === "catalogChanged")[0]).toMatchObject({
      applications: sampleApplications,
    });
  });
});
