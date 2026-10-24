import { describe, expect, it } from "vitest";
import type { HostedApplication } from "apphub-shared";
import { filterVisibleApplications } from "./filterVisibleApplications";

const applications: HostedApplication[] = [
  {
    folderName: "journal",
    displayName: "Journal",
    imageAddress: null,
    webAddress: "https://journal.example.test",
    isActive: false,
  },
  {
    folderName: "poolcomp",
    displayName: "Pool Comp",
    imageAddress: null,
    webAddress: "https://poolcomp.example.test",
    isActive: true,
  },
];

describe("filterVisibleApplications", () => {
  it("shows every application when the active filter is off", () => {
    expect(filterVisibleApplications({ applications, showActiveOnly: false })).toEqual(applications);
  });

  it("keeps only active applications when the filter is on", () => {
    expect(filterVisibleApplications({ applications, showActiveOnly: true })).toEqual([applications[1]]);
  });
});
