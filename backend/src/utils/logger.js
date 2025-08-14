/**
 * Logger Utility - Centralized logging with different levels and formats
 * Provides consistent logging throughout the application
 */

import { createWriteStream } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Log levels
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
};

const LOG_COLORS = {
    ERROR: '\x1b[31m', // Red
    WARN: '\x1b[33m',  // Yellow
    INFO: '\x1b[32m',  // Green
    DEBUG: '\x1b[36m', // Cyan
    TRACE: '\x1b[35m', // Magenta
    RESET: '\x1b[0m'   // Reset
};

class Logger {
    constructor(options = {}) {
        this.level = this.parseLogLevel(options.level || process.env.LOG_LEVEL || 'INFO');
        this.enableColors = options.enableColors !== false && !process.env.NO_COLOR;
        this.enableFileLogging = options.enableFileLogging || process.env.ENABLE_FILE_LOGGING === 'true';
        this.logDir = options.logDir || join(process.cwd(), 'logs');
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.maxFiles = options.maxFiles || 5;
        
        this.fileStreams = {};
        
        if (this.enableFileLogging) {
            this.initializeFileLogging();
        }
    }

    parseLogLevel(level) {
        const normalizedLevel = level.toUpperCase();
        return LOG_LEVELS.hasOwnProperty(normalizedLevel) ? LOG_LEVELS[normalizedLevel] : LOG_LEVELS.INFO;
    }

    initializeFileLogging() {
        try {
            mkdirSync(this.logDir, { recursive: true });
            
            // Create file streams for different log levels
            this.fileStreams.combined = createWriteStream(
                join(this.logDir, 'combined.log'),
                { flags: 'a' }
            );
            
            this.fileStreams.error = createWriteStream(
                join(this.logDir, 'error.log'),
                { flags: 'a' }
            );
        } catch (error) {
            console.error('Failed to initialize file logging:', error.message);
            this.enableFileLogging = false;
        }
    }

    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const baseMessage = {
            timestamp,
            level: level.toLowerCase(),
            message: typeof message === 'string' ? message : JSON.stringify(message),
            pid: process.pid,
            ...meta
        };

        // Console format
        const consoleMessage = this.enableColors
            ? `${LOG_COLORS[level]}[${timestamp}] ${level.padEnd(5)} ${typeof message === 'string' ? message : JSON.stringify(message)}${LOG_COLORS.RESET}`
            : `[${timestamp}] ${level.padEnd(5)} ${typeof message === 'string' ? message : JSON.stringify(message)}`;

        // File format (JSON)
        const fileMessage = JSON.stringify(baseMessage);

        return { consoleMessage, fileMessage };
    }

    shouldLog(level) {
        return LOG_LEVELS[level] <= this.level;
    }

    log(level, message, meta = {}) {
        if (!this.shouldLog(level)) {
            return;
        }

        const { consoleMessage, fileMessage } = this.formatMessage(level, message, meta);

        // Console output
        if (level === 'ERROR') {
            console.error(consoleMessage);
        } else {
            console.log(consoleMessage);
        }

        // File output
        if (this.enableFileLogging && this.fileStreams.combined) {
            this.fileStreams.combined.write(fileMessage + '\n');
            
            // Write errors to separate error log
            if (level === 'ERROR' && this.fileStreams.error) {
                this.fileStreams.error.write(fileMessage + '\n');
            }
        }
    }

    error(message, meta = {}) {
        this.log('ERROR', message, meta);
    }

    warn(message, meta = {}) {
        this.log('WARN', message, meta);
    }

    info(message, meta = {}) {
        this.log('INFO', message, meta);
    }

    debug(message, meta = {}) {
        this.log('DEBUG', message, meta);
    }

    trace(message, meta = {}) {
        this.log('TRACE', message, meta);
    }

    // HTTP request logging helper
    httpRequest(req, res, responseTime) {
        const meta = {
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
            contentLength: res.get('Content-Length')
        };

        const level = res.statusCode >= 400 ? 'WARN' : 'INFO';
        const message = `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${responseTime}ms`;
        
        this.log(level, message, meta);
    }

    // Performance timing helper
    time(label) {
        const start = process.hrtime.bigint();
        return {
            end: () => {
                const end = process.hrtime.bigint();
                const duration = Number(end - start) / 1000000; // Convert to milliseconds
                this.debug(`Timer ${label}: ${duration.toFixed(2)}ms`);
                return duration;
            }
        };
    }

    // Memory usage helper
    memory() {
        const memUsage = process.memoryUsage();
        const formatBytes = (bytes) => {
            return (bytes / 1024 / 1024).toFixed(2) + 'MB';
        };

        this.info('Memory Usage', {
            rss: formatBytes(memUsage.rss),
            heapTotal: formatBytes(memUsage.heapTotal),
            heapUsed: formatBytes(memUsage.heapUsed),
            external: formatBytes(memUsage.external)
        });
    }

    // Graceful shutdown
    close() {
        return new Promise((resolve) => {
            const streams = Object.values(this.fileStreams);
            let pending = streams.length;

            if (pending === 0) {
                resolve();
                return;
            }

            streams.forEach(stream => {
                stream.end(() => {
                    pending--;
                    if (pending === 0) {
                        resolve();
                    }
                });
            });
        });
    }
}

// Create default logger instance
export const logger = new Logger({
    level: process.env.LOG_LEVEL || 'INFO',
    enableColors: !process.env.NO_COLOR,
    enableFileLogging: process.env.ENABLE_FILE_LOGGING === 'true'
});

// Export Logger class for custom instances
export { Logger };

// Export individual log methods for convenience
export const { error, warn, info, debug, trace } = logger;

// Helper function to create child logger with additional context
export const createChildLogger = (context = {}) => {
    return {
        error: (message, meta = {}) => logger.error(message, { ...context, ...meta }),
        warn: (message, meta = {}) => logger.warn(message, { ...context, ...meta }),
        info: (message, meta = {}) => logger.info(message, { ...context, ...meta }),
        debug: (message, meta = {}) => logger.debug(message, { ...context, ...meta }),
        trace: (message, meta = {}) => logger.trace(message, { ...context, ...meta }),
        time: (label) => logger.time(label),
        memory: () => logger.memory()
    };
};

export default logger;
