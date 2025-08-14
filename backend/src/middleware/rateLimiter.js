/**
 * Rate Limiter Middleware - Request rate limiting and throttling
 * Protects API from abuse and excessive requests
 */

import { logger } from '../utils/logger.js';

/**
 * In-memory store for rate limiting
 * In production, use Redis or similar distributed cache
 */
class MemoryStore {
    constructor() {
        this.store = new Map();
        this.resetTime = new Map();
        
        // Cleanup expired entries every 5 minutes
        setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }

    get(key) {
        return this.store.get(key) || { count: 0, resetTime: Date.now() + (15 * 60 * 1000) };
    }

    set(key, value) {
        this.store.set(key, value);
        this.resetTime.set(key, value.resetTime);
    }

    increment(key, windowMs) {
        const current = this.get(key);
        const now = Date.now();

        // Reset if window has passed
        if (now > current.resetTime) {
            current.count = 1;
            current.resetTime = now + windowMs;
        } else {
            current.count++;
        }

        this.set(key, current);
        return current;
    }

    cleanup() {
        const now = Date.now();
        for (const [key, resetTime] of this.resetTime.entries()) {
            if (now > resetTime) {
                this.store.delete(key);
                this.resetTime.delete(key);
            }
        }
    }

    reset(key) {
        this.store.delete(key);
        this.resetTime.delete(key);
    }

    resetAll() {
        this.store.clear();
        this.resetTime.clear();
    }
}

// Default store instance
const defaultStore = new MemoryStore();

/**
 * Create rate limiter middleware
 * @param {Object} options - Rate limiting options
 * @returns {Function} Rate limiting middleware
 */
export const createRateLimit = (options = {}) => {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutes
        max = 100, // 100 requests per window
        message = 'Too many requests from this IP, please try again later',
        statusCode = 429,
        headers = true,
        skipSuccessfulRequests = false,
        skipFailedRequests = false,
        skip = () => false,
        keyGenerator = (req) => req.ip,
        onLimitReached = null,
        store = defaultStore
    } = options;

    return (req, res, next) => {
        // Skip if configured to skip
        if (skip(req, res)) {
            return next();
        }

        const key = keyGenerator(req);
        const current = store.increment(key, windowMs);
        const remaining = Math.max(0, max - current.count);
        const resetTime = new Date(current.resetTime);

        // Set rate limit headers
        if (headers) {
            res.set({
                'X-RateLimit-Limit': max,
                'X-RateLimit-Remaining': remaining,
                'X-RateLimit-Reset': resetTime.toISOString(),
                'X-RateLimit-Window': `${windowMs}ms`
            });
        }

        // Allow request if within limit
        if (current.count <= max) {
            return next();
        }

        // Rate limit exceeded
        logger.warn('Rate limit exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            url: req.originalUrl,
            method: req.method,
            count: current.count,
            limit: max,
            resetTime: resetTime.toISOString()
        });

        // Call limit reached callback if provided
        if (onLimitReached) {
            onLimitReached(req, res, options);
        }

        // Set retry-after header
        const retryAfter = Math.ceil((current.resetTime - Date.now()) / 1000);
        res.set('Retry-After', retryAfter);

        // Send rate limit response
        const errorResponse = {
            success: false,
            error: 'Too Many Requests',
            message: typeof message === 'function' ? message(req, res) : message,
            statusCode,
            retryAfter,
            limit: max,
            remaining: 0,
            resetTime: resetTime.toISOString()
        };

        res.status(statusCode).json(errorResponse);
    };
};

/**
 * Default rate limiter middleware
 */
export const rateLimiter = createRateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later',
    skipSuccessfulRequests: false,
    skipFailedRequests: false
});

/**
 * Strict rate limiter for sensitive endpoints
 */
export const strictRateLimiter = createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per window
    message: 'Too many requests to this sensitive endpoint, please try again later'
});

/**
 * Lenient rate limiter for public endpoints
 */
export const lenientRateLimiter = createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per window
    message: 'Too many requests, please try again later'
});

/**
 * Create custom rate limit with specific options
 * @param {Object} customOptions - Custom rate limiting options
 * @returns {Function} Custom rate limiting middleware
 */
export const createCustomRateLimit = (customOptions = {}) => {
    return createRateLimit({
        ...customOptions
    });
};

/**
 * Rate limiter for login attempts
 */
export const loginRateLimiter = createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many login attempts, please try again later',
    keyGenerator: (req) => `login:${req.ip}:${req.body?.email || 'unknown'}`,
    skipSuccessfulRequests: true
});

/**
 * Rate limiter for password reset attempts
 */
export const passwordResetRateLimiter = createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour
    message: 'Too many password reset attempts, please try again later',
    keyGenerator: (req) => `pwd-reset:${req.ip}:${req.body?.email || 'unknown'}`
});

/**
 * Global rate limiter that applies to all requests
 */
export const globalRateLimiter = createRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // Very high limit for global usage
    message: 'Global rate limit exceeded',
    skip: (req) => {
        // Skip health checks and static assets
        return req.path.startsWith('/health') || 
               req.path.startsWith('/static') ||
               req.path.startsWith('/favicon.ico');
    }
});

/**
 * Rate limiter specifically for API endpoints
 */
export const apiRateLimiter = createRateLimit({
    windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS) || 200,
    message: 'API rate limit exceeded, please slow down your requests',
    keyGenerator: (req) => `api:${req.ip}`,
    onLimitReached: (req, res, options) => {
        logger.warn('API rate limit reached', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            endpoint: req.originalUrl,
            method: req.method
        });
    }
});

export default {
    createRateLimit,
    rateLimiter,
    strictRateLimiter,
    lenientRateLimiter,
    createCustomRateLimit,
    loginRateLimiter,
    passwordResetRateLimiter,
    globalRateLimiter,
    apiRateLimiter,
    MemoryStore
};
