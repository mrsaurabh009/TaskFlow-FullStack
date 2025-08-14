/**
 * Security Middleware - HTTP security headers and configurations
 * Provides essential security headers and CORS configuration
 */

import { logger } from '../utils/logger.js';

/**
 * Security headers middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const securityHeaders = (req, res, next) => {
    // Remove server identification
    res.removeHeader('X-Powered-By');
    
    // Set security headers
    res.set({
        // Prevent MIME type sniffing
        'X-Content-Type-Options': 'nosniff',
        
        // Enable XSS protection
        'X-XSS-Protection': '1; mode=block',
        
        // Prevent clickjacking
        'X-Frame-Options': 'DENY',
        
        // Enforce HTTPS
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        
        // Control referrer information
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        
        // Prevent access to certain browser APIs
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        
        // Set custom server identifier
        'X-API-Version': process.env.API_VERSION || '1.0.0',
        'X-Response-Time': Date.now().toString()
    });

    // Content Security Policy (can be customized)
    if (process.env.ENABLE_CSP === 'true') {
        res.set('Content-Security-Policy', [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "connect-src 'self'",
            "font-src 'self'",
            "object-src 'none'",
            "media-src 'self'",
            "frame-src 'none'"
        ].join('; '));
    }

    next();
};

/**
 * CORS options configuration
 */
export const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
            'http://localhost:3000',
            'http://127.0.0.1:3000'
        ];
        
        const isProduction = process.env.NODE_ENV === 'production';
        
        // Allow requests with no origin (mobile apps, Postman, etc.) in development
        if (!origin && !isProduction) {
            return callback(null, true);
        }
        
        // Check if origin is allowed
        if (allowedOrigins.includes(origin) || !isProduction) {
            callback(null, true);
        } else {
            logger.warn('CORS blocked request', { origin, allowedOrigins });
            callback(new Error('Not allowed by CORS policy'));
        }
    },
    
    credentials: process.env.CORS_CREDENTIALS === 'true',
    
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'X-API-Key',
        'X-Request-ID'
    ],
    
    exposedHeaders: [
        'X-Total-Count',
        'X-Page-Count',
        'X-Per-Page',
        'X-Request-ID',
        'X-Response-Time',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset'
    ],
    
    maxAge: 86400 // 24 hours
};

/**
 * Enhanced CORS middleware with logging
 * @param {Object} options - CORS options
 * @returns {Function} CORS middleware
 */
export const corsWithLogging = (options = corsOptions) => {
    return (req, res, next) => {
        const origin = req.get('origin');
        
        // Log CORS requests in development
        if (process.env.NODE_ENV === 'development' && origin) {
            logger.debug('CORS request', {
                origin,
                method: req.method,
                url: req.originalUrl
            });
        }

        // Set CORS headers manually for better control
        const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
            'http://localhost:3000',
            'http://127.0.0.1:3000'
        ];

        const isProduction = process.env.NODE_ENV === 'production';
        
        if (origin && (allowedOrigins.includes(origin) || !isProduction)) {
            res.set('Access-Control-Allow-Origin', origin);
        } else if (!origin && !isProduction) {
            res.set('Access-Control-Allow-Origin', '*');
        }

        if (options.credentials) {
            res.set('Access-Control-Allow-Credentials', 'true');
        }

        res.set('Access-Control-Allow-Methods', options.methods.join(', '));
        res.set('Access-Control-Allow-Headers', options.allowedHeaders.join(', '));
        res.set('Access-Control-Expose-Headers', options.exposedHeaders.join(', '));
        res.set('Access-Control-Max-Age', options.maxAge);

        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            return res.status(204).end();
        }

        next();
    };
};

/**
 * IP whitelist middleware
 * @param {Array} allowedIPs - Array of allowed IP addresses
 * @returns {Function} IP whitelist middleware
 */
export const ipWhitelist = (allowedIPs = []) => {
    return (req, res, next) => {
        const clientIP = req.ip || req.connection.remoteAddress;
        
        if (allowedIPs.length === 0) {
            return next(); // No restrictions if no IPs specified
        }

        if (allowedIPs.includes(clientIP)) {
            return next();
        }

        logger.warn('IP blocked', { clientIP, allowedIPs });
        
        res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: 'IP address not allowed',
            statusCode: 403
        });
    };
};

/**
 * API key authentication middleware
 * @param {Object} options - API key options
 * @returns {Function} API key middleware
 */
export const apiKeyAuth = (options = {}) => {
    const {
        headerName = 'X-API-Key',
        queryName = 'api_key',
        validKeys = process.env.API_KEYS?.split(',') || [],
        required = true
    } = options;

    return (req, res, next) => {
        if (!required) {
            return next();
        }

        const apiKey = req.get(headerName) || req.query[queryName];

        if (!apiKey) {
            logger.warn('Missing API key', {
                ip: req.ip,
                url: req.originalUrl,
                userAgent: req.get('User-Agent')
            });

            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'API key is required',
                statusCode: 401
            });
        }

        if (!validKeys.includes(apiKey)) {
            logger.warn('Invalid API key', {
                ip: req.ip,
                url: req.originalUrl,
                userAgent: req.get('User-Agent'),
                providedKey: apiKey.substring(0, 4) + '...' // Log only first 4 chars
            });

            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Invalid API key',
                statusCode: 401
            });
        }

        // Store API key info in request for later use
        req.apiKey = apiKey;
        next();
    };
};

/**
 * Request size limiter middleware
 * @param {Object} options - Size limit options
 * @returns {Function} Size limiter middleware
 */
export const requestSizeLimiter = (options = {}) => {
    const {
        maxSize = 10 * 1024 * 1024, // 10MB
        skipPaths = ['/health']
    } = options;

    return (req, res, next) => {
        // Skip for certain paths
        if (skipPaths.some(path => req.path.startsWith(path))) {
            return next();
        }

        const contentLength = req.get('content-length');
        
        if (contentLength && parseInt(contentLength) > maxSize) {
            logger.warn('Request too large', {
                ip: req.ip,
                url: req.originalUrl,
                contentLength,
                maxSize
            });

            return res.status(413).json({
                success: false,
                error: 'Payload Too Large',
                message: 'Request entity too large',
                statusCode: 413,
                maxSize: `${maxSize} bytes`
            });
        }

        next();
    };
};

/**
 * Security audit logger middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next function
 */
export const securityAudit = (req, res, next) => {
    const securityEvents = [];

    // Check for suspicious patterns
    const suspiciousPatterns = [
        /script\s*:/i,
        /javascript\s*:/i,
        /on\w+\s*=/i,
        /<script/i,
        /union\s+select/i,
        /drop\s+table/i,
        /exec\s*\(/i,
        /eval\s*\(/i
    ];

    const checkValue = (value, context) => {
        if (typeof value === 'string') {
            suspiciousPatterns.forEach(pattern => {
                if (pattern.test(value)) {
                    securityEvents.push({
                        type: 'suspicious_pattern',
                        pattern: pattern.toString(),
                        value: value.substring(0, 100),
                        context
                    });
                }
            });
        }
    };

    // Check URL
    checkValue(req.originalUrl, 'url');

    // Check headers
    Object.entries(req.headers).forEach(([key, value]) => {
        checkValue(value, `header:${key}`);
    });

    // Check query parameters
    Object.entries(req.query || {}).forEach(([key, value]) => {
        checkValue(value, `query:${key}`);
    });

    // Check body (if available)
    if (req.body) {
        const checkObject = (obj, prefix = 'body') => {
            Object.entries(obj).forEach(([key, value]) => {
                if (typeof value === 'object' && value !== null) {
                    checkObject(value, `${prefix}.${key}`);
                } else {
                    checkValue(value, `${prefix}.${key}`);
                }
            });
        };
        checkObject(req.body);
    }

    // Log security events
    if (securityEvents.length > 0) {
        logger.warn('Security audit findings', {
            ip: req.ip,
            url: req.originalUrl,
            method: req.method,
            userAgent: req.get('User-Agent'),
            events: securityEvents
        });
    }

    next();
};

export default {
    securityHeaders,
    corsOptions,
    corsWithLogging,
    ipWhitelist,
    apiKeyAuth,
    requestSizeLimiter,
    securityAudit
};
