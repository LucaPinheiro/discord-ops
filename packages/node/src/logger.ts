import type { Logger } from "./types.js";

const prefix = "[discord-ops]";

export const defaultLogger: Logger = {
  debug: (msg, meta) => console.debug(`${prefix} ${msg}`, meta ?? ""),
  info: (msg, meta) => console.info(`${prefix} ${msg}`, meta ?? ""),
  warn: (msg, meta) => console.warn(`${prefix} ${msg}`, meta ?? ""),
  error: (msg, meta) => console.error(`${prefix} ${msg}`, meta ?? ""),
};

export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
