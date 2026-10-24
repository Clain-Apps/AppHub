export type LogLevel = "info" | "warning" | "error";

export type LogFields = Record<string, string | number | boolean | null>;

export interface LogParameters {
  level: LogLevel;
  event: string;
  fields?: LogFields;
}

export interface Logger {
  log({ level, event, fields }: LogParameters): void;
}

export interface LogLine {
  line: string;
  level: LogLevel;
}

const forbiddenFieldNamePattern = /password|token|cookie|secret|email|phone|contact|authorization/i;

/** Whether a field name suggests a personal detail or a secret. Such values never go to logs. */
export function isSensitiveFieldName(fieldName: string): boolean {
  return forbiddenFieldNamePattern.test(fieldName);
}

/** Builds a logger that hands each finished JSON line to `writeLine`. */
export function createLogger(writeLine: ({ line, level }: LogLine) => void): Logger {
  return {
    log: ({ level, event, fields = {} }) => {
      const safeFields: LogFields = {};
      for (const [name, value] of Object.entries(fields)) {
        safeFields[name] = isSensitiveFieldName(name) ? "[removed]" : value;
      }
      writeLine({ line: JSON.stringify({ time: new Date().toISOString(), level, event, ...safeFields }), level });
    },
  };
}

export function createConsoleLogger(): Logger {
  return createLogger(({ line, level }) => {
    if (level === "error") console.error(line);
    else console.log(line);
  });
}

export function createSilentLogger(): Logger {
  return { log: () => undefined };
}
