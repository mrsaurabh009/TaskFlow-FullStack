/**
 * Validation Middleware - Request data validation
 * Validates request bodies, query parameters, and route parameters
 */

import { validateTaskData, validateQueryParams as validateQueryParamsUtil, sanitizeTaskData } from '../utils/validators.js';
import { logger } from '../utils/logger.js';

/**
 * Validate task data for creation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const validateTask = (req, res, next) => {
    const validation = validateTaskData(req.body, false);
    
    if (!validation.isValid) {
        logger.warn('Task validation failed', {
            errors: validation.errors,
            body: req.body,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip
        });

        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: validation.errors,
            warnings: validation.warnings,
            statusCode: 400
        });
    }

    // Sanitize and store validated data
    req.validatedData = sanitizeTaskData(req.body);
    
    // Log warnings if any
    if (validation.warnings.length > 0) {
        logger.info('Task validation warnings', {
            warnings: validation.warnings,
            body: req.body,
            url: req.originalUrl
        });
    }

    next();
};

/**
 * Validate task data for updates (partial validation)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const validateUpdateTask = (req, res, next) => {
    // Skip validation if no body provided
    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
            success: false,
            message: 'No data provided for update',
            statusCode: 400
        });
    }

    const validation = validateTaskData(req.body, true);
    
    if (!validation.isValid) {
        logger.warn('Task update validation failed', {
            errors: validation.errors,
            body: req.body,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
            taskId: req.params.id
        });

        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: validation.errors,
            warnings: validation.warnings,
            statusCode: 400
        });
    }

    // Sanitize and store validated data
    req.validatedData = sanitizeTaskData(req.body);
    
    // Log warnings if any
    if (validation.warnings.length > 0) {
        logger.info('Task update validation warnings', {
            warnings: validation.warnings,
            body: req.body,
            url: req.originalUrl,
            taskId: req.params.id
        });
    }

    next();
};

/**
 * Validate query parameters for task filtering and pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const validateQueryParams = (req, res, next) => {
    const validation = validateQueryParamsUtil(req.query);
    
    if (!validation.isValid) {
        logger.warn('Query parameter validation failed', {
            errors: validation.errors,
            query: req.query,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip
        });

        return res.status(400).json({
            success: false,
            message: 'Invalid query parameters',
            errors: validation.errors,
            warnings: validation.warnings,
            statusCode: 400
        });
    }

    // Store validated query parameters
    req.validatedQuery = validation.validated;
    
    // Log warnings if any
    if (validation.warnings.length > 0) {
        logger.info('Query parameter validation warnings', {
            warnings: validation.warnings,
            query: req.query,
            url: req.originalUrl
        });
    }

    next();
};

/**
 * Validate task ID parameter
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const validateTaskId = (req, res, next) => {
    const { id } = req.params;
    
    if (!id) {
        return res.status(400).json({
            success: false,
            message: 'Task ID is required',
            statusCode: 400
        });
    }

    if (typeof id !== 'string' || id.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Task ID must be a valid string',
            statusCode: 400
        });
    }

    if (id.length > 100) {
        return res.status(400).json({
            success: false,
            message: 'Task ID is too long',
            statusCode: 400
        });
    }

    // Store validated ID
    req.validatedId = id.trim();
    next();
};

/**
 * Generic validation middleware factory
 * @param {Function} validator - Validation function
 * @param {string} dataSource - Source of data to validate ('body', 'query', 'params')
 * @returns {Function} Validation middleware
 */
export const createValidator = (validator, dataSource = 'body') => {
    return (req, res, next) => {
        let dataToValidate;
        
        switch (dataSource) {
            case 'body':
                dataToValidate = req.body;
                break;
            case 'query':
                dataToValidate = req.query;
                break;
            case 'params':
                dataToValidate = req.params;
                break;
            default:
                return res.status(500).json({
                    success: false,
                    message: 'Invalid validation configuration',
                    statusCode: 500
                });
        }

        try {
            const result = validator(dataToValidate);
            
            if (result && result.isValid === false) {
                logger.warn('Custom validation failed', {
                    errors: result.errors,
                    data: dataToValidate,
                    url: req.originalUrl,
                    method: req.method,
                    ip: req.ip,
                    source: dataSource
                });

                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: result.errors || ['Validation failed'],
                    warnings: result.warnings,
                    statusCode: 400
                });
            }

            // Store validated data if validation returns processed data
            if (result && result.validated) {
                req[`validated${dataSource.charAt(0).toUpperCase() + dataSource.slice(1)}`] = result.validated;
            }

            next();
        } catch (error) {
            logger.error('Validation error', {
                error: error.message,
                stack: error.stack,
                data: dataToValidate,
                url: req.originalUrl,
                method: req.method,
                ip: req.ip,
                source: dataSource
            });

            return res.status(500).json({
                success: false,
                message: 'Validation error occurred',
                statusCode: 500
            });
        }
    };
};

/**
 * Validate JSON content type for POST/PUT requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const validateContentType = (req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.get('Content-Type');
        
        if (!contentType || !contentType.includes('application/json')) {
            logger.warn('Invalid content type', {
                contentType,
                method: req.method,
                url: req.originalUrl,
                ip: req.ip
            });

            return res.status(400).json({
                success: false,
                message: 'Content-Type must be application/json',
                statusCode: 400,
                received: contentType || 'none'
            });
        }
    }

    next();
};

/**
 * Validate required fields in request body
 * @param {Array} requiredFields - Array of required field names
 * @returns {Function} Validation middleware
 */
export const validateRequiredFields = (requiredFields = []) => {
    return (req, res, next) => {
        const missingFields = [];
        const body = req.body || {};

        requiredFields.forEach(field => {
            if (!(field in body) || body[field] === null || body[field] === undefined || body[field] === '') {
                missingFields.push(field);
            }
        });

        if (missingFields.length > 0) {
            logger.warn('Missing required fields', {
                missingFields,
                requiredFields,
                body,
                url: req.originalUrl,
                method: req.method,
                ip: req.ip
            });

            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                missingFields,
                requiredFields,
                statusCode: 400
            });
        }

        next();
    };
};

/**
 * Validate email format
 * @param {string} field - Field name to validate
 * @returns {Function} Validation middleware
 */
export const validateEmail = (field = 'email') => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    return (req, res, next) => {
        const email = req.body[field];
        
        if (email && !emailRegex.test(email)) {
            logger.warn('Invalid email format', {
                field,
                value: email,
                url: req.originalUrl,
                method: req.method,
                ip: req.ip
            });

            return res.status(400).json({
                success: false,
                message: `Invalid ${field} format`,
                field,
                statusCode: 400
            });
        }

        next();
    };
};

/**
 * Validate field length
 * @param {Object} fieldLimits - Object with field names and their limits
 * @returns {Function} Validation middleware
 */
export const validateFieldLengths = (fieldLimits = {}) => {
    return (req, res, next) => {
        const errors = [];
        const body = req.body || {};

        Object.entries(fieldLimits).forEach(([field, limits]) => {
            const value = body[field];
            
            if (value && typeof value === 'string') {
                const { min = 0, max = Infinity } = limits;
                
                if (value.length < min) {
                    errors.push(`${field} must be at least ${min} characters long`);
                }
                
                if (value.length > max) {
                    errors.push(`${field} must not exceed ${max} characters`);
                }
            }
        });

        if (errors.length > 0) {
            logger.warn('Field length validation failed', {
                errors,
                fieldLimits,
                body,
                url: req.originalUrl,
                method: req.method,
                ip: req.ip
            });

            return res.status(400).json({
                success: false,
                message: 'Field length validation failed',
                errors,
                statusCode: 400
            });
        }

        next();
    };
};

export default {
    validateTask,
    validateUpdateTask,
    validateQueryParams,
    validateTaskId,
    createValidator,
    validateContentType,
    validateRequiredFields,
    validateEmail,
    validateFieldLengths
};
