import { describe, expect, it } from "vitest";
import { mergeHostedApplications } from "./mergeHostedApplications";

describe("mergeHostedApplications", () => {
  it("overlays catalog names and images, and marks matching processes as active", () => {
    const applications = mergeHostedApplications({
      folderNames: ["poolcomp", "journal"],
      processPaths: ["/srv/apps/poolcomp"],
      applicationsDirectory: "/srv/apps",
      catalogDocument: {
        applications: {
          poolcomp: { displayName: "Pool Comp", imageFileName: "poolcomp.webp" },
        },
      },
      publicApplicationHost: "example.test",
      publicPathPrefix: "",
    });

    expect(applications).toEqual([
      {
        folderName: "journal",
        displayName: "journal",
        imageAddress: null,
        webAddress: "https://journal.example.test",
        isActive: false,
      },
      {
        folderName: "poolcomp",
        displayName: "Pool Comp",
        imageAddress: "/catalog-images/poolcomp.webp",
        webAddress: "https://poolcomp.example.test",
        isActive: true,
      },
    ]);
  });

  it("prefixes catalog image addresses when the application is served under a path", () => {
    const applications = mergeHostedApplications({
      folderNames: ["poolcomp"],
      processPaths: [],
      applicationsDirectory: "/apps",
      catalogDocument: {
        applications: {
          poolcomp: { displayName: "Pool Comp", imageFileName: "poolcomp.webp" },
        },
      },
      publicApplicationHost: "example.test",
      publicPathPrefix: "/allapps",
    });

    expect(applications[0]?.imageAddress).toBe("/allapps/catalog-images/poolcomp.webp");
  });
});
