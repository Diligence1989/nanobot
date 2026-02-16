/**
 * Logger for the frontend.
 * Writes to browser console AND sends to backend for unified file logging.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

var LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

var currentLevel: LogLevel = "debug";

// Buffer log entries and flush to backend periodically
var logBuffer: Array<{ level: string; tag: string; message: string }> = [];
var flushTimer: ReturnType<typeof setTimeout> | null = null;
var FLUSH_INTERVAL_MS = 2000;
var FLUSH_BATCH_SIZE = 20;

function timestamp(): string {
    return new Date().toISOString().slice(11, 23);
}

function formatData(data: unknown): string {
    if (data === undefined) {
        return "";
    }
    try {
        return " " + JSON.stringify(data);
    } catch (e) {
        return " [unserializable]";
    }
}

function log(level: LogLevel, tag: string, message: string, data?: unknown): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) {
        return;
    }

    var prefix = "[" + timestamp() + "] [" + level.toUpperCase() + "] [" + tag + "]";

    // Console output
    if (data !== undefined) {
        console.log(prefix, message, data);
    } else {
        console.log(prefix, message);
    }

    // Buffer for backend
    var fullMessage = message + formatData(data);
    logBuffer.push({ level: level, tag: tag, message: fullMessage });

    // Auto-flush if buffer is large
    if (logBuffer.length >= FLUSH_BATCH_SIZE) {
        flushLogs();
    } else if (flushTimer === null) {
        flushTimer = setTimeout(flushLogs, FLUSH_INTERVAL_MS);
    }
}

function flushLogs(): void {
    if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }

    if (logBuffer.length === 0) {
        return;
    }

    var entries = logBuffer.slice();
    logBuffer = [];

    // Fire and forget — don't block on this
    fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: entries }),
    }).catch(function () {
        // Silently ignore — backend might be down
    });
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
