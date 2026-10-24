import { describe, expect, it } from "vitest";
import { createApplicationError, isApplicationError } from "./applicationError";

describe("createApplicationError", () => {
  it("keeps a stable code so callers can branch without reading the message", () => {
    const error = createApplicationError("applicationNotFound", "That application folder is not deployed", { folderName: "poolcomp" });
    expect(isApplicationError(error)).toBe(true);
    expect(error).toMatchObject({ code: "applicationNotFound", details: { folderName: "poolcomp" } });
    expect(error).toBeInstanceOf(Error);
  });
});
