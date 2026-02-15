/**
 * Simple logger for debugging.
 * All logs are plaintext and written to the browser console.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

let currentLevel: LogLevel = "debug";

function timestamp(): string {
    return new Date().toISOString().slice(11, 23);
}

function log(level: LogLevel, tag: string, message: string, data?: unknown): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) {
        return;
    }
    var prefix = "[" + timestamp() + "] [" + level.toUpperCase() + "] [" + tag + "]";
    if (data !== undefined) {
        console.log(prefix, message, data);
    } else {
        console.log(prefix, message);
    }
}

export function setLogLevel(level: LogLevel): void {
    currentLevel = level;
}

export function debug(tag: string, message: string, data?: unknown): void {
    log("debug", tag, message, data);
}

export function info(tag: string, message: string, data?: unknown): void {
    log("info", tag, message, data);
}

export function warn(tag: string, message: string, data?: unknown): void {
    log("warn", tag, message, data);
}

export function error(tag: string, message: string, data?: unknown): void {
    log("error", tag, message, data);
}
