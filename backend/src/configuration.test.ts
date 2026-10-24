import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadConfiguration } from "./configuration";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

describe("configuration", () => {
  it("applies local defaults from the repository root", () => {
    const configuration = loadConfiguration({});
    expect(configuration).toMatchObject({
      appsDirectory: resolve(repositoryRoot, ".data/apps"),
      catalogDirectory: resolve(repositoryRoot, ".data/catalog"),
      publicApplicationHost: "localhost",
      port: 3001,
      allowedOrigins: ["http://localhost:5180"],
      listenHost: "127.0.0.1",
      publicPathPrefix: "",
    });
  });

  it("splits the allowed origins and reads the host settings", () => {
    const configuration = loadConfiguration({
      APPS_DIRECTORY: "/srv/apps",
      CATALOG_DIRECTORY: "/srv/catalog",
      PUBLIC_APPLICATION_HOST: "example.test",
      ALLOWED_ORIGINS: "https://one.test, https://two.test",
      BACKEND_PORT: "4000",
      LISTEN_HOST: "127.0.0.1",
      PUBLIC_PATH_PREFIX: "/allapps/",
    });
    expect(configuration).toMatchObject({
      appsDirectory: "/srv/apps",
      catalogDirectory: "/srv/catalog",
      publicApplicationHost: "example.test",
      allowedOrigins: ["https://one.test", "https://two.test"],
      port: 4000,
      listenHost: "127.0.0.1",
      publicPathPrefix: "/allapps",
    });
  });
});
