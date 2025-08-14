/**
 * Middleware Collection - Centralized middleware exports
 * Aggregates all middleware components for easy import and usage
 */

// Import all middleware components
import { asyncHandler } from './asyncHandler.js';
import { errorHandler, notFoundHandler } from './errorHandler.js';
import { requestLogger } from './logger.js';
import { rateLimiter, createCustomRateLimit } from './rateLimiter.js';
import { securityHeaders, corsOptions } from './security.js';
import { validateTask, validateUpdateTask, validateQueryParams } from './validation.js';

// Core middleware stack configuration
const coreMiddleware = [
    securityHeaders,
    requestLogger,
    rateLimiter
];

// CORS configuration for frontend integration
const corsConfig = {
    development: {
        origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
        credentials: true
    },
    production: {
        origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : false,
        credentials: true
    }
};

// Export middleware collections and utilities
export {
    // Individual middleware components
    asyncHandler,
    errorHandler,
    notFoundHandler,
    requestLogger,
    rateLimiter,
    createCustomRateLimit,
    securityHeaders,
    corsOptions,
    validateTask,
    validateUpdateTask,
    validateQueryParams,

    // Middleware collections
    coreMiddleware,
    corsConfig
};

/**
 * Apply core middleware to Express app
 * @param {Object} app - Express application instance
 * @param {Object} cors - CORS middleware (imported separately)
 */
export const applyCoreMiddleware = (app, cors) => {
    // Apply CORS first
    const environment = process.env.NODE_ENV || 'development';
    app.use(cors(corsConfig[environment] || corsConfig.development));
    
    // Apply core middleware stack
    coreMiddleware.forEach(middleware => {
        app.use(middleware);
    });
};

/**
 * Apply error handling middleware (should be applied last)
 * @param {Object} app - Express application instance
 */
export const applyErrorHandling = (app) => {
    // 404 handler
    app.use(notFoundHandler);
    
    // Global error handler
    app.use(errorHandler);
};

/**
 * Create validation middleware for specific route patterns
 * @param {string} type - Validation type ('task', 'updateTask', 'query')
 * @returns {Function} Validation middleware function
 */
export const createValidationMiddleware = (type) => {
    switch (type) {
        case 'task':
            return validateTask;
        case 'updateTask':
            return validateUpdateTask;
        case 'query':
            return validateQueryParams;
        default:
            throw new Error(`Unknown validation type: ${type}`);
    }
};

/**
 * Create custom rate limiting middleware
 * @param {Object} options - Rate limiting options
 * @returns {Function} Rate limiting middleware
 */
export const createRateLimitMiddleware = (options = {}) => {
    return createCustomRateLimit(options);
};

// Middleware configuration presets
export const middlewarePresets = {
    // Basic API setup
    basic: [
        securityHeaders,
        requestLogger
    ],
    
    // Standard API with rate limiting
    standard: [
        securityHeaders,
        requestLogger,
        rateLimiter
    ],
    
    // Full production setup
    production: [
        securityHeaders,
        requestLogger,
        rateLimiter,
        // Additional production middleware can be added here
    ],
    
    // Development setup with relaxed restrictions
    development: [
        requestLogger,
        createCustomRateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 1000, // More generous limit for development
            message: 'Too many requests from this IP in development mode'
        })
    ]
};

/**
 * Apply middleware preset to Express app
 * @param {Object} app - Express application instance
 * @param {string} preset - Preset name ('basic', 'standard', 'production', 'development')
 * @param {Object} cors - CORS middleware
 */
export const applyMiddlewarePreset = (app, preset = 'standard', cors) => {
    // Apply CORS first
    const environment = process.env.NODE_ENV || 'development';
    app.use(cors(corsConfig[environment] || corsConfig.development));
    
    // Apply preset middleware
    const middlewareStack = middlewarePresets[preset] || middlewarePresets.standard;
    middlewareStack.forEach(middleware => {
        app.use(middleware);
    });
};

export default {
    asyncHandler,
    errorHandler,
    notFoundHandler,
    requestLogger,
    rateLimiter,
    createCustomRateLimit,
    securityHeaders,
    corsOptions,
    validateTask,
    validateUpdateTask,
    validateQueryParams,
    coreMiddleware,
    corsConfig,
    applyCoreMiddleware,
    applyErrorHandling,
    createValidationMiddleware,
    createRateLimitMiddleware,
    middlewarePresets,
    applyMiddlewarePreset
};
