import { describe, expect, it } from "vitest";
import { applicationIsActive } from "./applicationIsActive";

const applicationFolderPath = "/var/www/apps/poolcomp";

describe("applicationIsActive", () => {
  it("matches an exact working directory", () => {
    expect(
      applicationIsActive({
        applicationFolderPath,
        processPaths: ["/var/www/apps/poolcomp"],
      }),
    ).toBe(true);
  });

  it("matches a nested working directory", () => {
    expect(
      applicationIsActive({
        applicationFolderPath,
        processPaths: ["/var/www/apps/poolcomp/dist"],
      }),
    ).toBe(true);
  });

  it("matches a command line that contains the folder as a path", () => {
    expect(
      applicationIsActive({
        applicationFolderPath,
        processPaths: ["node /var/www/apps/poolcomp/server.js --port 3000"],
      }),
    ).toBe(true);
  });

  it("does not match a longer sibling folder name", () => {
    expect(
      applicationIsActive({
        applicationFolderPath: "/var/www/apps/pool",
        processPaths: ["/var/www/apps/poolcomp", "node /var/www/apps/poolcomp/server.js"],
      }),
    ).toBe(false);
  });

  it("does not match an unrelated process", () => {
    expect(
      applicationIsActive({
        applicationFolderPath,
        processPaths: ["/usr/bin/node", "nginx: master process"],
      }),
    ).toBe(false);
  });

  it("treats Windows paths as the same folder", () => {
    expect(
      applicationIsActive({
        applicationFolderPath: "F:\\Repos\\apps\\poolcomp",
        processPaths: ["node F:\\Repos\\apps\\poolcomp\\src\\index.ts"],
      }),
    ).toBe(true);
  });
});
