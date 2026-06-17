// @ts-nocheck
// debug-log.ts — 模块日志（简化版，转发到 remu 已有的 logger）
//
// 提供 createModuleLogger()，按 openhanako 习惯给每个模块分配 logger。
// 内部转发到 core/logger.ts 的 createLogger()。

import { createLogger, type Logger } from "./logger.js";

export type ModuleLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug: (message: string) => void;
};

export function createModuleLogger(moduleName: string): ModuleLogger {
  const logger: Logger = createLogger({ context: moduleName });
  return {
    info: (message: string) => logger.info(message),
    warn: (message: string) => logger.warn(message),
    error: (message: string) => logger.error(message),
    debug: (message: string) => logger.debug(message),
  };
}
