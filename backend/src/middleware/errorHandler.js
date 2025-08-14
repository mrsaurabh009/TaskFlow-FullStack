/**
 * Error Handler Middleware - Global error handling and 404 responses
 * Provides consistent error responses and logging
 */

import { logger } from '../utils/logger.js';

/**
 * Global error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const errorHandler = (err, req, res, next) => {
    // Log the error
    logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Default error response
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let details = null;

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation Error';
        details = Object.values(err.errors).map(e => e.message);
    } else if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
    } else if (err.name === 'MongoError' && err.code === 11000) {
        statusCode = 400;
        message = 'Duplicate field value entered';
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    } else if (err.type === 'entity.parse.failed') {
        statusCode = 400;
        message = 'Invalid JSON';
    } else if (err.type === 'entity.too.large') {
        statusCode = 413;
        message = 'Request entity too large';
    }

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    const errorResponse = {
        success: false,
        message,
        error: statusCode >= 500 ? 'Internal Server Error' : message,
        statusCode,
        timestamp: new Date().toISOString()
    };

    // Add details in development mode
    if (isDevelopment) {
        errorResponse.details = details;
        errorResponse.stack = err.stack;
        errorResponse.path = req.originalUrl;
        errorResponse.method = req.method;
    }

    // Add request ID if available
    if (req.id) {
        errorResponse.requestId = req.id;
    }

    res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const notFoundHandler = (req, res, next) => {
    const message = `Route ${req.originalUrl} not found`;
    
    logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    const errorResponse = {
        success: false,
        message,
        error: 'Not Found',
        statusCode: 404,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        method: req.method
    };

    res.status(404).json(errorResponse);
};

/**
 * Method not allowed handler
 * @param {Array} allowedMethods - Array of allowed HTTP methods
 * @returns {Function} Express middleware function
 */
export const methodNotAllowed = (allowedMethods = []) => {
    return (req, res, next) => {
        const message = `Method ${req.method} not allowed on ${req.originalUrl}`;
        
        logger.warn(`405 Method Not Allowed: ${req.method} ${req.originalUrl}`, {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            allowedMethods
        });

        res.set('Allow', allowedMethods.join(', '));
        
        const errorResponse = {
            success: false,
            message,
            error: 'Method Not Allowed',
            statusCode: 405,
            timestamp: new Date().toISOString(),
            allowedMethods
        };

        res.status(405).json(errorResponse);
    };
};

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.name = 'APIError';
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends Error {
    constructor(message, errors = []) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = 400;
        this.errors = errors;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Custom error class for not found errors
 */
export class NotFoundError extends Error {
    constructor(resource = 'Resource') {
        super(`${resource} not found`);
        this.name = 'NotFoundError';
        this.statusCode = 404;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Custom error class for unauthorized errors
 */
export class UnauthorizedError extends Error {
    constructor(message = 'Unauthorized') {
        super(message);
        this.name = 'UnauthorizedError';
        this.statusCode = 401;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Custom error class for forbidden errors
 */
export class ForbiddenError extends Error {
    constructor(message = 'Forbidden') {
        super(message);
        this.name = 'ForbiddenError';
        this.statusCode = 403;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export default {
    errorHandler,
    notFoundHandler,
    methodNotAllowed,
    APIError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError
};
