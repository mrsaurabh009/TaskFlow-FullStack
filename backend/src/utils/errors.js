/**
 * Custom Error Classes - Structured error handling
 * Provides custom error classes for different types of application errors
 */

/**
 * Base API Error class
 */
export class APIError extends Error {
    constructor(message, statusCode = 500, isOperational = true, details = null) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.details = details;
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            statusCode: this.statusCode,
            isOperational: this.isOperational,
            details: this.details,
            timestamp: this.timestamp,
            ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
        };
    }
}

/**
 * 400 Bad Request Error
 */
export class BadRequestError extends APIError {
    constructor(message = 'Bad Request', details = null) {
        super(message, 400, true, details);
    }
}

/**
 * 401 Unauthorized Error
 */
export class UnauthorizedError extends APIError {
    constructor(message = 'Unauthorized', details = null) {
        super(message, 401, true, details);
    }
}

/**
 * 403 Forbidden Error
 */
export class ForbiddenError extends APIError {
    constructor(message = 'Forbidden', details = null) {
        super(message, 403, true, details);
    }
}

/**
 * 404 Not Found Error
 */
export class NotFoundError extends APIError {
    constructor(resource = 'Resource', details = null) {
        const message = `${resource} not found`;
        super(message, 404, true, details);
    }
}

/**
 * 409 Conflict Error
 */
export class ConflictError extends APIError {
    constructor(message = 'Conflict', details = null) {
        super(message, 409, true, details);
    }
}

/**
 * 422 Unprocessable Entity Error (Validation Error)
 */
export class ValidationError extends APIError {
    constructor(message = 'Validation failed', errors = [], details = null) {
        super(message, 422, true, details);
        this.errors = Array.isArray(errors) ? errors : [errors];
    }

    toJSON() {
        return {
            ...super.toJSON(),
            errors: this.errors
        };
    }
}

/**
 * 429 Too Many Requests Error
 */
export class TooManyRequestsError extends APIError {
    constructor(message = 'Too many requests', retryAfter = null, details = null) {
        super(message, 429, true, details);
        this.retryAfter = retryAfter;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            retryAfter: this.retryAfter
        };
    }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends APIError {
    constructor(message = 'Internal Server Error', details = null) {
        super(message, 500, false, details);
    }
}

/**
 * 502 Bad Gateway Error
 */
export class BadGatewayError extends APIError {
    constructor(message = 'Bad Gateway', details = null) {
        super(message, 502, true, details);
    }
}

/**
 * 503 Service Unavailable Error
 */
export class ServiceUnavailableError extends APIError {
    constructor(message = 'Service Unavailable', details = null) {
        super(message, 503, true, details);
    }
}

/**
 * Database Error
 */
export class DatabaseError extends APIError {
    constructor(message = 'Database Error', originalError = null, details = null) {
        super(message, 500, false, details);
        this.originalError = originalError;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            ...(process.env.NODE_ENV === 'development' && this.originalError && {
                originalError: {
                    message: this.originalError.message,
                    name: this.originalError.name,
                    ...(this.originalError.code && { code: this.originalError.code })
                }
            })
        };
    }
}

/**
 * External Service Error
 */
export class ExternalServiceError extends APIError {
    constructor(serviceName, message = 'External service error', statusCode = 502, details = null) {
        super(`${serviceName}: ${message}`, statusCode, true, details);
        this.serviceName = serviceName;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            serviceName: this.serviceName
        };
    }
}

/**
 * Task-specific errors
 */
export class TaskNotFoundError extends NotFoundError {
    constructor(taskId, details = null) {
        super(`Task with ID '${taskId}'`, details);
        this.taskId = taskId;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            taskId: this.taskId
        };
    }
}

export class TaskValidationError extends ValidationError {
    constructor(message = 'Task validation failed', errors = [], details = null) {
        super(message, errors, details);
    }
}

export class DuplicateTaskError extends ConflictError {
    constructor(field, value, details = null) {
        super(`Task with ${field} '${value}' already exists`, details);
        this.field = field;
        this.value = value;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            field: this.field,
            value: this.value
        };
    }
}

/**
 * Error factory functions for common scenarios
 */
export const createError = {
    /**
     * Create a validation error from validation results
     */
    fromValidation: (validationResult) => {
        if (!validationResult || validationResult.isValid) {
            return null;
        }
        
        return new ValidationError(
            'Request validation failed',
            validationResult.errors || [],
            {
                warnings: validationResult.warnings || []
            }
        );
    },

    /**
     * Create a task not found error
     */
    taskNotFound: (taskId) => {
        return new TaskNotFoundError(taskId);
    },

    /**
     * Create a bad request error
     */
    badRequest: (message, details = null) => {
        return new BadRequestError(message, details);
    },

    /**
     * Create an internal server error
     */
    internal: (message = 'Something went wrong', details = null) => {
        return new InternalServerError(message, details);
    },

    /**
     * Create an unauthorized error
     */
    unauthorized: (message = 'Authentication required', details = null) => {
        return new UnauthorizedError(message, details);
    },

    /**
     * Create a forbidden error
     */
    forbidden: (message = 'Access denied', details = null) => {
        return new ForbiddenError(message, details);
    },

    /**
     * Create a rate limit error
     */
    rateLimited: (message = 'Rate limit exceeded', retryAfter = null) => {
        return new TooManyRequestsError(message, retryAfter);
    }
};

/**
 * Error handling utilities
 */
export const errorUtils = {
    /**
     * Check if error is operational (expected error vs programming error)
     */
    isOperationalError: (error) => {
        return error instanceof APIError && error.isOperational;
    },

    /**
     * Extract error details for logging
     */
    getErrorDetails: (error, request = null) => {
        const details = {
            name: error.name || 'Error',
            message: error.message || 'Unknown error',
            stack: error.stack,
            timestamp: new Date().toISOString()
        };

        // Add API error specific details
        if (error instanceof APIError) {
            details.statusCode = error.statusCode;
            details.isOperational = error.isOperational;
            details.details = error.details;
        }

        // Add request context if available
        if (request) {
            details.request = {
                method: request.method,
                url: request.originalUrl || request.url,
                headers: request.headers,
                body: request.body,
                query: request.query,
                params: request.params,
                ip: request.ip,
                userAgent: request.get('User-Agent')
            };
        }

        return details;
    },

    /**
     * Create error response object
     */
    createErrorResponse: (error, includeStack = false) => {
        const response = {
            success: false,
            error: {
                name: error.name || 'Error',
                message: error.message || 'An error occurred',
                statusCode: error.statusCode || 500,
                timestamp: new Date().toISOString()
            }
        };

        // Add API error specific fields
        if (error instanceof APIError) {
            if (error.details) {
                response.error.details = error.details;
            }
        }

        // Add validation errors
        if (error instanceof ValidationError && error.errors.length > 0) {
            response.error.errors = error.errors;
        }

        // Add retry after for rate limit errors
        if (error instanceof TooManyRequestsError && error.retryAfter) {
            response.error.retryAfter = error.retryAfter;
        }

        // Add stack trace in development
        if (includeStack && error.stack) {
            response.error.stack = error.stack;
        }

        return response;
    },

    /**
     * Wrap async functions to catch and forward errors
     */
    asyncWrapper: (fn) => {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    },

    /**
     * Handle promise rejections
     */
    handlePromiseRejection: (promise, errorMessage = 'Operation failed') => {
        return promise.catch(error => {
            if (error instanceof APIError) {
                throw error;
            }
            throw new InternalServerError(errorMessage, { originalError: error.message });
        });
    }
};

// Export all error classes and utilities
export default {
    // Base classes
    APIError,
    
    // HTTP error classes
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    ValidationError,
    TooManyRequestsError,
    InternalServerError,
    BadGatewayError,
    ServiceUnavailableError,
    
    // Specific error classes
    DatabaseError,
    ExternalServiceError,
    TaskNotFoundError,
    TaskValidationError,
    DuplicateTaskError,
    
    // Utilities
    createError,
    errorUtils
};
