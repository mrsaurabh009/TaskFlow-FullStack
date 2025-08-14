/**
 * Request Logger Middleware - HTTP request logging
 * Logs incoming requests with timing and response details
 */

import { logger } from '../utils/logger.js';

/**
 * Request logging middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requestLogger = (req, res, next) => {
    // Record start time
    const startTime = Date.now();
    
    // Generate request ID
    req.id = req.get('X-Request-ID') || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add request ID to response headers
    res.set('X-Request-ID', req.id);
    
    // Store original end function
    const originalEnd = res.end;
    
    // Override end function to log when response is sent
    res.end = function(...args) {
        // Calculate response time
        const responseTime = Date.now() - startTime;
        
        // Log the request using the logger's HTTP method
        logger.httpRequest(req, res, responseTime);
        
        // Restore and call original end function
        originalEnd.apply(this, args);
    };
    
    next();
};

/**
 * Create custom request logger with specific options
 * @param {Object} options - Logger options
 * @returns {Function} Request logger middleware
 */
export const createRequestLogger = (options = {}) => {
    const {
        includeHeaders = false,
        includeBody = false,
        skipHealthCheck = true,
        skipPaths = []
    } = options;

    return (req, res, next) => {
        // Skip logging for specified paths
        if (skipPaths.some(path => req.path.startsWith(path))) {
            return next();
        }
        
        // Skip health check endpoints if configured
        if (skipHealthCheck && req.path.startsWith('/health')) {
            return next();
        }

        const startTime = Date.now();
        req.id = req.get('X-Request-ID') || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        res.set('X-Request-ID', req.id);
        
        // Prepare request metadata
        const requestMeta = {
            requestId: req.id,
            method: req.method,
            url: req.originalUrl || req.url,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            referrer: req.get('Referrer'),
            contentType: req.get('Content-Type'),
            contentLength: req.get('Content-Length')
        };

        // Include headers if requested
        if (includeHeaders) {
            requestMeta.headers = req.headers;
        }

        // Include body if requested (be careful with sensitive data)
        if (includeBody && req.body && Object.keys(req.body).length > 0) {
            requestMeta.body = req.body;
        }

        // Log incoming request
        logger.info(`Incoming ${req.method} ${req.originalUrl || req.url}`, requestMeta);

        const originalEnd = res.end;
        res.end = function(...args) {
            const responseTime = Date.now() - startTime;
            
            const responseMeta = {
                requestId: req.id,
                statusCode: res.statusCode,
                responseTime: `${responseTime}ms`,
                contentLength: res.get('Content-Length'),
                contentType: res.get('Content-Type')
            };

            // Determine log level based on status code
            let logLevel = 'info';
            if (res.statusCode >= 500) {
                logLevel = 'error';
            } else if (res.statusCode >= 400) {
                logLevel = 'warn';
            }

            const message = `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${responseTime}ms`;
            logger[logLevel](message, responseMeta);

            originalEnd.apply(this, args);
        };

        next();
    };
};

/**
 * Error-specific request logger
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const errorRequestLogger = (err, req, res, next) => {
    const errorMeta = {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        error: err.message,
        stack: err.stack,
        statusCode: err.statusCode || 500
    };

    logger.error(`Request error: ${req.method} ${req.originalUrl || req.url}`, errorMeta);
    next(err);
};

export default {
    requestLogger,
    createRequestLogger,
    errorRequestLogger
};
