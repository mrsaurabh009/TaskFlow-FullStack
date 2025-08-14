/**
 * Validation Utilities - Environment and data validation functions
 * Provides comprehensive validation for environment configuration and data integrity
 */

import { logger } from './logger.js';

/**
 * Validate required environment variables and configuration
 * Ensures all critical settings are properly configured before server startup
 */
export const validateEnvironment = () => {
    const requiredVars = [];
    const warnings = [];
    const config = {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 5000,
        apiPrefix: process.env.API_PREFIX || '/api',
        apiVersion: process.env.API_VERSION || 'v1'
    };

    // Check for recommended environment variables
    const recommendedVars = {
        'CORS_ORIGIN': 'CORS origins for production',
        'RATE_LIMIT_MAX_REQUESTS': 'Rate limiting configuration',
        'LOG_LEVEL': 'Logging level configuration',
        'COMPRESSION_THRESHOLD': 'Response compression settings'
    };

    // Validate production-specific requirements
    if (config.nodeEnv === 'production') {
        if (!process.env.CORS_ORIGIN) {
            requiredVars.push('CORS_ORIGIN must be set in production');
        }
        
        if (!process.env.RATE_LIMIT_MAX_REQUESTS) {
            warnings.push('RATE_LIMIT_MAX_REQUESTS not set, using default');
        }
        
        if (!process.env.TRUST_PROXY) {
            warnings.push('TRUST_PROXY not set, may affect rate limiting behind proxy');
        }
    }

    // Check recommended variables
    Object.entries(recommendedVars).forEach(([varName, description]) => {
        if (!process.env[varName]) {
            warnings.push(`${varName} not set (${description})`);
        }
    });

    // Validate numeric values
    const numericVars = {
        'PORT': process.env.PORT,
        'RATE_LIMIT_WINDOW_MS': process.env.RATE_LIMIT_WINDOW_MS,
        'RATE_LIMIT_MAX_REQUESTS': process.env.RATE_LIMIT_MAX_REQUESTS,
        'COMPRESSION_THRESHOLD': process.env.COMPRESSION_THRESHOLD
    };

    Object.entries(numericVars).forEach(([varName, value]) => {
        if (value && isNaN(Number(value))) {
            requiredVars.push(`${varName} must be a valid number, got: ${value}`);
        }
    });

    // Log validation results
    if (requiredVars.length > 0) {
        logger.error('Environment validation failed:');
        requiredVars.forEach(error => logger.error(`  ❌ ${error}`));
        process.exit(1);
    }

    if (warnings.length > 0) {
        logger.warn('Environment configuration warnings:');
        warnings.forEach(warning => logger.warn(`  ⚠️  ${warning}`));
    }

    logger.info('✅ Environment validation passed');
    logger.info(`Configuration: ${JSON.stringify(config, null, 2)}`);
};

/**
 * Validate task data structure
 * @param {Object} task - Task object to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object} Validation result with isValid and errors
 */
export const validateTaskData = (task, isUpdate = false) => {
    const errors = [];
    const warnings = [];

    // Required fields for new tasks
    if (!isUpdate) {
        if (!task.title || typeof task.title !== 'string' || task.title.trim().length === 0) {
            errors.push('Title is required and must be a non-empty string');
        }
    }

    // Validate title if present
    if (task.title !== undefined) {
        if (typeof task.title !== 'string') {
            errors.push('Title must be a string');
        } else if (task.title.trim().length === 0) {
            errors.push('Title cannot be empty');
        } else if (task.title.length > 200) {
            errors.push('Title must be less than 200 characters');
        }
    }

    // Validate description if present
    if (task.description !== undefined) {
        if (typeof task.description !== 'string') {
            errors.push('Description must be a string');
        } else if (task.description.length > 1000) {
            errors.push('Description must be less than 1000 characters');
        }
    }

    // Validate status if present
    const validStatuses = ['pending', 'in-progress', 'completed', 'cancelled'];
    if (task.status !== undefined) {
        if (!validStatuses.includes(task.status)) {
            errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
        }
    }

    // Validate priority if present
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (task.priority !== undefined) {
        if (!validPriorities.includes(task.priority)) {
            errors.push(`Priority must be one of: ${validPriorities.join(', ')}`);
        }
    }

    // Validate due date if present
    if (task.dueDate !== undefined && task.dueDate !== null) {
        const dueDate = new Date(task.dueDate);
        if (isNaN(dueDate.getTime())) {
            errors.push('Due date must be a valid ISO 8601 date string');
        } else if (dueDate < new Date('2000-01-01')) {
            warnings.push('Due date appears to be in the past or very old');
        }
    }

    // Validate tags if present
    if (task.tags !== undefined) {
        if (!Array.isArray(task.tags)) {
            errors.push('Tags must be an array');
        } else {
            task.tags.forEach((tag, index) => {
                if (typeof tag !== 'string') {
                    errors.push(`Tag at index ${index} must be a string`);
                } else if (tag.length > 50) {
                    errors.push(`Tag at index ${index} must be less than 50 characters`);
                }
            });
            
            if (task.tags.length > 10) {
                warnings.push('More than 10 tags may affect performance');
            }
        }
    }

    // Validate assignee if present
    if (task.assignee !== undefined && task.assignee !== null) {
        if (typeof task.assignee !== 'string' || task.assignee.trim().length === 0) {
            errors.push('Assignee must be a non-empty string');
        } else if (task.assignee.length > 100) {
            errors.push('Assignee must be less than 100 characters');
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
};

/**
 * Validate query parameters for task filtering and pagination
 * @param {Object} query - Query parameters from request
 * @returns {Object} Validation result with parsed and validated parameters
 */
export const validateQueryParams = (query) => {
    const errors = [];
    const warnings = [];
    const validated = {};

    // Validate pagination parameters
    if (query.page !== undefined) {
        const page = parseInt(query.page, 10);
        if (isNaN(page) || page < 1) {
            errors.push('Page must be a positive integer');
        } else {
            validated.page = page;
        }
    }

    if (query.limit !== undefined) {
        const limit = parseInt(query.limit, 10);
        if (isNaN(limit) || limit < 1) {
            errors.push('Limit must be a positive integer');
        } else if (limit > 100) {
            errors.push('Limit cannot exceed 100');
        } else {
            validated.limit = limit;
        }
    }

    // Validate sorting parameters
    if (query.sortBy !== undefined) {
        const validSortFields = ['title', 'status', 'priority', 'dueDate', 'createdAt', 'updatedAt'];
        if (!validSortFields.includes(query.sortBy)) {
            errors.push(`Sort field must be one of: ${validSortFields.join(', ')}`);
        } else {
            validated.sortBy = query.sortBy;
        }
    }

    if (query.sortOrder !== undefined) {
        const validSortOrders = ['asc', 'desc'];
        if (!validSortOrders.includes(query.sortOrder.toLowerCase())) {
            errors.push('Sort order must be "asc" or "desc"');
        } else {
            validated.sortOrder = query.sortOrder.toLowerCase();
        }
    }

    // Validate filter parameters
    if (query.status !== undefined) {
        const validStatuses = ['pending', 'in-progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(query.status)) {
            errors.push(`Status filter must be one of: ${validStatuses.join(', ')}`);
        } else {
            validated.status = query.status;
        }
    }

    if (query.priority !== undefined) {
        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        if (!validPriorities.includes(query.priority)) {
            errors.push(`Priority filter must be one of: ${validPriorities.join(', ')}`);
        } else {
            validated.priority = query.priority;
        }
    }

    if (query.assignee !== undefined) {
        if (typeof query.assignee !== 'string' || query.assignee.trim().length === 0) {
            errors.push('Assignee filter must be a non-empty string');
        } else {
            validated.assignee = query.assignee.trim();
        }
    }

    // Validate search parameters
    if (query.search !== undefined) {
        if (typeof query.search !== 'string') {
            errors.push('Search query must be a string');
        } else if (query.search.trim().length === 0) {
            warnings.push('Empty search query provided');
        } else if (query.search.length > 100) {
            errors.push('Search query must be less than 100 characters');
        } else {
            validated.search = query.search.trim();
        }
    }

    // Validate date range filters
    if (query.dueDateFrom !== undefined) {
        const date = new Date(query.dueDateFrom);
        if (isNaN(date.getTime())) {
            errors.push('dueDateFrom must be a valid ISO 8601 date string');
        } else {
            validated.dueDateFrom = date;
        }
    }

    if (query.dueDateTo !== undefined) {
        const date = new Date(query.dueDateTo);
        if (isNaN(date.getTime())) {
            errors.push('dueDateTo must be a valid ISO 8601 date string');
        } else {
            validated.dueDateTo = date;
        }
    }

    // Validate date range consistency
    if (validated.dueDateFrom && validated.dueDateTo && validated.dueDateFrom > validated.dueDateTo) {
        errors.push('dueDateFrom must be before dueDateTo');
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        validated
    };
};

/**
 * Sanitize task data by removing/cleaning potentially harmful content
 * @param {Object} task - Task object to sanitize
 * @returns {Object} Sanitized task object
 */
export const sanitizeTaskData = (task) => {
    const sanitized = { ...task };

    // Trim string fields
    if (sanitized.title) {
        sanitized.title = sanitized.title.toString().trim();
    }
    
    if (sanitized.description) {
        sanitized.description = sanitized.description.toString().trim();
    }
    
    if (sanitized.assignee) {
        sanitized.assignee = sanitized.assignee.toString().trim();
    }

    // Clean tags array
    if (sanitized.tags && Array.isArray(sanitized.tags)) {
        sanitized.tags = sanitized.tags
            .map(tag => typeof tag === 'string' ? tag.trim() : String(tag).trim())
            .filter(tag => tag.length > 0)
            .filter((tag, index, array) => array.indexOf(tag) === index); // Remove duplicates
    }

    // Ensure status and priority are lowercase
    if (sanitized.status) {
        sanitized.status = sanitized.status.toString().toLowerCase();
    }
    
    if (sanitized.priority) {
        sanitized.priority = sanitized.priority.toString().toLowerCase();
    }

    // Remove any undefined or null values
    Object.keys(sanitized).forEach(key => {
        if (sanitized[key] === undefined || sanitized[key] === null) {
            delete sanitized[key];
        }
    });

    return sanitized;
};

export default {
    validateEnvironment,
    validateTaskData,
    validateQueryParams,
    sanitizeTaskData
};
