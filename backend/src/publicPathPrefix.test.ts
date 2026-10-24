import { describe, expect, it } from "vitest";
import { normalisePublicPathPrefix, pathWithoutPublicPrefix } from "./publicPathPrefix";

describe("public path prefix", () => {
  it("accepts an empty prefix and a single application segment", () => {
    expect(normalisePublicPathPrefix(undefined)).toBe("");
    expect(normalisePublicPathPrefix("/")).toBe("");
    expect(normalisePublicPathPrefix("allapps")).toBe("/allapps");
    expect(normalisePublicPathPrefix("/allapps/")).toBe("/allapps");
  });

  it("rejects a prefix that could point at another path", () => {
    expect(() => normalisePublicPathPrefix("/../poolcomp")).toThrow();
    expect(() => normalisePublicPathPrefix("/allapps/../journal")).toThrow();
  });

  it("strips the prefix when it is present and leaves other paths unchanged", () => {
    expect(pathWithoutPublicPrefix({ path: "/allapps", publicPathPrefix: "/allapps" })).toBe("/");
    expect(pathWithoutPublicPrefix({ path: "/allapps/", publicPathPrefix: "/allapps" })).toBe("/");
    expect(pathWithoutPublicPrefix({ path: "/allapps/api/health", publicPathPrefix: "/allapps" })).toBe("/api/health");
    expect(pathWithoutPublicPrefix({ path: "/allapps/socket", publicPathPrefix: "/allapps" })).toBe("/socket");
    expect(pathWithoutPublicPrefix({ path: "/api/health", publicPathPrefix: "/allapps" })).toBe("/api/health");
    expect(pathWithoutPublicPrefix({ path: "/allapps-other", publicPathPrefix: "/allapps" })).toBe("/allapps-other");
  });
});
