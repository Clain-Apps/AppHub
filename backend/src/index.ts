import { isApplicationError } from "apphub-shared";
import { createApplication } from "./application";
import { loadConfiguration, loadEnvironmentFile } from "./configuration";
import { createConsoleLogger } from "./logger";

async function main(): Promise<void> {
  const logger = createConsoleLogger();
  loadEnvironmentFile();
  const configuration = loadConfiguration();
  const application = createApplication({
    configuration,
    logger,
  });

  const port = await application.start(configuration.port);
  logger.log({
    level: "info",
    event: "backendStarted",
    fields: { port },
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      logger.log({
        level: "info",
        event: "backendStopping",
        fields: { signal },
      });
      application
        .stop()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
  }
}

main().catch((error: unknown) => {
  console.error(isApplicationError(error) ? error.message : "The backend could not start");
  if (!isApplicationError(error)) console.error(error);
  process.exitCode = 1;
});
